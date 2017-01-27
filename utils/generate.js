var bitcore = require('bitcore');
console.log("THIS SCRIPT IS EXPERIMENTAL! USE IT AT YOUR OWN RISK!");

// var argv = require('yargs')
//     .usage('Usage: $0 --entropy [string] --more_entropy [string] to create a new seed hex OR $0 --seed [string] to use existing')
//     .argv;
var argv = {entropy:"p895zdrfgpq34py893r45p23a3py893puilzsrfpy89a34awe;fui",more_entropy:"uiosdfq34345srf78ow34yuhk78oa3p89234ujhk3478oserjhk"};
var HDPrivateKey = bitcore.HDPrivateKey;
var HDPublicKey = bitcore.HDPublicKey;
var Address = bitcore.Address;
var Networks = bitcore.Networks;

var seedHex;
if(argv.seed) {
	seedHex = argv.seed;
} else if(argv.entropy && argv.more_entropy) {
	// create hash
	var crypto = require('crypto');
	var hash = crypto.createHmac('sha512', argv.entropy);
	hash.update(argv.more_entropy);
	seedHex = hash.digest('hex');
}

var hdPrivateKey = new HDPrivateKey.fromSeed(seedHex);
var hard = hdPrivateKey.derive("m/0'/0");
console.log("seed hex: ",seedHex);
console.log("main private key: " ,hdPrivateKey.privateKey.toString());
console.log("main public key: " ,new Address(hdPrivateKey.publicKey,Networks.livenet).toString());
console.log("hardened xprv hash m/0'/0: ", hard.toString());
console.log("hardened private key m/0'/0: ", hard.privateKey.toString());
console.log("hardened public key m/0'/0: ", new Address(hard.hdPublicKey.publicKey,Networks.livenet).toString());
console.log("hardened xpub hash m/0'/0",hard.hdPublicKey.toString());

// generate a handful of addresses, these will be used for stuff
// max 4294967295
for(var i=1; i < 3; i++) {
	var derivedAddress = new Address(hard.derive("m/"+i).publicKey, Networks.livenet);
	console.log("child address of m/0'/0 with index "+i,derivedAddress.toString());
}

console.log("Put the 'derived public key' into the secrets.js config file, and save the other information for later in a SAFE place.");
