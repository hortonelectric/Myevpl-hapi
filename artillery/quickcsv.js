var Baby = require('babyparse')
var yourData = [];
var password = "1234567890"

for(var i=0;i<100;i++) {
  yourData.push({username: "user"+i,password: password, name: 'User '+i, email: 'test'+i+"@test.com" })
}


var csv = Baby.unparse(yourData);
var fs = require('fs')

fs.writeFile('./file.csv',csv)
