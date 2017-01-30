'use strict';

const Confidence = require('confidence');
const Config = require('./config');


const criteria = {
    env: process.env.NODE_ENV
};

const gameConfig = {
  currentVersion: "0.0.1",
  chatHistoryLength: 40,
  paused: false
};


const manifest = {
    $meta: 'This file defines the burst game.',
    server: {
        debug: {
            request: ['error']
        },
        connections: {
            routes: {
                security: true
            }
        },
        app: {
          game: gameConfig,
          chatHistory: [],
          round: {},
          exchangeRates: {},
          gameHistory: [],
          players: {}
        }
    },
    connections: [{
        port: Config.get('/port/web'),
        labels: ['web']
    }],
    registrations: [
        {
            plugin: 'hapi-auth-basic'
        },
        {
            plugin: 'lout'
        },
        {
            plugin: 'inert'
        },
        {
            plugin: 'vision'
        },
        {
            plugin: {
                register: 'hapi-job-queue',
                options: {
                    connectionUrl: "mongodb://localhost:27017/myevpl",

                    jobs: [
                      {
                        name: 'check-exchange-rates',
                        enabled: true,
                        cron: "300",
                        concurrentTasks:1,
                        cronSeconds: true,
                        method: 'exchangeRates', //server method 
                        tasks: [ // each task will run with the task as the data property 
                          {
                            group: 'exchangeRates'
                          }
                        ]
                      }
                    ]
                }
            }
        },
        {
            plugin: {
                register: 'hapi-swagger',
                options: {
                    info: {
                        'title': 'API Documentation',
                        'version': '1.0.0'
                    }
                }
            }    
        },    
        {
            plugin: {
                register: 'good',
                options: {
                    ops: {
                        interval: 60000
                    },
                    reporters: {
                        myConsoleReporter: [{
                            module: 'good-squeeze',
                            name: 'Squeeze',
                            args: [{ log: '*', response: '*' }]
                        }, {
                            module: 'good-console'
                        }, 'stdout'],
                        myFileReporter: [{
                            module: 'good-squeeze',
                            name: 'Squeeze',
                            args: [{ ops: '*' }]
                        }, {
                            module: 'good-squeeze',
                            name: 'SafeJson'
                        }, {
                            module: 'good-file',
                            args: ['./log.txt']
                        }],
                        myHTTPReporter: [{
                            module: 'good-squeeze',
                            name: 'Squeeze',
                            args: [{ error: '*' }]
                        }, {
                            module: 'good-http',
                            args: ['http://prod.logs:3000', {
                                wreck: {
                                    headers: { 'x-api-key': 12345 }
                                }
                            }]
                        }]
                    }
                }
            }
        },       
        {
            plugin: {
                register: 'visionary',
                options: {
                    engines: { jade: 'jade' },
                    path: './server/web'
                }
            }
        },
        {
            plugin: {
                register: 'hapi-mongo-models',
                options: {
                    mongodb: Config.get('/hapiMongoModels/mongodb'),
                    models: {
                        Account: './server/models/account',
                        AdminGroup: './server/models/admin-group',
                        Admin: './server/models/admin',
                        AuthAttempt: './server/models/auth-attempt',
                        Session: './server/models/session',
                        Status: './server/models/status',
                        IpLog: './server/models/ipLog',
                        Profile: './server/models/profile',
                        User: './server/models/user'
                    },
                    autoIndex: Config.get('/hapiMongoModels/autoIndex')
                }
            }
        },
        {
            plugin: './server/tasks'
        },
        {
            plugin: './server/auth'
        },
        {
            plugin: './server/mailer'
        },
        {
            plugin: {
                register: 'hapi-io'
            }
        },        
        {
            plugin: './server/api/game',
            options: {
                routes: { prefix: '/api' }
            }
        },
        {
            plugin: './server/api/accounts',
            options: {
                routes: { prefix: '/api' }
            }
        },
        {
            plugin: './server/api/admin-groups',
            options: {
                routes: { prefix: '/api' }
            }
        },
        {
            plugin: './server/api/admins',
            options: {
                routes: { prefix: '/api' }
            }
        },
        {
            plugin: './server/api/auth-attempts',
            options: {
                routes: { prefix: '/api' }
            }
        },
        {
            plugin: './server/api/contact',
            options: {
                routes: { prefix: '/api' }
            }
        },
        {
            plugin: './server/api/index',
            options: {
                routes: { prefix: '/api' }
            }
        },
        {
            plugin: './server/api/login',
            options: {
                routes: { prefix: '/api' }
            }
        },
        {
            plugin: './server/api/logout',
            options: {
                routes: { prefix: '/api' }
            }
        },
        {
            plugin: './server/api/sessions',
            options: {
                routes: { prefix: '/api' }
            }
        },
        {
            plugin: './server/api/signup',
            options: {
                routes: { prefix: '/api' }
            }
        },
        {
            plugin: './server/api/statuses',
            options: {
                routes: { prefix: '/api' }
            }
        },
        {
            plugin: './server/api/users',
            options: {
                routes: { prefix: '/api' }
            }
        },
        {
            plugin: './server/web/index'
        }
    ]
};


const store = new Confidence.Store(manifest);


exports.get = function (key) {

    return store.get(key, criteria);
};


exports.meta = function (key) {

    return store.meta(key, criteria);
};
