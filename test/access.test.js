'use strict';

// Grist ajoute ?access=…&readonly=… a l'URL de l'iframe. CAN_EDIT decide si les
// boutons d'ajout / suppression sont affiches.

var test = require('node:test');
var assert = require('node:assert/strict');
var L = require('../logic.js');

test('canEditFromSearchParams: full (ou absent) editable, sinon lecture seule', function () {
  // Hors Grist / ancienne API : pas de params → on laisse les boutons visibles.
  assert.equal(L.canEditFromSearchParams(''), true);
  assert.equal(L.canEditFromSearchParams('access=full'), true);
  assert.equal(L.canEditFromSearchParams('access=full&readonly=false'), true);

  assert.equal(L.canEditFromSearchParams('readonly=true'), false);
  // Document en lecture seule meme avec access=full.
  assert.equal(L.canEditFromSearchParams('access=full&readonly=true'), false);
  assert.equal(L.canEditFromSearchParams('access=read%20table'), false);
});
