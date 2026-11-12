'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const privateDirectory = path.join(root, '.secrets');
const privatePath = path.join(privateDirectory, 'portable-update-private.pem');
const publicPath = path.join(root, 'electron', 'portable-update-public.pem');

if (fs.existsSync(privatePath) || fs.existsSync(publicPath)) {
  console.error('A portable update key already exists. Do not overwrite it unless you are intentionally rotating the update key.');
  console.error(`Private key: ${privatePath}`);
  console.error(`Public key:  ${publicPath}`);
  process.exit(1);
}

fs.mkdirSync(privateDirectory, { recursive: true });
fs.mkdirSync(path.dirname(publicPath), { recursive: true });

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

fs.writeFileSync(privatePath, privateKey, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
fs.writeFileSync(publicPath, publicKey, { encoding: 'utf8', flag: 'wx' });

console.log('Portable update Ed25519 key pair generated.');
console.log(`Private key (NEVER commit this file): ${privatePath}`);
console.log(`Public key (commit this file):       ${publicPath}`);
console.log('\nNext steps:');
console.log('1. Add the complete private PEM contents as the GitHub Actions secret PORTABLE_UPDATE_PRIVATE_KEY.');
console.log('2. Commit electron/portable-update-public.pem to the repository.');
console.log('3. Keep a secure offline backup of the private key.');
