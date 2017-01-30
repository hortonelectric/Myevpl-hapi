'use strict';

const Joi = require('joi');
const Async = require('async');
const ObjectAssign = require('object-assign');
const BaseModel = require('hapi-mongo-models').BaseModel;

const Profile = BaseModel.extend({
    constructor: function (attrs) {

        ObjectAssign(this, attrs);
    }
});

Profile._collection = 'profiles';

Profile.schema = Joi.object().keys({
    _id: Joi.object(),
    accountId: Joi.string().required(),
    createdAt: Joi.date(),
    updatedAt: Joi.date(),
    type: Joi.string()
});
Profile.indexes = [
    { key: { 'accountId': -1 } },
    { key: { 'createdAt': -1 } },
    { key: { 'updatedAt': -1 } },
    { key: { 'type': -1 } }
];

Profile.create = function(document,reply) {
    var self = this;
    document.createdAt = new Date()
    document.updatedAt = new Date()
    Joi.validate(document, Profile.schema, function (errValidate, value) { 
        if (errValidate) {
            return reply(errValidate);
        }

        Async.auto({
            clean: function (done, results) {
                self.deleteOne(document, done);
            }, newLog: function (done, results) {

                self.insertOne(document, done);
            }
        }, (err, results) => {

            if (err) {
                return callback(err);
            }

            reply(null, results[0]);
        });
    });
}

module.exports = Profile;
