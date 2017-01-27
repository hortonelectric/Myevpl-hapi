'use strict';

const Joi = require('joi');
const ObjectAssign = require('object-assign');
const BaseModel = require('hapi-mongo-models').BaseModel;
const bitcore = require('bitcore');
const btcmath = require('../btcmath');
const constants = require('../constants');

const Wallet = BaseModel.extend({
    constructor: function (attrs) {

        ObjectAssign(this, attrs);
    }
});


Wallet._collection = 'wallets';


Wallet.schema = Joi.object().keys({
    _id: Joi.object(),
    currency: Joi.string().required(),
    type: Joi.string(),
    createdAt: Joi.date(),
    userId: Joi.string(),
    address: Joi.string().required().allow(''),
	height: Joi.number().integer().required(),
    balance: Joi.number().integer().min(0),    
    lastBalanceCheck: Joi.date(),
    totalSatoshiReceived: Joi.number().integer()
});


Wallet.indexes = [
    { key: { 'currency': 1 } },
    { key: { 'height': 1 } },
    { key: { 'address': 1 } },
    { key: { 'lastBalanceCheck': -1 } },
    { key: { 'balance': 1 } }
];



module.exports = Wallet;
