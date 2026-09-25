'use strict';

// Verifie que les dependances de vendor/ sont presentes et n'evaluent pas de code dynamique
// (bloque par la CSP script-src 'self').

var fs = require('fs');
var path = require('path');

var vendorDir = path.join(__dirname, '..', 'vendor');
var FILES = ['grist-plugin-api.js', 'Sortable.min.js'];

// Cible le devtool "eval" de webpack. Les Function(...) de lodash embarques dans l'API plugin
// (repli global inatteignable en navigateur, _.template non utilise) ne sont pas vises ;
// s'ils s'executaient, la CSP les bloquerait.
var DYNAMIC_CODE = /\beval\s*\(|new\s+Function\s*\(/;

var errors = [];
FILES.forEach(function (name) {
  var file = path.join(vendorDir, name);
  if (!fs.existsSync(file)) {
    errors.push('Fichier manquant : vendor/' + name + ' (lancer npm run vendor:update)');
    return;
  }
  if (DYNAMIC_CODE.test(fs.readFileSync(file, 'utf8'))) {
    errors.push('Evaluation de code dynamique : vendor/' + name);
  }
});

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('vendor/ : ' + FILES.length + ' fichier(s) conforme(s)');
