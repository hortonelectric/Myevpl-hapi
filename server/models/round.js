'use strict';

const Joi = require('joi');
const ObjectAssign = require('object-assign');
const BaseModel = require('hapi-mongo-models').BaseModel;
const baseBlockIndex = 450000;
var crypto = require('crypto');

const provable = require('../provably-fair.js');

const Round = BaseModel.extend({
    constructor: function (attrs) {

        ObjectAssign(this, attrs);
    }
});


Round._collection = 'rounds';


Round.schema = Joi.object().keys({
    _id: Joi.object(),
    createdAt: Joi.date(), // for the record, auto gen by mongo
    beganAt: Joi.date(), // for the game itself, not the record
    finishedAt: Joi.date(), // for the game itself, not the record
    status: Joi.string(),
    secretSeed: Joi.string().required(),
    secretHash: Joi.string().required(), 
    result: Joi.number().integer(),
    bitcoinBlockIndex: Joi.number().integer().required(),
    bitcoinBlockHash: Joi.string(),
    error: Joi.string(),
});


Round.indexes = [
    { key: { 'createdAt': -1 } },
    { key: { 'beganAt': -1 } },
    { key: { 'finishedAt': -1 } },
    { key: { 'status': 1 } }
];


Round.create = function (callback) {
    

    Round.count(function(err,count) {
        if(err) {
            return callback(err,null);
        }

        const bitcoinBlockIndex = baseBlockIndex+count;
        var secretSeed = provable.getRandomSeed();
        var secretHash = provable.sha256sum(secretSeed+bitcoinBlockIndex);

        const document = {
            createdAt: new Date(),
            status: 'created',
            bitcoinBlockHash: provable.getRandomSeed(), // only fr testing
            bitcoinBlockIndex: bitcoinBlockIndex,
            secretSeed: secretSeed,
            secretHash: secretHash
        };

        Joi.validate(document, Round.schema, function (errValidate, value) { 
            if (errValidate) {
                console.log(errValidate);
                return callback(errValidate);
            }        
            Round.insertOne(document, (err, docs) => {

                if (err) {
                    console.log(err);
                    return callback(err);
                }
                callback(null, docs[0]);
            });
        });
    });
};

Round.bust = function(roundId, callback) {
    Round.findById(roundId, function(err,round) {
        if(err || !round) {
            return callback(err,null);
        }
        round.status = 'finished';


        Round.findByIdValidateAndUpdate(round._id,round,function() {
            return callback(null,round);
        });
    });
};


Round.begin = function(callback) {
    Round.findOne({status:'created',bitcoinBlockHash:{$exists:true}}, function(err,round) {
        if(err || !round) {
            return callback(err,null);
        }
        round.status = 'began';
        round.result = "";


        var hmachash = crypto.createHmac('sha512', round.secretHash);
        hmachash.update(round.bitcoinBlockHash);
        var hash = hmachash.digest("hex");

        function divisible(hash, mod) {
            // So ABCDEFGHIJ should be chunked like  AB CDEF GHIJ
            var val = 0;

            var o = hash.length % 4;
            for (var i = o > 0 ? o - 4 : 0; i < hash.length; i += 4) {
                val = ((val << 16) + parseInt(hash.substring(i, i+4), 16)) % mod;
            }

            return val === 0;
        }
        // In 1 of 101 games the game crashes instantly.
        if (divisible(hash, 101)) {
            round.result = 0;
        } else {

            // Use the most significant 52-bit from the hash to calculate the crash point
            var h = parseInt(hash.slice(0,52/4),16);
            var e = Math.pow(2,52);

            round.result = Math.floor((100 * e - h) / (e - h));  
        }
        Round.findByIdValidateAndUpdate(round._id,round,function() {

            return callback(null,round);
        });
    });
};



Round.findByIdValidateAndUpdate = function(id,round,reply) {

    Joi.validate(round, Round.schema, function (errValidate, value) { 
        if (errValidate) {
            return reply(errValidate);
        }

        Round.findByIdAndUpdate(id, round, (err, round) => {

          if (err) {
              return reply(err);
          }
          reply(null,round);
        });
    });
}

module.exports = Round;
