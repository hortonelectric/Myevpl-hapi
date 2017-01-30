'use strict';
const AuthPlugin = require('../auth');
const provable = require('../provably-fair.js');
const _ = require('lodash');

const Async = require('async');
const internals = {};
internals.applyRoutes = function (server, next) {

  const io = server.plugins['hapi-io'].io;


  io.sockets.on('connection', function(socket) {

    socket.on('disconnect', function() {
      socketBroadcast('players-list', server.settings.app.players)
      socket.removeAllListeners()
      delete server.settings.app.players[socket.id]
    });
  });


  const Session = server.plugins['hapi-mongo-models'].Session;
  const User = server.plugins['hapi-mongo-models'].User;
  const Account = server.plugins['hapi-mongo-models'].Account;
  const IpLog = server.plugins['hapi-mongo-models'].IpLog;

  const Bet = server.plugins['hapi-mongo-models'].Bet;
  const Round = server.plugins['hapi-mongo-models'].Round;

  // unfortunately all this code is copied and duplicated from hapi-basic-auth/index and validateFunc
  // I'm sure there's a way to do it better, but I don't have time for refactor now
  const authSocket = function(request, callback) {
    const authorization = request.query.authHeader
    const parts = authorization.split(/\s+/);

    if (parts[0].toLowerCase() !== 'basic') {
      return callback("no session security data");
    }

    if (parts.length !== 2) {
      return reply(Boom.badRequest('Bad HTTP authentication header format', 'Basic'));
    }

    const credentialsPart = new Buffer(parts[1], 'base64').toString();
    const sep = credentialsPart.indexOf(':');
    if (sep === -1) {
      return reply(Boom.badRequest('Bad header internal syntax', 'Basic'));
    }

    const username = credentialsPart.slice(0, sep);
    const password = credentialsPart.slice(sep + 1);

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
          if(usersByIp.length > 5) {
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

      let credentials = results || null
      let isValid = Boolean(results.user)

      if (err) {
        return callback(err);
      }


      if (!results.session) {
        return callback(null, false);
      }



      if (!isValid) {
        return callback('Bad session security data');
      }

      if (!credentials ||
        typeof credentials !== 'object') {

        return callback('Bad credentials object received for Basic auth validation');
      }

      // Authenticated

      return callback(null, { credentials: credentials });
    });
  }



  const loginSocket = function(request, cb) {
   // the authHeader is passed up in the query on socket requests only.
   // this whole request is only used for the socket 'game' event,
   // so if somebody tries to hit it with an XHR call, just quit
   if(!request.query.authHeader) {
    return cb()
   }
   authSocket(request, function(err, credentials) {
    if(err || !credentials) {
     return cb()
    }
    cb(credentials)
   })
  }
  const checkSocket = function(ctx) {
   if(!ctx.res.result || !ctx.res.result.credentials) {
    return false;
   }
   return true
  }
  const socketBroadcast = function(eventName,eventData) {
    if(io) {
      io.emit(eventName,eventData);
    }
  };
  setInterval(function() {
   let info = {
     players: server.settings.app.players,
     chats: server.settings.app.chatHistory,
     game: server.settings.app.game
    }
   socketBroadcast('game-info', info)

   if(server.settings.app.round.workingResult > 0) {
     socketBroadcast('game-heartbeat', {
      resultinc:server.settings.app.round.resultinc,
      looptime:server.settings.app.round.looptime,
      workingResult:server.settings.app.round.workingResult
     });
   }
  },250);

  const calcBonuses = function(cb) {

    //Slides across the array and apply the function to equally stopped_at parts of the array
    function slideSameStoppedAt(arr, fn) {
      var i = 0;
      while (i < arr.length) {
        var tmp = [];
        var betAmount = 0;
        var sa = arr[i].stopped_at;
        for (; i < arr.length && arr[i].stopped_at === sa; ++i) {
          betAmount += arr[i].bet;
          tmp.push(i);
        }
        fn(arr, tmp, sa, betAmount);
      }
    }
    var players = [];
    //Transform the player info object in an array of references to the user objects
    //{ user1: { bet: satoshis, stopped_at: 200 }, user2: { bet: satoshis } } -> [ user1: { bet: satoshis, stopped_at: 200 } ... ]
    var playersArr = _.map(players, function(player, username) {
      return player;
    });

    //Sort the list of players based on the bet
    var playersArrSorted = _.sortBy(playersArr, function(player) {
      return -player.satoshiBet || 0;
    });

    var bonusPool = 0;
    var largestBet = 0;

    //Get max bet and bonus pool
    for (var i = 0, length = playersArrSorted.length; i < length; ++i) {
      var bet = playersArrSorted[i].bet;
      bonusPool += bet / 100;
      largestBet = Math.max(largestBet, bet);
    }

    //The ratio bits per bit bet
    var maxWinRatio = bonusPool / largestBet;

    slideSameStoppedAt(playersArrSorted,
      function(array, listOfRecordsPositions, cashOutAmount, totalBetAmount) {

        //If the bonus pool is empty fill the bonus with 0's
        if (bonusPool <= 0) {
          for (var i = 0, length = listOfRecordsPositions.length; i < length; i++) {
            array[listOfRecordsPositions[i]].bonus = 0;
          }
          return;
        }

        //If the bonusPool is less than what this user/group could get just give the remaining of the bonus pool
        var toAllocAll = Math.min(totalBetAmount * maxWinRatio, bonusPool);

        //Alloc the bonuses
        for (var i = 0, length = listOfRecordsPositions.length; i < length; i++) {

          //The alloc qty of this user, if its one it will get all
          var toAlloc = (array[listOfRecordsPositions[i]].bet / totalBetAmount) * toAllocAll;

          bonusPool -= toAlloc;

          array[listOfRecordsPositions[i]].bonus = toAlloc;
        }

        cb(array);
      }
    );

  };
  const gameLoop = function() {
    if(server.settings.app.loopLock) {
      // if we're already running this loop then do nothing
      return false;
    }
    if(server.settings.app.game.paused) {
      return false;
    }
      return false;
    // tell the app we're running the loop
    server.settings.app.loopRunning = true;

    // tell the app not to run this loop twice at the same time
    server.settings.app.loopLock = true;

    // wait and then go again
    server.settings.app.loopLock = false;
    setTimeout(gameLoop,1000);

  };
  server.route({
    method: 'GET',
    path: '/game',
    config: {
     plugins: {
      'hapi-io': {
        event: 'game',
        post: function(ctx,next) {
          if(!checkSocket(ctx)) { return next() }
          const creds = ctx.res.result.credentials
          if(!server.settings.app.players[ctx.socket.id]) {
            server.settings.app.players[ctx.socket.id] = {userId: creds.user._id, username: creds.user.username}
          }
          ctx.io.emit('players-list', server.settings.app.players)
          ctx.socket.emit('user-login', {
            id: creds.user._id,
            username: creds.user.username,
            email: creds.user.email,
            roles: creds.user.roles
          })
          User.findByIdAndUpdate(creds.user._id.toString(),
            {$set:{timeSeen: new Date()}}, function(err, user) {
              Account.balance(creds.roles.account._id.toString(),100, function(err,account) {
                ctx.socket.emit('account-update', account)
                next()
              });
            });

        }
      }
     }
    },
    handler: function (request, reply) {
     // trigger the game loop if there isn't one already
     if(!server.settings.app.loopRunning) {
       gameLoop();
     }
     loginSocket(request, function(creds) {
      reply(creds)
     })
    }

   });
  server.route({
    method: 'GET',
    path: '/bets',
    handler: function (request, reply) {
      let time = new Date().getTime()-86400
      Bet.find({createdAt: {$gt: new Date(time) }}, function(err,bets) {
        if(err || !bets) {
          console.log("no bets found", err)
          return reply(Boom.badRequest("No bets found"))
        }
        console.log(time,bets)
        return reply (bets)

      });
    }
   });
  server.route({
    method: 'GET',
    path: '/rounds',
    handler: function (request, reply) {

      let time = new Date().getTime()-86400
      Round.find({createdAt: {$gt: new Date(time)}}, function(err,rounds) {
        if(err || !rounds) {
          console.log("no rounds found", err)
          return reply(Boom.badRequest("No rounds found"))
        }
        console.log(time,rounds)
        return reply (rounds)

      });
    }
   });
  server.route({
    method: 'GET',
    path: '/players/online',
    handler: function (request, reply) {
		reply(server.settings.app.players)
    }
   });

  server.route({
    method: 'GET',
    path: '/bet',
    config: {
      plugins: {
        'hapi-io': {
          event: 'place-bet',
          post: function(ctx,next) {
           if(!checkSocket(ctx)) { return next() }

           const id = ctx.res.result.credentials.roles.account._id.toString()
           // can only place bet while the status is 'began'
           if(!server.settings.app.round || !server.settings.app.round.status || server.settings.app.round.status === 'finished') {
             // this lets ONLY THIS client know to try again immediately
             ctx.data.error = "Game is in flux, retry";
             ctx.socket.emit('bet-error-retry',ctx.data);
           } else if (server.settings.app.round.status === 'began') {
             let bet = {
              userId: id,
              roundId: server.settings.app.round._id.toString(),
              satoshiBet: parseInt(ctx.data.amount,10),
              autoCashout: ctx.data.autoCashout || 0
             };

             Account.balance(id, -(bet.satoshiBet), function(err,account) {
               if(err || !account) {
                 ctx.socket.emit('bet-error-create',{err:err,data:ctx.data});
                 console.error("error creating a bet", id,ctx.data);
               } else {
                 Bet.create(bet, function(err,newbet) {
                   if(err || !newbet) {
                     ctx.socket.emit('bet-error',err);
                   } else {
                     // let the entire site know a new bet was placed
                     server.settings.app.players[ctx.socket.id].stake = newbet.satoshiBet

                     ctx.socket.emit('bet-placed',{bet:newbet,account:account});
                     ctx.socket.emit('bet-history',newbet);

                   }
                 });
               }
             });
           } else {
             ctx.data.error = "Game is already in progress or other unknown error";
             ctx.socket.emit('bet-error',ctx.data);
           }
           next();
          }
        }
      }
    },
    handler: function(request,reply) {
     loginSocket(request, function(creds) {
      reply(creds)
     })
    }
  });
  const blockStartInc = function() {
    if(! server.settings.app.round.blockStart) {
       server.settings.app.round.blockStart = 0
    }
    server.settings.app.round.blockStart++
  }
  const blockStartDec = function() {
    server.settings.app.round.blockStart--
    if(server.settings.app.round.blockStart < 0) {
      throw "what the duece"
    }
  }

  server.route({
    method: 'GET',
    path: '/cashout',
    config: {
      plugins: {
        'hapi-io': {
          event: 'cashout',
          post: function(ctx,next) {
            if(!checkSocket(ctx)) { return next() }



            const id = ctx.res.result.credentials.roles.account._id.toString();

            if(!server.settings.app.round || !server.settings.app.round.status || server.settings.app.round.status === 'finished') {
              ctx.data = {error:"Cannot cash out right now, no active game."};
              ctx.socket.emit('cashout-error',ctx.data);
            } else if (server.settings.app.round.status === 'began') {
              // can only cancel bet while the status is 'began'

              // cancel bet, if we want to disallow it, use this code
              // ctx.data.error = "Cannot cash out right now, wait until game is started.";
              // ctx.socket.emit('cashout-error',ctx.data);
              // end cancel bet forbidden code.

              // set a flag so that the game cannot calculate bonuses
              // and/or start until this operation is complete
              blockStartInc()
              Bet.find({roundId: server.settings.app.round._id.toString(), userId: id}, function(err, bets) {
                var totalAmount = 0;
                for(var i=0;i<bets.length;i++) {
                  if(isNaN(bets[i].satoshiBet)) {
                    throw "Bet is NaN"
                  }
                  totalAmount += bets[i].satoshiBet;
                }
                // delete the database record for the bet itself
                Bet.updateMany({roundId: server.settings.app.round._id.toString(), userId: id}, {$set:{wasCanceled: true, cashoutMultiplier: 0, cashoutAt: new Date()}},  function(err,deletedBets) {
                  if(err || !deletedBets) {
                    ctx.socket.emit('bet-delete-error',{err:err,userId:id,roundId:server.settings.app.round._id.toString()});
                    console.error("bet delete error at updateMany bet", err, id,server.settings.app.round._id.toString());
                  } else {
                    // credit user's balance back to them
                    Account.balance(id, totalAmount, function(err,account) {
                      if(err || !account) {
                        ctx.socket.emit('bet-delete-error',{err:err,userId:id,roundId:server.settings.app.round._id.toString()});
                        console.error("bet delete error at account balance", err, userId,server.settings.app.round._id.toString());
                        throw "crash on trying to delete bet"
                      } else {
                        delete server.settings.app.players[ctx.socket.id].stake
                        delete server.settings.app.players[ctx.socket.id].bonus
                        blockStartDec()
                        ctx.socket.emit('cashout',{account:account});
                      }
                    })
                  }
                });
              });
            } else if(server.settings.app.round.workingResult >= 0) {
              Bet.cashout(id, server.settings.app.round._id.toString(), server.settings.app.round.workingResult, function(err,bet) {
                if(err || !bet) {
                  ctx.socket.emit('cashout-error',err);
                } else {
                  Account.balance(id, bet.satoshiWon, function(err,account) {
                    if(err || !account) {
                      ctx.socket.emit('cashout-error-winnings',ctx.data);
                      console.error("error crediting winnings", id,bet);
                    } else {
                      // cash them out at the working result
                      ctx.socket.emit('cashout',{bet: bet,account:account});
                      console.log(bet)
                      server.settings.app.players[ctx.socket.id].profit = bet.satoshiWon
                      // delete server.settings.app.players[ctx.socket.id].stake
                    }
                  });
                }
              });
            }
            return next()
          }
        }
      }
    },
    handler: function(request,reply) {
     loginSocket(request, function(creds) {
      reply(creds)
     });
    }
  });

  server.route({
    method: 'GET',
    path: '/game/pause',
    config: {
     auth: {
       strategy: 'simple',
       scope: 'admin'
     },
     pre: [
       AuthPlugin.preware.ensureAdminGroup('root')
     ],
     plugins: {
       'hapi-io': {
         event: 'pause',
         post: function(ctx,next) {
           socketBroadcast('pause',ctx.data);
           next();
         }
       }
     },
    },

    handler: function (request, reply) {
      server.settings.app.game.paused = true
      reply()
    }
  });

  server.route({
    method: 'GET',
    path: '/game/unpause',
    config: {
     auth: {
       strategy: 'simple',
       scope: 'admin'
     },
     pre: [
       AuthPlugin.preware.ensureAdminGroup('root')
     ],
     plugins: {
       'hapi-io': {
         event: 'unpause',
         post: function(ctx,next) {
           socketBroadcast('unpause',ctx.data);
           next();
         }
       }
     },
    },

    handler: function (request, reply) {
      server.settings.app.game.paused = false
      gameLoop() // restart the game loop
      reply()

    }
  });
  next();
};

exports.register = function (server, options, next) {

  server.dependency(['auth', 'hapi-mongo-models'], internals.applyRoutes);

  next();
};


exports.register.attributes = {
  name: 'game'
};
