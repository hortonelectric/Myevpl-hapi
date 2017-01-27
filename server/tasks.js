'use strict';
const bitcore = require('bitcore');
const unirest = require('unirest');
const btcmath = require('./btcmath');
const _ = require("lodash");

// THIS SCRIPT IS EXPERIMENTAL! USE IT AT YOUR OWN RISK!
// seed hex:  9cc4cdd047338f19ad6daf2c76636917ca3eff4ad1ca0c56a4030fdded8a42819d3c3cd067d1a125a3c2887f8ee027970b3ea94c2582ebc135e929ab139134b1
// main private key:  eb6cf323cd832c0ae02bc9bd4c6b71e95d40cfbb178bab49103df2e9f2c3600c
// main public key:  1MRi6nz9A9EWs3gDxwH733YJcYVf1woJQM
// hardened xprv hash m/0'/0:  xprv9wRjJ24hLAQxAdJSXYtUMHxCdGdLV2zXu9WopjX8rpvVg5XtBP1V966jmrd9347AyvRLR347DiYLVHDmEDyYRQoJCHnxGXgJqsXN1FThiKC
// hardened private key m/0'/0:  47b795e9c301cc426081618501a360d78931fe0f97452c7d5f4a4d608f6ad522
// hardened public key m/0'/0:  12PwfJCM4VKpeMLzcrtyihnf2f2JpRJBr9
// hardened xpub hash m/0'/0 xpub6AR5hXbbAXyFP7NudaRUiRtwBJTptViPGNSQd7vkRATUYss2ivKjgtRDdAmxLk6SgtzTdGDkUnT4ekGThcvrdNLuS5TCmu8x2a9MfMGs25q
// child address of m/0'/0 with index 1 1CmFKaycbZLeZnYr3eJ83GPBvdyWjJ5snN
// child address of m/0'/0 with index 2 14A9xDBzbcuGiKGtkGiZHsbBhWkKc5FYn2
// Put the 'derived public key' into the secrets.js config file, and save the other information for later in a SAFE place.

const Async = require('async');
const SEEDHEX = "9cc4cdd047338f19ad6daf2c76636917ca3eff4ad1ca0c56a4030fdded8a42819d3c3cd067d1a125a3c2887f8ee027970b3ea94c2582ebc135e929ab139134b1";
const XPUBKEY = "xpub6AR5hXbbAXyFP7NudaRUiRtwBJTptViPGNSQd7vkRATUYss2ivKjgtRDdAmxLk6SgtzTdGDkUnT4ekGThcvrdNLuS5TCmu8x2a9MfMGs25q";
const XWITHDRAWALSOURCE = "1MRi6nz9A9EWs3gDxwH733YJcYVf1woJQM";
const XHOUSE = "1ALPXbbmHec8F6h3gmFCo2vds6em3uoRzL";
const XWITHDRAWALSOURCE_PRIVKEY = "eb6cf323cd832c0ae02bc9bd4c6b71e95d40cfbb178bab49103df2e9f2c3600c";

const CHECK_BALANCE_LIMIT_MINUTES = 1;
const FEE = 20000;
const MINCASHOUT = 15460;

const polo = require('./lib/polo.js');

exports.register = function (server, options, next) {


    const Account = server.plugins['hapi-mongo-models'].Account;


		const sendTx = function(fromAddress,amountToSend,toAddress,changeAddress,privateKeyString, callback) {
			var args = {
				fromAddress: fromAddress,
				amountToSend: amountToSend,
				toAddress: toAddress,
				changeAddress: changeAddress,
				privateKeyString: privateKeyString, 
				callback: callback
			};
			console.log("To:",toAddress,"Change:",changeAddress,"amount:",amountToSend);
			var options = "https://blockexplorer.com/api/addr/"+fromAddress+"/utxo";

			unirest.get(options)
			.send()
			.end(function (response) {
				var resbody = response.body;
				var utxos = [];
				var availableAmount = 0;

				for(var i=0;i<response.body.length;i++) {
					var thistx = response.body[i];
					var txout = {
					  "txId" : thistx.txid,
					  "vout" : thistx.vout,
					  "address" : thistx.address,
					  "scriptPubKey" : thistx.scriptPubKey,
					  "amount" : thistx.amount,
					  "fees": btcmath.toBTC(FEE)
					};
					if(true || thistx.confirmations && thistx.confirmations > 0) {
						availableAmount += btcmath.fromBTC(thistx.amount);
						utxos.push(new bitcore.Transaction.UnspentOutput(txout));
					}
				}

				if(availableAmount <  args.amountToSend) {
					return callback( {err:"insufficient funds"});//self.view("app", {secret:secret,err: "insufficient funds"});
				}

				try {
					var toAddress = new bitcore.Address(args.toAddress);
					var privateKey = new bitcore.PrivateKey(args.privateKeyString);
					var changeAddress = new bitcore.Address(args.changeAddress);


					var transaction = new bitcore.Transaction()
				    .from(utxos)          // Feed information about what unspent outputs one can use
				    .to(toAddress, args.amountToSend)  // Add an output with the given amount of satoshis
				    .change(args.changeAddress)      // Sets up a change address where the rest of the funds will go
				    .sign(privateKey);     // Signs all the inputs it can
					var hash = transaction.toObject().hash;
					var serialized = transaction.serialize();
					console.log(serialized);
					unirest.post("http://btc.blockr.io/api/v1/tx/push")
					.send({hex:serialized})
					.end(function (response) {
						// console.log(response.body,"btcblockr");
						unirest.post("https://api.coinprism.com/v1/sendrawtransaction")
						.send(serialized)
						.end(function (response) {	
							// console.log(response.body);	
							unirest.post("https://blockchain.info/pushtx")
							.send({tx:serialized})
							.end(function (response) {	
								// console.log(response.body);	
										
							});						
						});
					});
					return callback(transaction.toObject());
				} catch(e) {
					console.log(e);
					return callback({err: e});
				}

			});		
		};


    server.method("exchangeRates",function (request, reply) {
    	// console.log("CHECKING TXs");
    	Async.auto({
    			checkRates: function(callback) {
    				polo.getPair(null,null, function(err,rates){
    					if(err || !rates) {
    						console.error(err);
    						return false;
    					}
    					server.settings.app.exchangeRates = rates;
    					console.log("BTC/USD Exchange Rate: $"+ rates["USDT_BTC"].highestBid);
    					console.log("BTC/BURST Exchange Rate: BTC "+ rates["BTC_BURST"].highestBid);
    				});  				
    			}
    		
    	}, (err, results) => {

	      if (err) {
	          return reply(err);
	      }

	      return reply(null);
	    }); 
    });


    next();
};


exports.register.attributes = {
    name: 'tasks'
};
