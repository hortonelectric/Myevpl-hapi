'use strict';

const Boom = require('boom');
const Async = require('async');
const Joi = require('joi');
const AuthPlugin = require('../auth');


const internals = {};


internals.applyRoutes = function (server, next) {

    const Account = server.plugins['hapi-mongo-models'].Account;
    const User = server.plugins['hapi-mongo-models'].User;
    const Status = server.plugins['hapi-mongo-models'].Status;


    server.route({
        method: 'GET',
        path: '/profiles',
        config: {
            validate: {
                query: {
                    fields: Joi.string(),
                    sort: Joi.string().default('_id'),
                    limit: Joi.number().default(20),
                    page: Joi.number().default(1)
                }
            }
        },
        handler: function (request, reply) {

            const query = {};
            const fields = request.query.fields;
            const sort = request.query.sort;
            const limit = request.query.limit;
            const page = request.query.page;

            Profile.pagedFind(query, fields, sort, limit, page, (err, results) => {

                if (err) {
                    return reply(err);
                }

                reply(results);
            });
        }
    });


    server.route({
        method: 'GET',
        path: '/profiles/{id}',
        handler: function (request, reply) {

            Profile.findById(request.params.id, (err, profile) => {

                if (err) {
                    return reply(err);
                }

                if (!profile) {
                    return reply(Boom.notFound('Document not found.'));
                }

                reply(profile);
            });
        }
    });


    server.route({
        method: 'GET',
        path: '/profiles/my',
        config: {
            auth: {
                strategy: 'simple',
                scope: 'account'
            }
        },
        handler: function (request, reply) {

            const id = request.auth.credentials.roles.account._id;

            Profile.find({accountId:id}, (err, profiles) => {

                if (err) {
                    return reply(err);
                }

                if (!profiles) {
                    return reply(Boom.notFound('Profiles not found. That is strange.'));
                }

                reply(profiles);
            });
        }
    });


    server.route({
        method: 'POST',
        path: '/profiles',
        config: {
            auth: {
                strategy: 'simple',
                scope: 'account'
            },
            validate: {
                payload: {
                    type: Joi.string().required()
                }
            }
        },
        handler: function (request, reply) {

            request.payload.accountId = request.auth.credentials.roles.account._id;
            Profile.create(request.payload, (err, account) => {

                if (err) {
                    return reply(err);
                }

                reply(account);
            });
        }
    });


    server.route({
        method: 'PUT',
        path: '/profiles/{id}',
        config: {
            auth: {
                strategy: 'simple',
                scope: 'account'
            }
        },
        handler: function (request, reply) {

            const id = request.params.id;
            const update = {
                $set: request.payload
            };
            update.accountId = request.auth.credentials.roles.account._id;
            update.updatedAt = new Date()

            Profile.findByIdValidateAndUpdate(id, update, (err, profile) => {

                if (err) {
                    return reply(err);
                }

                if (!profile) {
                    return reply(Boom.notFound('Document not found.'));
                }

                reply(profile);
            });
        }
    });


    server.route({
        method: 'DELETE',
        path: '/profiles/{id}',
        config: {
            auth: {
                strategy: 'simple',
                scope: 'account'
            }
        },
        handler: function (request, reply) {

            Profile.findByIdAndDelete(request.params.id, (err, account) => {

                if (err) {
                    return reply(err);
                }

                if (!account) {
                    return reply(Boom.notFound('Document not found.'));
                }

                reply({ message: 'Success.' });
            });
        }
    });


    next();
};


exports.register = function (server, options, next) {

    server.dependency(['auth', 'hapi-mongo-models'], internals.applyRoutes);

    next();
};


exports.register.attributes = {
    name: 'account'
};
