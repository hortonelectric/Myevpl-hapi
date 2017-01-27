'use strict';

const Boom = require('boom');
const Joi = require('joi');
const Async = require('async');
const Config = require('../../config');

const bitcore = require('bitcore');

const internals = {};


internals.applyRoutes = function (server, next) {

    const Account = server.plugins['hapi-mongo-models'].Account;
    const Session = server.plugins['hapi-mongo-models'].Session;
    const User = server.plugins['hapi-mongo-models'].User;
    const IpLog = server.plugins['hapi-mongo-models'].IpLog;


    server.route({
        method: 'POST',
        path: '/signup',
        config: {
            validate: {
                payload: {
                    name: Joi.string().required(),
                    email: Joi.string().email().lowercase().required(),
                    username: Joi.string().token().lowercase().required(),
                    password: Joi.string().required(),
                    withdrawWallets: Joi.object()
                }
            },
            pre: [{
                assign: 'usernameCheck',
                method: function (request, reply) {

                    const conditions = {
                        username: request.payload.username
                    };

                    User.findOne(conditions, (err, user) => {

                        if (err) {
                            return reply(err);
                        }

                        if (user) {
                            return reply(Boom.conflict('Username already in use.'));
                        }

                        reply(true);
                    });
                }
            }, {
                assign: 'ipCheck',
                method: function(request,reply) {
                    const ip = request.headers['x-forwarded-for'] || request.info.remoteAddress;
                    if(!ip) {
                        return reply(Boom.badRequest("You already have an account."));
                    }
                    IpLog.count({ip:ip}, function(err,users) {
                        if(err) {
                            return reply(err);
                        }
                        if(users > 5) {
                          return reply(Boom.badRequest("You already have an account."));
                        
                        }
                        return reply(true);
                    });
                }
            }, {
                assign: 'walletCheck',
                method: function(request,reply) {

                    for (var i in request.payload.withdrawWallets) {
                        var address =request.payload.withdrawWallets;
                        if(i === 'bitcoin') {
                            if(!bitcore.Address.isValid(request.payload.withdrawWallets[i], bitcore.Networks.livenet)) {
                              return reply(Boom.badRequest("Invalid bitcoin address. Leave the address blank to skip it for now."));
                            }
                            
                        } else if (i === 'burstcoin') {
                            if(request.payload.withdrawWallets[i].substr(0,5) !== "BURST") {
                                return reply(Boom.badRequest("Invalid burstcoin address. Leave the address blank to skip it for now."));
                            }
                        } else {
                            return reply(Boom.badRequest("Invalid wallet currency."));
                        }
                    }
                    return reply(true);
                }
            }, {
                assign: 'emailCheck',
                method: function (request, reply) {

                    const conditions = {
                        email: request.payload.email
                    };

                    User.findOne(conditions, (err, user) => {

                        if (err) {
                            return reply(err);
                        }

                        if (user) {
                            return reply(Boom.conflict('Email already in use.'));
                        }

                        reply(true);
                    });
                }
            }]
        },
        handler: function (request, reply) {

            const mailer = request.server.plugins.mailer;

            Async.auto({
                user: function (done) {

                    const username = request.payload.username;
                    const password = request.payload.password;
                    const email = request.payload.email;
                    const ip = request.headers['x-forwarded-for'] || request.info.remoteAddress;

                    User.create(username, password, email, ip, done);
                },
                account: ['user', function (done, results) {
                    let wallets = {bitcoin:"",burstcoin:""};
                    for(var i in request.payload.withdrawWallets) {
                        wallets[i] = request.payload.withdrawWallets[i];
                    }
                    Account.create(request.payload.name, wallets, done);
                }],
                linkUser: ['account', function (done, results) {

                    const id = results.account._id.toString();
                    const update = {
                        $set: {
                            user: {
                                id: results.user._id.toString(),
                                name: results.user.username
                            }
                        }
                    };

                    Account.findByIdAndUpdate(id, update, done);
                }],
                linkAccount: ['account', function (done, results) {

                    const id = results.user._id.toString();
                    const update = {
                        $set: {
                            roles: {
                                account: {
                                    id: results.account._id.toString(),
                                    name: results.account.name
                                }
                            }
                        }
                    };

                    User.findByIdAndUpdate(id, update, done);
                }],
                welcome: ['linkUser', 'linkAccount', function (done, results) {

                    const emailOptions = {
                        subject: 'Your ' + Config.get('/projectName') + ' account',
                        to: {
                            name: request.payload.name,
                            address: request.payload.email
                        }
                    };
                    const template = 'welcome';

                    // mailer.sendEmail(emailOptions, template, request.payload, (err) => {

                    //     if (err) {
                    //         console.warn('sending welcome email failed:', err.stack);
                    //     }
                    // });

                    done();
                }],
                session: ['linkUser', 'linkAccount', function (done, results) {

                    Session.create(results.user._id.toString(), done);
                }]
            }, (err, results) => {

                if (err) {
                    return reply(err);
                }

                const user = results.linkAccount;
                const credentials = results.session._id + ':' + results.session.key;
                const authHeader = 'Basic ' + new Buffer(credentials).toString('base64');


                reply({
                    user: {
                        _id: user._id,
                        username: user.username,
                        email: user.email,
                        roles: user.roles
                    },
                    account: results.account,
                    session: results.session,
                    authHeader: authHeader,
                    game: server.settings.app.game
                });
            });
        }
    });


    next();
};


exports.register = function (server, options, next) {

    server.dependency(['mailer', 'hapi-mongo-models'], internals.applyRoutes);

    next();
};


exports.register.attributes = {
    name: 'signup'
};
