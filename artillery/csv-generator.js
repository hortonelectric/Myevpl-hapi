var csv = require('csv');

csv.generate({seed: 1, columns: 2, length: 2}, function(err, output){
  console.log(output)
  // output.should.eql('OMH,ONKCHhJmjadoA\nD,GeACHiN');
});
