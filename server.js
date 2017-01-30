'use strict';

const corsHeaders = require('hapi-cors-headers');
const Composer = require('./index');


Composer((err, server) => {

    if (err) {
        throw err;
    }

    server.ext('onPreResponse', corsHeaders);
    server.start(() => {

        console.log('Started the plot device on port ' + server.info.port);
    });
});
