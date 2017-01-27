'use strict';

const Boom = require('boom');
const Async = require('async');
const Joi = require('joi');
const unirest = require('unirest');
const crypto = require('crypto');
const bitcore = require('bitcore');
const yaqrcode = require('yaqrcode');
const btcmath = require('../btcmath');
const constants = require('../constants');
const provable = require('../provably-fair');
const bignumber = require('bignumber.js');

const AuthPlugin = require('../auth');
// Load Chance
const Chance = require('chance');
const _ = require('lodash');

// Instantiate Chance so it can be used
const chance = new Chance();
const internals = {};

internals.applyRoutes = function (server, next) {

    const SourceDetail = server.plugins['hapi-mongo-models'].SourceDetail;
    const User = server.plugins['hapi-mongo-models'].User;
    const Status = server.plugins['hapi-mongo-models'].Status;

    const Account = server.plugins['hapi-mongo-models'].Account;
    const Transaction = server.plugins['hapi-mongo-models'].Transaction;


    const getAccount = function(request,reply) {
      const id = request.auth.credentials.roles.account._id.toString();

      Account.findById(id, (err, account) => {

          if (err) {
              return reply(err);
          }


          var update = {$set: {}};
          if (!account) {
              return reply(Boom.notFound('Document not found. That is strange.'));
          }


          if(Object.keys(update.$set).length) {

            Account.findByIdAndUpdate(id, update, (err, account) => {

                if (err) {
                    return reply(err);
                }

                return reply(account);
            });
          } else {
            return reply(account);
          }
      });
    };


    // server.route({
    //     method: 'GET',
    //     path: '/check-deposit',
    //     config: {
    //         auth: {
    //             strategy: 'simple',
    //             scope: 'account'
    //         },
    //         pre :[{
    //             method: getAccount,
    //             assign: 'account'
    //         }]
    //     },
    //     handler: function(request,reply) {
    //         Async.auto({
    //             bitcoin: function (done) {
    //
    //                 Account.getDepositAddress(request.pre.account,"bitcoin", (err,result) => {
    //                     if(err || !result) {
    //                         console.error(err);
    //                         return reply(Boom.badRequest('Unable to get bitcoin deposit address'));
    //                     }
    //
    //
    //
    //                     Account.findByIdValidateAndUpdate(request.pre.account._id, request.pre.account, done);
    //
    //                 });
    //                 
    //
    //             },
    //             burstcoin: function (done) {
    //
    //                 Account.getDepositAddress(request.pre.account,"burstcoin", (err,result) => {
    //                     if(err || !result) {
    //                         console.error(err);
    //                         return reply(Boom.badRequest('Unable to get burstcoin deposit address'));
    //                     }
    //
    //
    //                     Account.findByIdValidateAndUpdate(request.pre.account._id, request.pre.account, done);
    //
    //                 });
    //             }
    //         }, (err, results) => {
    //
    //             if (err) {
    //                 return reply(err);
    //             }
    //
    //             return reply(results.burstcoin);
    //         });            
    //     }
    // });

    // server.route({
    //     method: 'GET',
    //     path: '/deposit/{currency}',
    //     config: {
    //         auth: {
    //             strategy: 'simple',
    //             scope: 'account'
    //         },
    //         pre :[{
    //             method: getAccount,
    //             assign: 'account'
    //         }]
    //     },
    //     handler: function(request,reply) {
    //
    //         Account.getDepositAddress(request.pre.account,request.params.currency, (err,result) => {
    //             if(err || !result) {
    //                 console.error(err);
    //                 return reply(Boom.badRequest('Unable to get address'));
    //             }
    //             reply({address:result});
    //         });
    //     }
    // });


    // server.route({
    //     method: 'GET',
    //     path: '/send-chat',
    //     config: {
    //         auth: {
    //             strategy: 'simple',
    //             scope: 'account'
    //         },
    //         pre :[{
    //             method: getAccount,
    //             assign: 'account'
    //         }],            
    //         plugins: {
    //             'hapi-io': {
    //                 event: 'send-chat',
    //                 post: function(ctx,next) {
    //                     server.settings.app.chatHistory.push(ctx.data);
    //                     while(server.settings.app.chatHistory.length >= server.settings.app.game.chatHistoryLength) {
    //                         server.settings.app.chatHistory.shift();
    //                     }
    //                     ctx.io.emit('receive-chat',ctx.data);
    //                     next();
    //                 }
    //             }
    //         }
    //     },
    //     handler: function(request,reply) {
    //         reply();
    //     }
    // });

    // server.route({
    //     method: 'GET',
    //     path: '/qrcode/{data}',
    //     config: {},
    //       handler: function(request,reply) {
    //         const data = yaqrcode(request.params.data,{size:250});
    //         
    //         function decodeBase64Image(dataString) {
    //           var matches = dataString.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/),
    //             response = {};
    //
    //           if (matches.length !== 3) {
    //             return new Error('Invalid input string');
    //           }
    //
    //           response.type = matches[1];
    //           response.data = new Buffer(matches[2], 'base64');
    //
    //           return response;
    //         }
    //
    //         var imageBuffer = decodeBase64Image(data);     
    //         return reply(imageBuffer.data).type('image/gif');
    //         ;
    //       }
    //     });

    server.route({
      method: 'GET',
      path: '/account',
      // config: {
      //     auth: {
      //         strategy: 'simple',
      //         scope: 'account'
      //     },
      //     pre :[{
      //         method: getAccount,
      //         assign: 'account'
      //     }]
      //   },
      handler: function(request,reply) {
        request.pre.account.game = server.settings.app.game;
        return reply(request.pre.account);
      }
    });
    



    server.route({
        method: 'GET',
        path: '/accounts',
        config: {
            auth: {
                strategy: 'simple',
                scope: 'admin'
            },
            validate: {
                query: {
                    fields: Joi.string(),
                    sort: Joi.string().default('_id'),
                    limit: Joi.number().default(20),
                    page: Joi.number().default(1)
                }
            }
        },
        handler: function (request, reply) {

            const query = {};
            const fields = request.query.fields;
            const sort = request.query.sort;
            const limit = request.query.limit;
            const page = request.query.page;

            Account.pagedFind(query, fields, sort, limit, page, (err, results) => {

                if (err) {
                    return reply(err);
                }

                reply(results);
            });
        }
    });


    server.route({
        method: 'GET',
        path: '/accounts/{id}',
        config: {
            auth: {
                strategy: 'simple',
                scope: 'admin'
            }
        },
        handler: function (request, reply) {

            Account.findById(request.params.id, (err, account) => {

                if (err) {
                    return reply(err);
                }

                if (!account) {
                    return reply(Boom.notFound('Document not found.'));
                }

                reply(account);
            });
        }
    });

    server.route({
        method: 'POST',
        path: '/accounts',
        config: {
            auth: {
                strategy: 'simple',
                scope: 'admin'
            },
            validate: {
                payload: {
                    name: Joi.string().required()
                }
            }
        },
        handler: function (request, reply) {

            const name = request.payload.name;

            Account.create(name, (err, account) => {

                if (err) {
                    return reply(err);
                }

                reply(account);
            });
        }
    });


    server.route({
        method: 'PUT',
        path: '/accounts/{id}',
        config: {
            auth: {
                strategy: 'simple',
                scope: 'admin'
            }        },
        handler: function (request, reply) {

            const id = request.params.id;
            const update = {
                $set: request.payload
            };

            Account.findByIdAndUpdate(id, update, (err, account) => {

                if (err) {
                    return reply(err);
                }

                if (!account) {
                    return reply(Boom.notFound('Document not found.'));
                }

                reply(account);
            });
        }
    });


    server.route({
        method: 'PUT',
        path: '/accounts/my',
        config: {
            auth: {
                strategy: 'simple',
                scope: 'account'
            },
            validate: {
                payload: {
                    name: Joi.string().required()
                }
            }
        },
        handler: function (request, reply) {

            const id = request.auth.credentials.roles.account._id.toString();
            const update = {
                $set: {
                    name: request.payload.name
                }
            };
            const findOptions = {
                fields: Account.fieldsAdapter('user name timeCreated game')
            };

            Account.findByIdAndUpdate(id, update, findOptions, (err, account) => {

                if (err) {
                    return reply(err);
                }

                reply(account);
            });
        }
    });


    server.route({
        method: 'PUT',
        path: '/accounts/{id}/user',
        config: {
            auth: {
                strategy: 'simple',
                scope: 'admin'
            },
            validate: {
                payload: {
                    username: Joi.string().lowercase().required()
                }
            },
            pre: [{
                assign: 'account',
                method: function (request, reply) {

                    Account.findById(request.params.id, (err, account) => {

                        if (err) {
                            return reply(err);
                        }

                        if (!account) {
                            return reply(Boom.notFound('Document not found.'));
                        }

                        reply(account);
                    });
                }
            }, {
                assign: 'user',
                method: function (request, reply) {

                    User.findByUsername(request.payload.username, (err, user) => {

                        if (err) {
                            return reply(err);
                        }

                        if (!user) {
                            return reply(Boom.notFound('User document not found.'));
                        }

                        if (user.roles &&
                            user.roles.account &&
                            user.roles.account.id !== request.params.id) {

                            return reply(Boom.conflict('User is already linked to another account. Unlink first.'));
                        }

                        reply(user);
                    });
                }
            }, {
                assign: 'userCheck',
                method: function (request, reply) {

                    if (request.pre.account.user &&
                        request.pre.account.user.id !== request.pre.user._id.toString()) {

                        return reply(Boom.conflict('Account is already linked to another user. Unlink first.'));
                    }

                    reply(true);
                }
            }]
        },
        handler: function (request, reply) {

            Async.auto({
                account: function (done) {

                    const id = request.params.id;
                    const update = {
                        $set: {
                            user: {
                                id: request.pre.user._id.toString(),
                                name: request.pre.user.username
                            }
                        }
                    };

                    Account.findByIdAndUpdate(id, update, done);
                },
                user: function (done) {

                    const id = request.pre.user._id;
                    const update = {
                        $set: {
                            'roles.account': {
                                id: request.pre.account._id.toString(),
                                name: request.pre.account.name
                            }
                        }
                    };

                    User.findByIdAndUpdate(id, update, done);
                }
            }, (err, results) => {

                if (err) {
                    return reply(err);
                }

                reply(results.account);
            });
        }
    });


    server.route({
        method: 'DELETE',
        path: '/accounts/{id}/user',
        config: {
            auth: {
                strategy: 'simple',
                scope: 'admin'
            },
            pre: [{
                assign: 'account',
                method: function (request, reply) {

                    Account.findById(request.params.id, (err, account) => {

                        if (err) {
                            return reply(err);
                        }

                        if (!account) {
                            return reply(Boom.notFound('Document not found.'));
                        }

                        if (!account.user || !account.user.id) {
                            return reply(account).takeover();
                        }

                        reply(account);
                    });
                }
            }, {
                assign: 'user',
                method: function (request, reply) {

                    User.findById(request.pre.account.user.id, (err, user) => {

                        if (err) {
                            return reply(err);
                        }

                        if (!user) {
                            return reply(Boom.notFound('User document not found.'));
                        }

                        reply(user);
                    });
                }
            }]
        },
        handler: function (request, reply) {

            Async.auto({
                account: function (done) {

                    const id = request.params.id;
                    const update = {
                        $unset: {
                            user: undefined
                        }
                    };

                    Account.findByIdAndUpdate(id, update, done);
                },
                user: function (done) {

                    const id = request.pre.user._id.toString();
                    const update = {
                        $unset: {
                            'roles.account': undefined
                        }
                    };

                    User.findByIdAndUpdate(id, update, done);
                }
            }, (err, results) => {

                if (err) {
                    return reply(err);
                }

                reply(results.account);
            });
        }
    });


    server.route({
        method: 'POST',
        path: '/accounts/{id}/notes',
        config: {
            auth: {
                strategy: 'simple',
                scope: 'admin'
            },
            validate: {
                payload: {
                    data: Joi.string().required()
                }
            }
        },
        handler: function (request, reply) {

            const id = request.params.id;
            const update = {
                $push: {
                    notes: {
                        data: request.payload.data,
                        timeCreated: new Date(),
                        userCreated: {
                            id: request.auth.credentials.user._id.toString(),
                            name: request.auth.credentials.user.username
                        }
                    }
                }
            };

            Account.findByIdAndUpdate(id, update, (err, account) => {

                if (err) {
                    return reply(err);
                }

                reply(account);
            });
        }
    });


    server.route({
        method: 'POST',
        path: '/accounts/{id}/status',
        config: {
            auth: {
                strategy: 'simple',
                scope: 'admin'
            },
            validate: {
                payload: {
                    status: Joi.string().required()
                }
            },
            pre: [{
                assign: 'status',
                method: function (request, reply) {

                    Status.findById(request.payload.status, (err, status) => {

                        if (err) {
                            return reply(err);
                        }

                        reply(status);
                    });
                }
            }]
        },
        handler: function (request, reply) {

            const id = request.params.id;
            const newStatus = {
                id: request.pre.status._id.toString(),
                name: request.pre.status.name,
                timeCreated: new Date(),
                userCreated: {
                    id: request.auth.credentials.user._id.toString(),
                    name: request.auth.credentials.user.username
                }
            };
            const update = {
                $set: {
                    'status.current': newStatus
                },
                $push: {
                    'status.log': newStatus
                }
            };

            Account.findByIdAndUpdate(id, update, (err, account) => {

                if (err) {
                    return reply(err);
                }

                reply(account);
            });
        }
    });


    server.route({
        method: 'DELETE',
        path: '/accounts/{id}',
        config: {
            auth: {
                strategy: 'simple',
                scope: 'admin'
            },
            pre: [
                AuthPlugin.preware.ensureAdminGroup('root')
            ]
        },
        handler: function (request, reply) {

            Account.findByIdAndDelete(request.params.id, (err, account) => {

                if (err) {
                    return reply(err);
                }

                if (!account) {
                    return reply(Boom.notFound('Document not found.'));
                }

                reply({ message: 'Success.' });
            });
        }
    });


    next();
};


exports.register = function (server, options, next) {

    server.dependency(['auth', 'hapi-mongo-models'], internals.applyRoutes);

    next();
};


exports.register.attributes = {
    name: 'account'
};
