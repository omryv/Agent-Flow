// Verifies that every <script> and stylesheet in public/index.html carries a
// sha384 integrity attribute that matches the file it loads.
// Run from anywhere in the repo: node .github/scripts/verify-sri.js
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');
const html = fs.readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8');

let checked = 0;
let failures = 0;

function fail(message) {
  failures++;
  console.error('::error file=public/index.html::' + message);
}

for (const tag of html.match(/<(?:script|link)\b[^>]*>/g) || []) {
  const isScript = tag.startsWith('<script');
  if (!isScript && !/\brel="stylesheet"/.test(tag)) continue;

  const url = (tag.match(/\b(?:src|href)="([^"]+)"/) || [])[1];
  if (!url) continue;
  checked++;

  const declared = (tag.match(/\bintegrity="sha384-([^"]+)"/) || [])[1];
  if (!declared) { fail(url + ' has no sha384 integrity attribute'); continue; }

  const file = path.join(PUBLIC_DIR, url.replace(/^\//, ''));
  if (!fs.existsSync(file)) { fail(url + ' does not exist under public/'); continue; }

  const actual = crypto.createHash('sha384').update(fs.readFileSync(file)).digest('base64');
  if (actual !== declared) {
    fail(url + ' integrity mismatch: expected sha384-' + actual);
  } else {
    console.log('ok  ' + url);
  }
}

console.log('SRI: ' + (checked - failures) + '/' + checked + ' assets verified');
if (checked === 0 || failures > 0) process.exit(1);
