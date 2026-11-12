'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const { createReadStream } = require('node:fs');
const path = require('node:path');

async function main() {
  const root = path.resolve(__dirname, '..');
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const releaseDirectory = path.resolve(root, process.env.RELEASE_DIR || 'release');
  const version = packageJson.version;
  const tag = process.env.GITHUB_REF_NAME || `v${version}`;
  const privateKeyPem = process.env.PORTABLE_UPDATE_PRIVATE_KEY;
  const owner = 'mediadesign853-cpu';
  const repo = 'quran-lite';

  if (!privateKeyPem || !privateKeyPem.includes('BEGIN PRIVATE KEY')) {
    throw new Error('PORTABLE_UPDATE_PRIVATE_KEY environment variable is missing or invalid.');
  }
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`package.json version must be a stable x.y.z version; received ${version}`);
  }
  if (tag !== `v${version}`) {
    throw new Error(`Git tag (${tag}) must exactly match package.json version (v${version}).`);
  }
  if (!fs.existsSync(releaseDirectory)) {
    throw new Error(`Release directory does not exist: ${releaseDirectory}`);
  }

  const portableFiles = fs.readdirSync(releaseDirectory)
    .filter((name) => name === `Quran Reader Lite Portable ${version}.exe`);

  if (portableFiles.length !== 1) {
    throw new Error(`Expected exactly one Portable .exe in ${releaseDirectory}; found ${portableFiles.length}: ${portableFiles.join(', ')}`);
  }

  const fileName = portableFiles[0];
  if (!/^[A-Za-z0-9][A-Za-z0-9 ._-]*\.exe$/i.test(fileName)) {
    throw new Error(`Portable artifact has an unsafe file name: ${fileName}`);
  }

  const filePath = path.join(releaseDirectory, fileName);
  const stats = fs.statSync(filePath);
  const hash = crypto.createHash('sha512');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  const sha512 = hash.digest('base64');

  const manifest = {
    schemaVersion: 1,
    appId: 'com.quranreader.lite',
    productName: 'Quran Reader Lite',
    version,
    tag,
    platform: 'win32',
    arch: 'x64',
    fileName,
    size: stats.size,
    sha512,
    downloadUrl: `https://github.com/${owner}/${repo}/releases/download/${tag}/${encodeURIComponent(fileName)}`,
    releaseDate: new Date().toISOString(),
  };

  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  const manifestBytes = Buffer.from(manifestText, 'utf8');
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  if (privateKey.asymmetricKeyType !== 'ed25519') {
    throw new Error('PORTABLE_UPDATE_PRIVATE_KEY must be an Ed25519 private key.');
  }

  const signature = crypto.sign(null, manifestBytes, privateKey).toString('base64');
  const envelope = {
    signedPayload: manifestBytes.toString('base64'),
    signature,
  };
  const manifestPath = path.join(releaseDirectory, 'latest-portable.json');

  fs.writeFileSync(manifestPath, `${JSON.stringify(envelope, null, 2)}\n`, 'utf8');

  console.log(`Portable update manifest created for ${tag}:`);
  console.log(`  EXE:       ${fileName}`);
  console.log(`  Size:      ${stats.size} bytes`);
  console.log(`  SHA-512:   ${sha512}`);
  console.log(`  Manifest:  ${manifestPath}`);
  console.log('  Signature: embedded in latest-portable.json (Ed25519)');
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
