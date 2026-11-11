#!/usr/bin/env node
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Cari file master key di root proyek atau folder saat ini
const keyPaths = [
  path.join(__dirname, '..', '.beras_master_key.json'),
  path.join(process.cwd(), '.beras_master_key.json'),
];

let masterKey = null;
for (const p of keyPaths) {
  if (fs.existsSync(p)) {
    try {
      masterKey = JSON.parse(fs.readFileSync(p, 'utf-8'));
      break;
    } catch (_) {}
  }
}

// Fallback jika file tidak ditemukan
if (!masterKey) {
  masterKey = {
    private_key_base64: "4zMHenwFnIBCF4dDk0rAKkYG/I5z3+alQp9TQzhrvnI=",
    public_key_base64: "iP+a54y8y5bmsWymox2tHwi4jKcuuQSdv0BBkzgqLQQ="
  };
}

const privKeyRaw = Buffer.from(masterKey.private_key_base64, 'base64');
const pkcs8Prefix = Buffer.from('302e020100300506032b657004220420', 'hex');
const privateKey = crypto.createPrivateKey({
  key: Buffer.concat([pkcs8Prefix, privKeyRaw]),
  format: 'der',
  type: 'pkcs8'
});

function signLicense(identity) {
  const cleanId = identity.trim().toLowerCase();
  const message = Buffer.from('BERAS_PRO_LICENSE:' + cleanId);
  const sig = crypto.sign(null, message, privateKey);
  return 'PRO-' + sig.toString('base64');
}

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('\n======================================================');
  console.log('   🌾 BERAS VISUALIZER - LICENSE GENERATOR           ');
  console.log('======================================================');
  console.log('Penggunaan:');
  console.log('  1. Generate 1 Lisensi:');
  console.log('     node scripts/generate_license.cjs "nama_user"');
  console.log('\n  2. Generate Beberapa Lisensi Sekaligus:');
  console.log('     node scripts/generate_license.cjs user1 user2 user3');
  console.log('\n  3. Bulk Giveaway / Voucher:');
  console.log('     node scripts/generate_license.cjs --bulk 10 giveaway');
  console.log('======================================================\n');
  process.exit(0);
}

if (args[0] === '--bulk') {
  const count = parseInt(args[1], 10) || 10;
  const prefix = args[2] || 'giveaway';

  console.log('\n==========================================================================================');
  console.log(` 🎁 GENERATE BULK LISENSI GIVEAWAY (Total: ${count})`);
  console.log('==========================================================================================');
  console.log('No   | Username / Kode Identitas | Serial Key PRO');
  console.log('------------------------------------------------------------------------------------------');
  for (let i = 1; i <= count; i++) {
    const pad = String(i).padStart(2, '0');
    const identity = `${prefix}_${pad}`;
    const key = signLicense(identity);
    console.log(`${String(i).padEnd(4)} | ${identity.padEnd(25)} | ${key}`);
  }
  console.log('==========================================================================================\n');
  process.exit(0);
}

if (args.length === 1) {
  const identity = args[0];
  const key = signLicense(identity);
  console.log('\n=================================================');
  console.log(' Lisensi Beras Visualizer Berhasil Dibuat');
  console.log('=================================================');
  console.log(` Pemilik / Identitas : ${identity.trim()}`);
  console.log(` Serial Key          : ${key}`);
  console.log('=================================================');
  console.log('Kirimkan pasangan di atas kepada user.\n');
} else {
  console.log('\n==========================================================================================');
  console.log(` 🔑 GENERATE LISENSI (Total: ${args.length})`);
  console.log('==========================================================================================');
  console.log('No   | Email / Username               | Serial Key PRO');
  console.log('------------------------------------------------------------------------------------------');
  args.forEach((id, idx) => {
    const key = signLicense(id);
    console.log(`${String(idx + 1).padEnd(4)} | ${id.padEnd(30)} | ${key}`);
  });
  console.log('==========================================================================================\n');
}
