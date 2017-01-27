'use strict';

const Confidence = require('confidence');


const criteria = {
    env: process.env.NODE_ENV
};


const config = {
    $meta: 'This file configures the plot device.',
    projectName: 'mtb',
    port: {
        web: {
            $filter: 'env',
            test: 9000,
            $default: 8000
        }
    },
    authAttempts: {
        forIp: 5000,
        forIpAndUser: 700
    },
    hapiMongoModels: {
        $filter: 'env',
        production: {
            mongodb: {
                url: process.env.MONGOLAB_URI
            },
            autoIndex: false
        },
        test: {
            mongodb: {
                url: 'mongodb://localhost:27017/mtb-test'
            },
            autoIndex: true
        },
        $default: {
            mongodb: {
                url: 'mongodb://localhost:27017/mtb'
            },
            autoIndex: true
        }
    },
    nodemailer: {
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
            user: 'art@email.com',
            pass: ''
        }
    },
    system: {
        fromAddress: {
            name: 'mtb',
            address: 'art@email.com'
        },
        toAddress: {
            name: 'mtb',
            address: 'art@email.com'
        }
    }
};


const store = new Confidence.Store(config);


exports.get = function (key) {

    return store.get(key, criteria);
};


exports.meta = function (key) {

    return store.meta(key, criteria);
};
