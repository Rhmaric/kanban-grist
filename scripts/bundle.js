'use strict';

// Pour chaque widget : concatene, dans l'ordre, les <script src> locaux de index.html
// dans widget.bundle.js, remplace ces balises par une seule, et copie styles.css.

var fs = require('fs');
var path = require('path');

var root = path.join(__dirname, '..');
var dist = path.join(root, 'dist');

// Tolere attributs, guillemets simples, casse et balise fermante avec espaces ou attributs
// (</script >, </script x>) : une balise non reconnue resterait telle quelle dans dist/ et
// echapperait au refus des scripts externes ; le comptage de SCRIPT_OPEN le garantit.
var SCRIPT_TAG = /[ \t]*<script\b([^>]*)>([\s\S]*?)<\/script\b[^>]*>[ \t]*\n?/gi;
var SCRIPT_OPEN = /<script\b/gi;
var SRC_ATTR = /\bsrc\s*=\s*(["'])(.*?)\1/i;
var BUNDLE_TAG = '<script src="widget.bundle.js"></script>';

function bundle(srcDir, outDir) {
  var html = fs.readFileSync(path.join(srcDir, 'index.html'), 'utf8');

  var sources = [];
  var m;
  while ((m = SCRIPT_TAG.exec(html))) {
    var src = SRC_ATTR.exec(m[1]);
    if (!src) throw new Error('Script sans src entre guillemets dans ' + srcDir);
    if (m[2].trim()) throw new Error('Script inline interdit dans ' + srcDir);
    if (/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(src[2])) throw new Error('Script externe interdit : ' + src[2]);
    sources.push(path.join(srcDir, src[2]));
  }
  if (!sources.length) throw new Error('Aucun script dans ' + srcDir);
  if ((html.match(SCRIPT_OPEN) || []).length !== sources.length) {
    throw new Error('Balise <script> non reconnue dans ' + srcDir);
  }

  var js = sources.map(function (file) { return fs.readFileSync(file, 'utf8'); }).join('\n;\n');

  var first = true;
  var bundledHtml = html.replace(SCRIPT_TAG, function (tag) {
    if (!first) return '';
    first = false;
    var indent = /^[ \t]*/.exec(tag)[0];
    return indent + BUNDLE_TAG + '\n';
  });
  // Retirer une balise peut recoller le texte voisin en un nouveau "<script"
  // (ex. "<scr<script ...></script>ipt ...>") : on verifie le resultat, pas l'entree.
  var restants = bundledHtml.match(SCRIPT_OPEN) || [];
  if (restants.length !== 1 || bundledHtml.indexOf(BUNDLE_TAG) < 0) {
    throw new Error('Balise <script> inattendue apres bundle dans ' + srcDir);
  }

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'widget.bundle.js'), js + '\n');
  fs.writeFileSync(path.join(outDir, 'index.html'), bundledHtml);
  fs.copyFileSync(path.join(srcDir, 'styles.css'), path.join(outDir, 'styles.css'));
  console.log('Wrote ' + path.relative(root, outDir) + '/ (' + sources.length + ' scripts)');
}

// Le kanban reste a la racine de dist/ : son URL publique est deja referencee dans des documents Grist.
bundle(path.join(root, 'kanban'), dist);
bundle(path.join(root, 'risk-matrix'), path.join(dist, 'risk-matrix'));
