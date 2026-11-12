'use strict';

const esbuild = require('esbuild');

esbuild.buildSync({
  entryPoints: ['electron/auto-updater.cjs'],
  outfile: 'electron/auto-updater.bundle.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  external: ['electron'],
  logLevel: 'info',
});