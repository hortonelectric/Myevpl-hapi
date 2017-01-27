'use strict';

const Joi = require('joi');
const Async = require('async');
const ObjectAssign = require('object-assign');
const BaseModel = require('hapi-mongo-models').BaseModel;

const IpLog = BaseModel.extend({
    constructor: function (attrs) {

        ObjectAssign(this, attrs);
    }
});

IpLog._collection = 'iplog';

IpLog.schema = Joi.object().keys({
    ip: Joi.string().required(),
    userId: Joi.string().required()
});
IpLog.indexes = [
    { key: { 'userId': -1 } },
    { key: { 'ip': -1 } }
];

IpLog.create = function(event,reply) {
    var self = this;
    Joi.validate(event, IpLog.schema, function (errValidate, value) { 
        if (errValidate) {
            return reply(errValidate);
        }

        Async.auto({
            clean: function (done, results) {
                self.deleteOne(event, done);
            }, newLog: function (done, results) {

                self.insertOne(event, done);
            }
        }, (err, results) => {

            if (err) {
                return callback(err);
            }

            reply(null, event);
        });
    });
}

module.exports = IpLog;
