'use strict';

var BigNumber = require('bignumber.js');

// amounts of things in satoshi
var COIN = new BigNumber(100000000);
var MBTC = COIN.div(1000);
var BIT = new BigNumber(100);

module.exports = {
    toBTC: toBTC,
    toMBTC: toMBTC,
    toBits: toBits,
    toSatoshi: fromBTC,
    fromBTC: fromBTC,
    fromMBTC: fromMBTC,
    fromBits: fromBits,
};

function toBTC(satoshi) {
    satoshi = parseInt(satoshi, 10);
    if (isNaN(satoshi)) return NaN;
    satoshi = new BigNumber(satoshi);
    return satoshi.div(COIN).toNumber();
}

function fromBTC(btc) {
    btc = parseFloat(btc);
    if (isNaN(btc)) return NaN;
    btc = new BigNumber(btc);
    return btc.mul(COIN).toNumber();
}

function toMBTC(satoshi) {
    satoshi = parseInt(satoshi, 10);
    if (isNaN(satoshi)) return NaN;
    satoshi = new BigNumber(satoshi);
    return satoshi.div(MBTC).toNumber();
}

function fromMBTC(mbtc) {
    mbtc = parseFloat(mbtc);
    if (isNaN(mbtc)) return NaN;
    mbtc = new BigNumber(mbtc);
    return mbtc.mul(MBTC).toNumber();
}

function toBits(satoshi) {
    satoshi = parseInt(satoshi, 10);
    if (isNaN(satoshi)) return NaN;
    satoshi = new BigNumber(satoshi);
    return satoshi.div(BIT).toNumber();
}

function fromBits(bit) {
    bit = parseFloat(bit);
    if (isNaN(bit)) return NaN;
    bit = new BigNumber(bit);
    return bit.mul(BIT).toNumber();
}
