/* ============================================================
   GENENGINE — build_standalone.js
   Rebuilds dist/GenEngine-standalone.html: the whole studio
   (CSS + all modules) inlined into one portable HTML file.

   Usage:  node tools/build_standalone.js
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ORDER = ['util', 'state', 'fx', 'synth', 'audio', 'presets', 'steps', 'pianoroll', 'playlist', 'mixer', 'library', 'main'];

const css = fs.readFileSync(path.join(ROOT, 'css/style.css'), 'utf8');
const js = ORDER.map(n => fs.readFileSync(path.join(ROOT, 'js', n + '.js'), 'utf8')).join('\n\n');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>GENENGINE — Music Production Studio</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⚡</text></svg>">
<style>
${css}
</style>
</head>
<body>
  <div id="app">
    <header id="topbar"></header>
    <nav id="tabs"></nav>
    <main id="main"></main>
    <footer id="kbd-wrap">
      <div id="kbd" class="hidden"></div>
    </footer>
  </div>
  <div id="toasts"></div>
<script>
${js}
</${'script'}>
</body>
</html>
`;

fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dist/GenEngine-standalone.html'), html);
console.log('built dist/GenEngine-standalone.html —', html.length, 'bytes');
