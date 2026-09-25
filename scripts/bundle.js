'use strict';

// Pour chaque widget : concatene, dans l'ordre, les <script src> locaux de index.html
// dans widget.bundle.js, remplace ces balises par une seule, et copie styles.css.

var fs = require('fs');
var path = require('path');

var root = path.join(__dirname, '..');
var dist = path.join(root, 'dist');

var SCRIPT_TAG = /[ \t]*<script src="([^"]+)"><\/script>\n?/g;

function bundle(srcDir, outDir) {
  var html = fs.readFileSync(path.join(srcDir, 'index.html'), 'utf8');

  var sources = [];
  var m;
  while ((m = SCRIPT_TAG.exec(html))) {
    if (/^[a-z]+:\/\//i.test(m[1])) throw new Error('Script externe interdit : ' + m[1]);
    sources.push(path.join(srcDir, m[1]));
  }
  if (!sources.length) throw new Error('Aucun script dans ' + srcDir);

  var js = sources.map(function (file) { return fs.readFileSync(file, 'utf8'); }).join('\n;\n');

  var first = true;
  var bundledHtml = html.replace(SCRIPT_TAG, function (tag) {
    if (!first) return '';
    first = false;
    var indent = /^[ \t]*/.exec(tag)[0];
    return indent + '<script src="widget.bundle.js"></script>\n';
  });

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'widget.bundle.js'), js + '\n');
  fs.writeFileSync(path.join(outDir, 'index.html'), bundledHtml);
  fs.copyFileSync(path.join(srcDir, 'styles.css'), path.join(outDir, 'styles.css'));
  console.log('Wrote ' + path.relative(root, outDir) + '/ (' + sources.length + ' scripts)');
}

// Le kanban reste a la racine de dist/ : son URL publique est deja referencee dans des documents Grist.
bundle(path.join(root, 'kanban'), dist);
bundle(path.join(root, 'risk-matrix'), path.join(dist, 'risk-matrix'));
