var polo = require("poloniex-unofficial");

var getPair = function(pair,price,cb) {

	// Get access to the public API
	var poloPublic = new polo.PublicWrapper();

	// Return a list of currencies supported by Poloniex
	poloPublic.returnTicker((err, response) => {
	    if (err) {
	        // Log error message
	        console.error("An error occurred while getting exchange rates: " + err.msg);
	        return cb(err,null);
	    } else {
					 // Log response
					// "BTC_LTC":{"last":"0.0251","lowestAsk":"0.02589999","highestBid":"0.0251","percentChange":"0.02390438",
					// "baseVolume":"6.16485315","quoteVolume":"245.82513926"},"BTC_NXT":{"last":"0.00005730","lowestAsk":"0.00005710",
					// "highestBid":"0.00004903","percentChange":"0.16701570","baseVolume":"0.45347489","quoteVolume":"9094"}	        
	        if(price) {
		        return cb(null,response[pair][price]);
	        } else if(pair) {
	        	return cb(null,response[pair]);
	        } else {
	        	return cb(null,response);
	        }
	    }
	});
};

module.exports = {
    getPair: getPair
};
