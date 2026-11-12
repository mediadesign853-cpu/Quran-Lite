'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const publicKeyPath = path.resolve(__dirname, '..', 'electron', 'portable-update-public.pem');
if (!fs.existsSync(publicKeyPath)) {
  console.error('Missing electron/portable-update-public.pem. Run: npm run generate:portable-keys');
  process.exit(1);
}

try {
  const key = crypto.createPublicKey(fs.readFileSync(publicKeyPath, 'utf8'));
  if (key.asymmetricKeyType !== 'ed25519') throw new Error('The key is not Ed25519.');
} catch (error) {
  console.error(`Invalid portable update public key: ${error.message}`);
  process.exit(1);
}

console.log('Portable update public key is present and valid.');
