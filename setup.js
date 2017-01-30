#!/usr/bin/env node
'use strict';

const Fs = require('fs');
const Path = require('path');
const Async = require('async');
const Promptly = require('promptly');
const Mongodb = require('mongodb');


Async.auto({
    projectName: function (done) {

        Promptly.prompt('Project name', { default: 'doNotUseMe' }, done);
    },
    mongodbUrl: ['projectName', (done, results) => {

        const promptOptions = {
            default: 'mongodb://localhost:27017/'+results.projectName
        };

        Promptly.prompt('MongoDB URL', promptOptions, done);
    }], 
    testMongo: ['mongodbUrl', (done, results) => {

        Mongodb.MongoClient.connect(results.mongodbUrl, {}, (err, db) => {

            if (err) {
                console.error('Failed to connect to Mongodb.');
                return done(err);
            }

            db.close();
            done(null, true);
        });
    }],
    rootEmail: ['mongodbUrl', (done, results) => {

        Promptly.prompt('Root user email', done);
    }],    
    rootPassword: ['rootEmail', (done, results) => {

        Promptly.password('Root user password', done);
    }],
    setupRootUser: ['rootPassword', (done, results) => {

        const BaseModel = require('hapi-mongo-models').BaseModel;
        const User = require('./server/models/user');
        const Admin = require('./server/models/admin');
        const AdminGroup = require('./server/models/admin-group');

        Async.auto({
            connect: function (done) {

                BaseModel.connect({ url: results.mongodbUrl }, done);
            },
            adminGroup: ['connect', function (done) {

                AdminGroup.create('Root', done);
            }],
            admin: ['connect', function (done) {

                Admin.create('Root Admin', done);
            }],
            user: ['connect', function (done, dbResults) {

                User.create('root', results.rootPassword, results.rootEmail, 'setup', done);
            }],
            adminMembership: ['admin', function (done, dbResults) {

                const id = dbResults.admin._id.toString();
                const update = {
                    $set: {
                        groups: {
                            root: 'Root'
                        }
                    }
                };

                Admin.findByIdAndUpdate(id, update, done);
            }],
            linkUser: ['admin', 'user', function (done, dbResults) {

                const id = dbResults.user._id.toString();
                const update = {
                    $set: {
                        'roles.admin': {
                            id: dbResults.admin._id.toString(),
                            name: 'Root Admin'
                        }
                    }
                };

                User.findByIdAndUpdate(id, update, done);
            }],
            linkAdmin: ['admin', 'user', function (done, dbResults) {

                const id = dbResults.admin._id.toString();
                const update = {
                    $set: {
                        user: {
                            id: dbResults.user._id.toString(),
                            name: 'root'
                        }
                    }
                };

                Admin.findByIdAndUpdate(id, update, done);
            }]
        }, (err, dbResults) => {

            if (err) {
                console.error('Failed to setup root user.');
                return done(err);
            }

            done(null, true);
        });
    }]
}, (err, results) => {

    if (err) {
        console.error('Setup failed.');
        console.error(err);
        return process.exit(1);
    }

    console.log('Setup complete.');
    process.exit(0);
});
