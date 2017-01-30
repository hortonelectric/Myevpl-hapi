'use strict';

const Joi = require('joi');
const ObjectAssign = require('object-assign');
const BaseModel = require('hapi-mongo-models').BaseModel;
const StatusEntry = require('./status-entry');
const NoteEntry = require('./note-entry');


const Account = BaseModel.extend({
    constructor: function (attrs) {

        ObjectAssign(this, attrs);
    }
});


Account._collection = 'accounts';


Account.schema = Joi.object().keys({
    _id: Joi.object(),
    user: Joi.object().keys({
        id: Joi.string().required(),
        name: Joi.string().lowercase().required()
    }),
    name: Joi.string().required(),
    status: Joi.object().keys({
        current: StatusEntry.schema,
        log: Joi.array().items(StatusEntry.schema)
    }),
    notes: Joi.array().items(NoteEntry.schema),
    verification: Joi.object().keys({
        complete: Joi.boolean(),
        token: Joi.string()
    }),
    timeCreated: Joi.date()
});


Account.indexes = [
    { key: { 'user.id': 1 } },
    { key: { 'user.name': 1 } }
];


Account.create = function (payload, callback) {

    const document = {
        name: payload.name,
        email: payload.email,
        timeCreated: new Date()
    };


    Joi.validate(document, Account.schema, function (errValidate, value) { 

        if (errValidate) {
            console.log(errValidate);
            return callback(errValidate);
        }        

        Account.insertOne(document, (err, docs) => {
            if (err) {
                console.log(err);
                return callback(err);
            }
            callback(null, docs[0]);
        });

    });
};

Account.findByIdValidateAndUpdate = function(id,update,reply) {

    Joi.validate(update, Account.schema, function (errValidate, value) { 
        if (errValidate) {
            return reply(errValidate);
        }

        Account.findByIdAndUpdate(id, update, (err, account) => {

          if (err) {
              return reply(err);
          }
          reply(null,account);
        });
    });
}


Account.findByUsername = function (username, callback) {

    const query = { 'user.name': username.toLowerCase() };
    this.findOne(query, callback);
};


module.exports = Account;
