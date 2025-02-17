const esbuild = require('esbuild');

esbuild.build({
  entryPoints: ['./src/extension.ts'],
  bundle: true,
  outfile: 'out/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'node14',
  sourcemap: true,
  minify: process.argv.includes('--minify'),
  // treeShaking: true,
}).catch(() => process.exit(1));