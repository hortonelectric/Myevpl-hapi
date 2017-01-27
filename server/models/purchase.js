'use strict';

const Joi = require('joi');
const ObjectAssign = require('object-assign');
const BaseModel = require('hapi-mongo-models').BaseModel;

const Purchase = BaseModel.extend({
    constructor: function (attrs) {

        ObjectAssign(this, attrs);
    }
});

Purchase._collection = 'purchases';
Purchase.schema = Joi.object().keys({
    _id: Joi.object(),
    timeCreated: Joi.date().required(),
    timeConfirmed: Joi.date(),
    canceled:Joi.boolean(),
    item: Joi.object().required(),
    buyerId: Joi.string().required(),
    sellerId: Joi.string().required(),
    type: Joi.string().required(),
    satoshiPrice: Joi.number().positive().integer().required(),
    satoshiApp: Joi.number().positive().integer().required(),
    satoshiSeller: Joi.number().positive().integer().required(),
    satoshiFee: Joi.number().positive().integer().required(),
    bitcoinAddressApp: Joi.string().required(),
    bitcoinAddressAppXPUB: Joi.string().required(),
    bitcoinAddressAppCount: Joi.number().integer().min(0).required(),
    bitcoinAddressSeller: Joi.string().required(),
    bitcoinReceiveTx: Joi.string(),
    bitcoinSendTx: Joi.string()
});
Purchase.indexes = [
    { key: { 'timeConfirmed': -1 } },
    { key: { 'bitcoinSendTx': -1 } }
];
 

Purchase.validateCreate = function(purchase,reply) {
    var self = this;
    Joi.validate(purchase, Purchase.schema, function (errValidate, value) { 
        if (errValidate) {
            return reply(errValidate);
        }

        self.insertOne(purchase, (err, purchase) => {

          if (err) {
              return reply(err);
          }
          reply(null,purchase);
        });
    });
}


Purchase.findByIdValidateAndUpdate = function(id,purchase,reply) {

    Joi.validate(purchase, Purchase.schema, function (errValidate, value) { 
        if (errValidate) {
            return reply(errValidate);
        }

        Purchase.findByIdAndUpdate(id, purchase, (err, purchase) => {

          if (err) {
              return reply(err);
          }
          reply(null,purchase);
        });
    });
}


module.exports = Purchase;
