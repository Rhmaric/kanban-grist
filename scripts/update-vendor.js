'use strict';

// Telecharge les dependances des widgets dans vendor/ (non versionne), avant npm run bundle.

var fs = require('fs');
var path = require('path');
var zlib = require('zlib');
var crypto = require('crypto');

var SORTABLE_VERSION = '1.15.7';
// docs.getgrist.com sert un build webpack de developpement (devtool "eval"), incompatible
// avec la CSP script-src 'self' ; cette instance sert un build de production.
var GRIST_API_URL = 'https://grist.numerique.gouv.fr/grist-plugin-api.js';

var vendorDir = path.join(__dirname, '..', 'vendor');

function get(url) {
  return fetch(url).then(function (res) {
    if (!res.ok) throw new Error(url + ' : HTTP ' + res.status);
    return res.arrayBuffer();
  }).then(function (buf) { return Buffer.from(buf); });
}

// Lecture minimale d'une archive tar : entetes de 512 octets, contenu aligne sur 512.
function extractFromTar(tar, wanted) {
  var offset = 0;
  while (offset + 512 <= tar.length) {
    var header = tar.subarray(offset, offset + 512);
    var name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/s, '');
    if (!name) break;
    var size = parseInt(header.subarray(124, 136).toString('utf8').replace(/\0.*$/s, '').trim(), 8);
    var start = offset + 512;
    if (name === wanted) return tar.subarray(start, start + size);
    offset = start + Math.ceil(size / 512) * 512;
  }
  throw new Error(wanted + ' absent de l\'archive');
}

function fetchSortable() {
  return get('https://registry.npmjs.org/sortablejs/' + SORTABLE_VERSION).then(function (buf) {
    var meta = JSON.parse(buf.toString('utf8'));
    return get(meta.dist.tarball).then(function (tgz) {
      var actual = 'sha512-' + crypto.createHash('sha512').update(tgz).digest('base64');
      if (actual !== meta.dist.integrity) throw new Error('Tarball sortablejs corrompu');
      return extractFromTar(zlib.gunzipSync(tgz), 'package/Sortable.min.js');
    });
  });
}

Promise.all([get(GRIST_API_URL), fetchSortable()]).then(function (res) {
  var files = { 'grist-plugin-api.js': res[0], 'Sortable.min.js': res[1] };
  fs.mkdirSync(vendorDir, { recursive: true });
  Object.keys(files).forEach(function (name) {
    fs.writeFileSync(path.join(vendorDir, name), files[name]);
    console.log('Wrote vendor/' + name + ' (' + files[name].length + ' octets)');
  });
}).catch(function (e) {
  console.error(e.message);
  process.exit(1);
});
