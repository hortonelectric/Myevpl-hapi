'use strict';

const Joi = require('joi');
const ObjectAssign = require('object-assign');
const BaseModel = require('hapi-mongo-models').BaseModel;
const bitcore = require('bitcore');
const btcmath = require('../btcmath');
const constants = require('../constants');

const Transaction = BaseModel.extend({
    constructor: function (attrs) {

        ObjectAssign(this, attrs);
    }
});


Transaction._collection = 'transactions';


Transaction.schema = Joi.object().keys({
    _id: Joi.object(),
    currency: Joi.string().required(),
    type: Joi.string(),
    createdAt: Joi.date(),
    userId: Joi.string(),
    address: Joi.string().required(),
	txid: Joi.string().required(),
    satoshi: Joi.number().integer().min(0)
});


Transaction.indexes = [
    { key: { 'currency': 1 } },
    { key: { 'type': 1 } },
    { key: { 'createdAt': -1 } },
    { key: { 'userId': -1 } },
    { key: { 'address': 1 } },
    { key: { 'txid': -1 } },
    { key: { 'satoshi': 1 } }
];



module.exports = Transaction;
