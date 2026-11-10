#!/usr/bin/env node
/* Window Smash build: no dependencies, Node 16+.
   - Reads index.html and collects the game <script src="js/..."> tags in order.
   - Concatenates the game scripts into one file (they are plain scripts sharing globals,
     so one script with the same order behaves the same).
   - Copies three.min.js, the stylesheet and assets into build/.
   - Fails if anything outside the library references an external URL (Poki allows no external requests).
   - Zips build/ into window-smash-poki.zip (index.html at the zip root) using the system `zip`;
     if `zip` is missing (e.g. on a CI host) it warns and skips the zip.
   Usage: sh build.sh [--no-zip]   (or: node tools/build.js [--no-zip]) */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'build');
const ZIP = path.join(ROOT, 'window-smash-poki.zip');
const LIB = 'js/lib/three.min.js';
const noZip = process.argv.includes('--no-zip');

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const fail = msg => { console.error('build failed: ' + msg); process.exit(1); };

function copy(rel) {
  const src = path.join(ROOT, rel), dst = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.cpSync(src, dst, { recursive: true, filter: f => !path.basename(f).startsWith('.') }); // skip .DS_Store etc.
}

// 1. clean
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

// 2. collect scripts in load order
let html = read('index.html');
const tags = [...html.matchAll(/<script src="([^"]+)"><\/script>\n?/g)];
if (!tags.length) fail('no <script src> tags found in index.html');
const srcs = tags.map(m => m[1]);
if (!srcs.includes(LIB)) fail('index.html must load ' + LIB);
const game = srcs.filter(s => s !== LIB);
if (srcs.indexOf(LIB) > srcs.indexOf(game[0])) fail(LIB + ' must load before the game scripts');

// 3. bundle game scripts into one file
const bundle = "'use strict';\n" + game.map(s => {
  const code = read(s).replace(/^'use strict';\n/, '');
  return '/* ===== ' + s + ' ===== */\n' + code.trimEnd() + '\n';
}).join('\n');
fs.mkdirSync(path.join(DIST, 'js'), { recursive: true });
fs.writeFileSync(path.join(DIST, 'js/game.js'), bundle);

// 4. rewrite index.html: remove all script tags, then add the library and the bundle before </body>
tags.forEach(m => { html = html.replace(m[0], ''); });
html = html.replace('</body>', '<script src="' + LIB + '"></script>\n<script src="js/game.js"></script>\n</body>');
fs.writeFileSync(path.join(DIST, 'index.html'), html);

// 5. copy static files
copy(LIB);
copy('css');
copy('assets');

// 6. guard: no external URLs outside the library
for (const f of ['index.html', 'js/game.js', ...fs.readdirSync(path.join(DIST, 'css')).map(f => 'css/' + f)]) {
  const hit = fs.readFileSync(path.join(DIST, f), 'utf8').match(/https?:\/\/[^\s"')]+/);
  if (hit) fail(f + ' references an external URL: ' + hit[0]);
}

// 7. zip for upload
const size = p => { let n = 0; for (const e of fs.readdirSync(p, { withFileTypes: true })) n += e.isDirectory() ? size(path.join(p, e.name)) : fs.statSync(path.join(p, e.name)).size; return n; };
console.log('build/ ready: ' + game.length + ' scripts bundled, ' + (size(DIST) / 1024).toFixed(0) + ' KB');
if (!noZip) {
  fs.rmSync(ZIP, { force: true });
  try { execFileSync('zip', ['-r', '-X', '-q', ZIP, '.'], { cwd: DIST }); }
  catch (e) { console.warn('zip skipped: could not run `zip` (' + e.message.split('\n')[0] + '). build/ is complete; zip its contents manually if needed.'); }
  if (fs.existsSync(ZIP)) console.log('zip ready: ' + path.basename(ZIP) + ' (' + (fs.statSync(ZIP).size / 1024).toFixed(0) + ' KB)');
}
