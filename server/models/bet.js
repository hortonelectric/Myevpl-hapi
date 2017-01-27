'use strict';

const Joi = require('joi');
const ObjectAssign = require('object-assign');
const BaseModel = require('hapi-mongo-models').BaseModel;

const Bet = BaseModel.extend({
    constructor: function (attrs) {

        ObjectAssign(this, attrs);
    }
});


Bet._collection = 'bets';


Bet.schema = Joi.object().keys({
    _id: Joi.object(),
    userId: Joi.string().required(),
    satoshiBet: Joi.number().integer().required(),
    createdAt: Joi.date().required(),
    cashoutAt: Joi.date(),
    cashoutMultiplier: Joi.number().integer(),
    autoCashout: Joi.number().required(),
    satoshiWon: Joi.number().integer().required(),
    bonus: Joi.number(),
    roundId: Joi.string().required(),
    wasCanceled: Joi.boolean()
});


Bet.indexes = [
    { key: { 'userId': 1 } },
    { key: { 'roundId': 1 } },
    { key: { 'userId': 1, 'roundId': 1 }, unique:true },
    { key: { 'userId': 1, 'roundId': 1, 'cashoutAt': -1 } },
    { key: { 'cashoutAt': 1 } },
    { key: { 'wasCanceled': 1 } },
    { key: { 'createdAt': -1 } }
];


Bet.create = function (bet, callback) {
    
    bet.createdAt = new Date()
    bet.satoshiWon = 0;

    Joi.validate(bet, Bet.schema, function (errValidate, value) { 
        if (errValidate) {
            console.log(errValidate);
            return callback(errValidate);
        }
        Bet.insertOne(bet, (err, docs) => {

            if (err) {
                console.log(err);
                return callback(err);
            }

            callback(null, docs[0]);
        });
    });
};


Bet.cashout = function(userId, roundId, cashoutMultiplier, callback) {
    Bet.findOne({userId: userId,roundId: roundId, cashoutAt: {$exists:false}}, function(err,bet) {
        console.log(userId,roundId)
        if(err || !bet) {
            return callback(err,null);
        }
            console.log('the bet',bet);
        bet.cashoutAt = new Date();
        bet.cashoutMultiplier = cashoutMultiplier;
        console.log((100+bet.cashoutMultiplier)/100,bet.satoshiBet);
        bet.satoshiWon = Math.floor((100+bet.cashoutMultiplier)/100*bet.satoshiBet);

        Bet.findByIdValidateAndUpdate(bet._id,bet,function() {
            return callback(null,bet);
        });
    });
};



Bet.findByIdValidateAndUpdate = function(id,bet,reply) {

    Joi.validate(bet, Bet.schema, function (errValidate, value) { 
        if (errValidate) {
            return reply(errValidate);
        }

        Bet.findByIdAndUpdate(id, bet, (err, bet) => {

          if (err) {
              return reply(err);
          }
          reply(null,bet);
        });
    });
}

module.exports = Bet;
