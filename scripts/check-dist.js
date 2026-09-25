'use strict';

// Verifie les pages publiees dans dist/ : aucune ressource externe ni inline, CSP stricte presente.

var fs = require('fs');
var path = require('path');

var root = path.join(__dirname, '..');
var dist = path.join(root, 'dist');

// Schema (https:, data:, javascript:...) ou URL relative au protocole (//hote).
var EXTERNAL_URL = /^\s*([a-z][a-z0-9+.-]*:|\/\/)/i;

function findIndexFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).reduce(function (acc, entry) {
    var full = path.join(dir, entry.name);
    if (entry.isDirectory()) return acc.concat(findIndexFiles(full));
    if (entry.name === 'index.html') acc.push(full);
    return acc;
  }, []);
}

function cspDirectives(html) {
  var m = /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"/i.exec(html);
  if (!m) return null;
  var directives = {};
  m[1].split(';').forEach(function (part) {
    var tokens = part.trim().split(/\s+/).filter(Boolean);
    if (tokens.length) directives[tokens[0]] = tokens.slice(1);
  });
  return directives;
}

function checkPage(file) {
  var errors = [];
  var dir = path.dirname(file);
  var html = fs.readFileSync(file, 'utf8');

  // Une balise fermante peut porter des espaces ou des attributs ignores (</script >, </script x>).
  // Toute forme non couverte fait echouer le comptage ci-dessous : le controle echoue par defaut.
  var scriptTag = /<script\b([^>]*)>([\s\S]*?)<\/script\b[^>]*>/gi;
  var scriptCount = 0;
  var m;
  while ((m = scriptTag.exec(html))) {
    scriptCount++;
    var src = /\bsrc\s*=\s*(["'])(.*?)\1/i.exec(m[1]);
    if (!src) errors.push('script sans src entre guillemets');
    else if (EXTERNAL_URL.test(src[2])) errors.push('script externe : ' + src[2]);
    if (m[2].trim()) errors.push('contenu de script inline');
  }
  if ((html.match(/<script\b/gi) || []).length !== scriptCount) errors.push('balise <script> non reconnue');

  var linkTag = /<link\b[^>]*\bhref\s*=\s*(["'])(.*?)\1/gi;
  while ((m = linkTag.exec(html))) {
    if (EXTERNAL_URL.test(m[2])) errors.push('ressource externe : ' + m[2]);
  }

  if (/<style\b/i.test(html)) errors.push('balise <style> inline');
  if (/\sstyle\s*=/i.test(html)) errors.push('attribut style= inline');
  if (/\son[a-z]+\s*=/i.test(html)) errors.push('gestionnaire d\'evenement inline (on*=)');

  var csp = cspDirectives(html);
  if (!csp) {
    errors.push('balise CSP absente');
  } else {
    if (String(csp['default-src']) !== "'none'") errors.push("CSP : default-src doit valoir 'none'");
    var scriptSrc = csp['script-src'] || [];
    if (scriptSrc.join(' ') !== "'self'") errors.push("CSP : script-src doit valoir 'self'");
    ['script-src', 'style-src'].forEach(function (d) {
      (csp[d] || []).forEach(function (v) {
        if (/unsafe-(inline|eval)|^\*$|^https?:$|^data:$/.test(v)) errors.push('CSP : ' + d + ' autorise ' + v);
      });
    });
  }

  ['widget.bundle.js', 'styles.css'].forEach(function (name) {
    if (!fs.existsSync(path.join(dir, name))) errors.push(name + ' absent');
  });

  return errors;
}

if (!fs.existsSync(dist)) {
  console.error('dist/ absent : lancer npm run bundle');
  process.exit(1);
}

var pages = findIndexFiles(dist);
var failed = false;
pages.forEach(function (file) {
  var rel = path.relative(root, file);
  var errors = checkPage(file);
  if (errors.length) {
    failed = true;
    console.error(rel + ' :\n  - ' + errors.join('\n  - '));
  } else {
    console.log(rel + ' : OK');
  }
});

if (!pages.length) {
  console.error('Aucune page dans dist/');
  failed = true;
}
if (failed) process.exit(1);
