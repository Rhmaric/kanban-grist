'use strict';

var fs = require('fs');
var path = require('path');

var root = path.join(__dirname, '..');
var outDir = path.join(root, 'dist');
var outJs = path.join(outDir, 'widget.bundle.js');
var outHtml = path.join(outDir, 'index.html');

var parts = ['logic.js', 'widget.js'].map(function (name) {
  return fs.readFileSync(path.join(root, name), 'utf8');
});

var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace(
  /<script src="logic\.js"><\/script>\s*<script src="widget\.js"><\/script>/,
  '<script src="widget.bundle.js"></script>'
);

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outJs, parts.join('\n\n') + '\n');
fs.writeFileSync(outHtml, html);
console.log('Wrote ' + path.relative(root, outJs));
console.log('Wrote ' + path.relative(root, outHtml));
