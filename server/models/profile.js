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
    accountId: Joi.object(),
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
    // Joi.validate(document, Profile.schema, function (errValidate, value) {
    //     if (errValidate) {
    //         return reply(errValidate);
    //     }

      Profile.insertOne(document, (err, docs) => {
          if (err) {
              console.log(err);
              return reply(err);
          }
          reply(null, docs[0]);
      });
    // });
}

Profile.findByIdValidateAndUpdate = function(id,update,reply) {

    // Joi.validate(update, Profile.schema, function (errValidate, value) {
    //     if (errValidate) {
    //         return reply(errValidate);
    //     }

        Profile.findByIdAndUpdate(id, update, (err, profile) => {

          if (err) {
              return reply(err);
          }
          reply(null,profile);
        });
    // });
}


module.exports = Profile;
