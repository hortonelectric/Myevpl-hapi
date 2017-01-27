'use strict';

const Joi = require('joi');
const ObjectAssign = require('object-assign');
const BaseModel = require('hapi-mongo-models').BaseModel;
const StatusEntry = require('./status-entry');
const Purchase = require('./purchase');
const NoteEntry = require('./note-entry');
const Wallet = require('./wallet');
const bitcore = require('bitcore');
const btcmath = require('../btcmath');
const constants = require('../constants');
const _ = require('lodash');
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
    withdrawWallets: Joi.array().items(Wallet.schema),
    depositWallets: Joi.array().items(Wallet.schema),
    lastBalanceCheck: Joi.date(),
    lastNewAddress: Joi.date(),
    timeCreated: Joi.date(),
    level: Joi.number().min(0).integer(),
    xp: Joi.number().integer().min(0),
	isMuted: Joi.boolean(),
	isIgnored: Joi.boolean(),
	isBanned: Joi.boolean(),
	isDisabled: Joi.boolean()
});


Account.indexes = [
    { key: { 'user.id': 1 } },
    { key: { 'user.name': 1 } },
    { key: { 'withdrawWallets.balance': -1 } },
    { key: { 'withdrawWallets.currency': 1 } },
    { key: { 'withdrawWallets.address': -1 } },
    { key: { 'withdrawWallets.lastBalanceCheck': -1 } },
    { key: { 'withdrawWallets.lastNewAddress': -1 } },
    { key: { 'depositWallets.balance': -1 } },
    // { key: { 'depositWallets.currency': 1, 'depositWallets.height': 1 }, unique:true },
    { key: { 'depositWallets.currency': 1 } },
    { key: { 'depositWallets.address': -1 } },
    { key: { 'depositWallets.lastBalanceCheck': -1 } },
    { key: { 'depositWallets.lastNewAddress': -1 } }
];


Account.checkTxBitcoin = function(account, callback) {      
  var addresses = [];
  for (var w in account.depositWallets) {
    if(depositWallets[w].currency === "bitcoin") {
      addresses.push(depositWallets[w].address);
    }
  }
  var options = "https://blockexplorer.com/api/addrs/"+addresses.join(",")+"/txs";
  console.log("all txs",options);
  unirest.get(options)
  .send()
  .timeout(10000)
  .end(function (response) {
    if(!response.body || !response.body.items) {
        console.log("nothing in response");
        return callback("nothing in response");
    }
    for(var i=0;i<response.body.items.length;i++) {
      var txresponse = response.body.items[i];
      console.log("incoming payment tx", txresponse.txid);

      if(txresponse.isCoinBase && txresponse.confirmations < 100) {
          // do nothing
          continue;
      } else if(txresponse.confirmations > 0) {

        var totalValue = 0;

        var thisDeposit = undefined;
        for(var x=0;x<txresponse.vout.length;x++) {
          if(txresponse.vout[x].scriptPubKey.addresses.length > 1) {
              return callback({err:"Error code 1. Please report this error code to the support staff."});
          }   
          var thisAddr = txresponse.vout[x].scriptPubKey.addresses[0];
          thisDepositWallet = _.find(depositWallets,{address:thisAddr});
          // this is just double checking to make sure this is actually the right address and wallet
          if(thisDepositWallet && thisAddr === thisDepositWallet.address) {           
            thisDeposit =  {
              txid: txresponse.txid,
              createdAt: new Date(),
              address: thisAddr,
              userId: account._id,
              satoshi: btcmath.fromBTC(txresponse.vout[x].value)
            };

            break; 
          }                    
        }
        if(!thisDeposit) {
          return callback("This transaction has nothing to do with the game.");
        }   
        Async.auto({
          checkTx: function(done) {
              Transaction.find({type:"deposit",txid:thisDeposit.txid}, function(err,result) {
                if(result) {
                  console.log("This transaction has already been counted. Skipping",thisDeposit);
                }                        
              });                    
          },
          processDeposit: function(done,results) {
            // don't do anything
            if(results.checkTx) {
              return false;
            }
            var sellerAccount = results.sellerAccount;
            var hdPrivateKey = new bitcore.HDPrivateKey.fromSeed(constants.SEEDHEX);
            var hard = hdPrivateKey.derive("m/0'/0");
            var xpubPRIVKEY = hard.derive("m/"+thisDepositWallet.height, bitcore.Networks.livenet);                      

            sendTx(thisDeposit.address,thisDeposit.amount,constants.HOT,constants.COLD,xpubPRIVKEY.privateKey.toString(), function(transaction) {
              if(transaction.err) {
                  console.log("transaction err", transaction.err);
                  return done(transaction.err);
              }
              console.log("sent",transaction.hash);
              thisDeposit.houseTx = transaction.hash;

              Transaction.create(thisDeposit, (err, deposit) => {

                if (err) {
                    console.error("error sending TX to house, not crediting deposit.",thisDeposit);
                    return done(err);
                }      
                // THIS IS WHERE THE USER'S ACCOUNT BALANCE ACTUALLY GETS UPDATED
                for (var i in account.withdrawWallets) {
                  if(account.withdrawWallets[i].currency === "bitcoin") {
                    account.withdrawWallets[i].balance += thisDeposit.satoshi;
                  }
                }
                for(var i in account.depositWallets) {
                  if(account.depositWallets[i].address === thisDeposit.address) {
                    account.depositWallets[i].totalSatoshiReceived += thisDeposit.satoshi;
                  }
                }
                Account.findByIdValidateAndUpdate(account._id,account, function(err) {
                    if(err) {
                        return done("FAILED AT BUYER ACCOUNT UPDATE");
                    }
                    return done();
                });
              });
            });
          }
        }, (err, results) => {

          if (err) {
              console.log(err);
              return false;
          }

          return true;
        });   
      }                                    
    };
    return callback();                              
  },function(error) {
      console.log("ERROR BLOCKCHAIN");        
      return callback("BLOCKCHAIN FETCH ERROR");              
  });
};


Account.create = function (name, withdrawWallets, callback) {
    
     const document = {
        name: name,
        timeCreated: new Date(),
        level: 0,
        xp: 0,
        depositWallets: [],
		isMuted: false,
		isIgnored: false,
		isBanned: false,
		isDisabled: false
    };

    var newWallets = [];
    for(var i in withdrawWallets) {

        newWallets.push({
            currency: i,
            height: 0, // for validation
            balance: 0,
            address: withdrawWallets[i]
        });
    }
    if(newWallets.length > 0) { document.withdrawWallets = newWallets; }
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

Account.getDepositAddress = function(account,currency,reply) {
    var HDPrivateKey = bitcore.HDPrivateKey;
    var HDPublicKey = bitcore.HDPublicKey;
    var Address = bitcore.Address;
    var Networks = bitcore.Networks;
    var hdPrivateKey = new HDPrivateKey.fromSeed(constants.SEEDHEX);
    var hard = hdPrivateKey.derive("m/0'/0");

    Account.findOne({"depositWallets.currency":currency}, {sort:{"depositWallets.height": -1},limit:1}, (err,results) => {
        var derivedAddress;
        var i = 1;
        var walletFound = false;

        if(results) {
            var map = _.map(results.depositWallets,'height');
            map.push(1); // in case it's empty
            i = _.max(map)+1;            
        }

        derivedAddress = new Address(hard.derive("m/"+i).publicKey, Networks.livenet);
        console.log("child address of m/0'/0 with index "+i,derivedAddress.toString());

        account.depositWallets.push({createdAt: new Date(),currency: currency,height: i,address: derivedAddress.toString()});
        Account.findByIdValidateAndUpdate(account._id, account, (err,result) => {
            if(err || !result) {
                console.error(err);
                return reply({msg:"Error adding address"});
            }
            return reply(null,derivedAddress.toString());
        });            
    });
};

Account.balance = function(id, amount, callback) {
  if(!amount || isNaN(amount)) {
    console.error('amount NaN or not found')
    return callback('amount NaN or not found')
  }
  Account.findById(id, function(err, account) {
    if(err || !account) {
      console.error('account not found')
      return callback(err)
    }

    // THIS IS WHERE THE USER'S ACCOUNT BALANCE ACTUALLY GETS UPDATED
    for (var i in account.withdrawWallets) {
      if(account.withdrawWallets[i].currency === 'burstcoin') {
        account.withdrawWallets[i].balance += amount;
      }
    }
    Account.findByIdAndUpdate(id, account, function(err,result) {
      if(err || !result) {
        return callback(err)
      }
      callback(null, result)
    })
  })
};
Account.findByUsername = function (username, callback) {

    const query = { 'user.name': username.toLowerCase() };
    this.findOne(query, callback);
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

module.exports = Account;
