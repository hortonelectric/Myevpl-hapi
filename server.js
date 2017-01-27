'use strict';

const Composer = require('./index');
const corsHeaders = require('hapi-cors-headers');

Composer((err, server) => {

    if (err) {
        throw err;
    }
    server.ext('onPreResponse', corsHeaders);

   
	    server.start(() => {

	    		server.methods.exchangeRates();

	        console.log('Started the mtb device on port ' + server.info.port);
	    });

});
