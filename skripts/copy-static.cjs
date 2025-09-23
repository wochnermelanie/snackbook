// scripts/copy-static.cjs
const fs = require('fs');
const path = require('path');

const pub = path.join(__dirname, '..', 'public');
if (!fs.existsSync(pub)) fs.mkdirSync(pub);

const files = [
  'index.html',
  'manifest.json',
  'service-worker.js',
  'logo.svg',
  'app-icon-192.png',
  'app-icon-512.png',
  'app-icon-maskable-192.png',
  'app-icon-maskable-512.png'
];

for (const f of files) {
  if (fs.existsSync(path.join(__dirname, '..', f))) {
    fs.copyFileSync(path.join(__dirname, '..', f), path.join(pub, f));
  }
}
console.log('Static copied to /public');
