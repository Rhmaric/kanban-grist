'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var R = require('../../risk-matrix/logic.js');

test('riskLevel: reproduit la matrice de reference case par case', function () {
  // Lignes = gravite 4 → 1, colonnes = probabilite 1 → 4.
  var attendu = {
    4: ['jaune', 'orange', 'rouge', 'rouge'],
    3: ['jaune', 'jaune', 'orange', 'rouge'],
    2: ['vert', 'jaune', 'jaune', 'orange'],
    1: ['vert', 'vert', 'jaune', 'jaune'],
  };
  R.NIVEAUX.forEach(function (g) {
    R.NIVEAUX.forEach(function (p) {
      assert.equal(R.riskLevel(g, p), attendu[g][p - 1], 'G' + g + ' P' + p);
    });
  });
});

test('riskLevelLabel: chaque niveau a un libelle, un niveau inconnu leve', function () {
  R.NIVEAUX_RISQUE.forEach(function (lvl) { assert.ok(R.riskLevelLabel(lvl)); });
  assert.throws(function () { R.riskLevelLabel('bleu'); });
});

test('parseLevel: entiers 1..4 uniquement', function () {
  assert.equal(R.parseLevel(null), null);
  assert.equal(R.parseLevel(undefined), null);
  assert.equal(R.parseLevel(''), null);
  assert.equal(R.parseLevel(0), null);
  assert.equal(R.parseLevel(5), null);
  assert.equal(R.parseLevel(2.5), null);
  assert.equal(R.parseLevel(true), null);
  assert.equal(R.parseLevel('abc'), null);
  assert.equal(R.parseLevel('3'), 3);
  assert.equal(R.parseLevel(3), 3);
});

test('placeRecords: repartit dans les cases, le reste hors matrice, ordre conserve', function () {
  var mappings = { Gravite: 'G', Probabilite: 'P' };
  var records = [
    { id: 1, G: 2, P: 2 },
    { id: 9, G: 2, P: 2 },
    { id: 5, G: 4, P: 2 },
    { id: 7, G: 4, P: 1 },
    { id: 3, G: null, P: 2 },
    { id: 4, G: 5, P: 1 },
    { id: 6, G: 1, P: 0 },
  ];
  var res = R.placeRecords(records, mappings);
  assert.equal(Object.keys(res.cells).length, 16);
  assert.deepEqual(res.cells['2:2'], [1, 9]);
  assert.deepEqual(res.cells['4:2'], [5]);
  assert.deepEqual(res.cells['4:1'], [7]);
  assert.deepEqual(res.cells['1:1'], []);
  assert.deepEqual(res.horsMatrice, [3, 4, 6]);
});

test('placeRecords: sans mapping, tout est vide', function () {
  var res = R.placeRecords([{ id: 1, G: 1, P: 1 }], {});
  assert.deepEqual(res.horsMatrice, []);
  assert.deepEqual(res.cells['1:1'], []);
});

test('isConfigured: gravite et probabilite obligatoires', function () {
  assert.equal(R.isConfigured(null), false);
  assert.equal(R.isConfigured({ Gravite: 'G' }), false);
  assert.equal(R.isConfigured({ Probabilite: 'P' }), false);
  assert.equal(R.isConfigured({ Gravite: 'G', Probabilite: 'P' }), true);
});

test('parseCellKey: cle valide → {g, p}, sinon null', function () {
  assert.deepEqual(R.parseCellKey('3:2'), { g: 3, p: 2 });
  assert.deepEqual(R.parseCellKey(R.cellKey(4, 1)), { g: 4, p: 1 });
  assert.equal(R.parseCellKey('5:1'), null);
  assert.equal(R.parseCellKey('0:2'), null);
  assert.equal(R.parseCellKey('3-2'), null);
  assert.equal(R.parseCellKey(''), null);
  assert.equal(R.parseCellKey(undefined), null);
});

test('buildMoveFields: ecrit les deux colonnes associees', function () {
  assert.deepEqual(
    R.buildMoveFields({ Gravite: 'Grav', Probabilite: 'Proba' }, 3, 2),
    { Grav: 3, Proba: 2 }
  );
});

test('canEditFromSearchParams: readonly et access', function () {
  assert.equal(R.canEditFromSearchParams(''), true);
  assert.equal(R.canEditFromSearchParams('?access=full'), true);
  assert.equal(R.canEditFromSearchParams('?access=read+table'), false);
  assert.equal(R.canEditFromSearchParams('?access=full&readonly=true'), false);
  assert.equal(R.canEditFromSearchParams(undefined), true);
});

test('riskLabel', function () {
  assert.equal(R.riskLabel(12), 'R12');
});
