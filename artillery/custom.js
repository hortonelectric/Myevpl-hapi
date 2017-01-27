module.exports = {
  setUsername: setUsername
  // logHeaders: logHeaders
}

function setUsername(requestParams, context, ee, next) {
  var uid = context._uid
  context.vars.username   = 'user' + uid
  context.vars.name       = 'user' + uid
  context.vars.email      = 'user' + uid + '@email.com'
  context.vars.password   = 'password'
  console.log(context.vars)
  return next(); // MUST be called for the scenario to continue
}

// function logHeaders(requestParams, response, context, ee, next) {
//   console.log(response.headers);
//   return next(); // MUST be called for the scenario to continue
// }
