'use strict';

const Boom = require('boom');
const Async = require('async');


const internals = {};


internals.applyStrategy = function (server, next) {

    const Session = server.plugins['hapi-mongo-models'].Session;
    const User = server.plugins['hapi-mongo-models'].User;
    const Account = server.plugins['hapi-mongo-models'].Account;
    const IpLog = server.plugins['hapi-mongo-models'].IpLog;
    // const ObjectID = request.server.plugins['hapi-mongodb'].ObjectID;

    server.auth.strategy('simple', 'basic', {
        validateFunc: function (request, username, password, callback) {

            Async.auto({
                session: function (done) {

                    Session.findByCredentials(username, password, done);
                },
                user: ['session', function (done, results) {

                    if (!results.session) {
                        return done();
                    }

                    User.findById(results.session.userId, done);
                }],
                roles: ['user', function (done, results) {
 
                    if (!results.user) {
                        return done();
                    }

                    results.user.hydrateRoles(done);
                }],           
                scope: ['user', function (done, results) {
                    const ip = request.headers['x-forwarded-for'] || request.info.remoteAddress;


                    if (!results.user || !results.user.roles) {
                        console.log("no user found");
                        return done();
                    }
                    // don't do checks for IPs for admins
                    if(results.user.roles.admin) {
                        return done(null, Object.keys(results.user.roles));
                    }
                    IpLog.find({ip:ip,userId:{$ne:results.user._id}},  
                        function(error,usersByIp) {
                        var allIps = [];
                        var allUsers = [];
                        for(var i=0;i<usersByIp.length;i++) {
                            allIps.push(usersByIp[i].ip);
                            allUsers.push(usersByIp[i].userId);
                        }
                        if(error) {
                            console.log("ip lookup error", error);
                            return done();
                        }
                        if(usersByIp.length > 99999) {
                            console.log("logging in from too many accounts", usersByIp);

                            User.updateMany({ip:{$in:allIps}}, 
                            {$set:{isActive:false}}, 
                            function(err,updateResults) {
        
                                return done();
                            });                            
                        }

                        IpLog.create({userId:results.user._id.toString(),ip:ip}, function(err,result) {
                            

                            if(err) {
                                console.log("iplog create error",err);    
                                return done();
                            }

                            done(null, Object.keys(results.user.roles));

                        });
                    });

                }]
            }, (err, results) => {

                if (err) {
                    return callback(err);
                }

                if (!results.session) {
                    return callback(null, false);
                }

                callback(null, Boolean(results.user), results);
            });
        }
    });


    next();
};


internals.preware = {
    ensureAdminGroup: function (groups) {

        return {
            assign: 'ensureAdminGroup',
            method: function (request, reply) {

                if (Object.prototype.toString.call(groups) !== '[object Array]') {
                    groups = [groups];
                }

                const groupFound = groups.some((group) => {

                    return request.auth.credentials.roles.admin.isMemberOf(group);
                });

                if (!groupFound) {
                    return reply(Boom.notFound('Permission denied to this resource.'));
                }

                reply();
            }
        };
    }
};


exports.register = function (server, options, next) {

    server.dependency('hapi-mongo-models', internals.applyStrategy);

    next();
};


exports.preware = internals.preware;


exports.register.attributes = {
    name: 'auth'
};
