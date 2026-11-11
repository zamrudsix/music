#!/usr/bin/env node
const crypto = require('crypto');

// Secret seed yang sama persis dengan yang di-embed di Rust backend
const MASKED_SECRET = Buffer.from([
  0xde ^ 0x5a, 0xad ^ 0xa5, 0xbe ^ 0x3c, 0xef ^ 0x7e,
  0x42 ^ 0x11, 0x99 ^ 0x22, 0x88 ^ 0x33, 0x77 ^ 0x44,
  0x66 ^ 0x55, 0x55 ^ 0x66, 0x44 ^ 0x77, 0x33 ^ 0x88,
  0x22 ^ 0x99, 0x11 ^ 0xaa, 0x00 ^ 0xbb, 0xff ^ 0xcc,
  0x13 ^ 0xd1, 0x37 ^ 0xe2, 0x79 ^ 0xf3, 0xac ^ 0x04,
  0xbd ^ 0x15, 0xce ^ 0x26, 0xdf ^ 0x37, 0xea ^ 0x48,
  0xfb ^ 0x59, 0x0c ^ 0x6a, 0x1d ^ 0x7b, 0x2e ^ 0x8c,
  0x3f ^ 0x9d, 0x40 ^ 0xae, 0x51 ^ 0xbf, 0x62 ^ 0xc0,
]);

const XOR_KEY = Buffer.from([
  0x5a, 0xa5, 0x3c, 0x7e, 0x11, 0x22, 0x33, 0x44,
  0x55, 0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb, 0xcc,
  0xd1, 0xe2, 0xf3, 0x04, 0x15, 0x26, 0x37, 0x48,
  0x59, 0x6a, 0x7b, 0x8c, 0x9d, 0xae, 0xbf, 0xc0,
]);

function getSecret() {
  const buf = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    buf[i] = MASKED_SECRET[i] ^ XOR_KEY[i];
  }
  return buf;
}

function generateLicenseKey(hwid) {
  const cleanHwid = hwid.trim().toUpperCase();
  const secret = getSecret();
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(cleanHwid);
  const digest = hmac.digest('hex').toUpperCase();
  
  // Format: PRO-XXXX-XXXX-XXXX-XXXX
  return `PRO-${digest.slice(0, 4)}-${digest.slice(4, 8)}-${digest.slice(8, 12)}-${digest.slice(12, 16)}`;
}

const hwidArg = process.argv[2];

if (!hwidArg) {
  console.log('\n======================================================');
  console.log('   BERAS MUSIC VISUALIZER - LICENSE KEY GENERATOR     ');
  console.log('======================================================');
  console.log('Penggunaan: node scripts/generate_key.cjs <HWID>');
  console.log('Contoh:     node scripts/generate_key.cjs BERAS-A1B2-C3D4-E5F6\n');
  process.exit(1);
}

const generatedKey = generateLicenseKey(hwidArg);

console.log('\n======================================================');
console.log('   BERAS MUSIC VISUALIZER - LICENSE KEY GENERATED     ');
console.log('======================================================');
console.log(`HWID        : ${hwidArg.trim().toUpperCase()}`);
console.log(`SERIAL KEY  : ${generatedKey}`);
console.log('======================================================');
console.log('Berikan Serial Key di atas kepada pembeli setelah');
console.log('konfirmasi transfer ke Bank Mandiri (1540015755162).\n');
