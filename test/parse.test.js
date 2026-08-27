'use strict';

// Metadonnees Grist : widgetOptions / customView / listes encodees ['L', …].

var test = require('node:test');
var assert = require('node:assert/strict');
var L = require('../logic.js');

test('parseWidgetOptions: JSON invalide → objet vide (colonne sans options)', function () {
  assert.deepEqual(L.parseWidgetOptions(null), {});
  assert.deepEqual(L.parseWidgetOptions('{'), {});
  assert.deepEqual(L.parseWidgetOptions('{"a":1}'), { a: 1 });
});

test('parseCustomViewDef: customView parfois objet, parfois JSON stringifie deux fois', function () {
  // Forme "objet" dans options.
  assert.deepEqual(L.parseCustomViewDef('{"customView":{"url":"https://x"}}'), { url: 'https://x' });
  // Forme rencontree en fetchTable : customView est lui-meme une chaine JSON.
  assert.deepEqual(
    L.parseCustomViewDef(JSON.stringify({ customView: JSON.stringify({ url: 'https://y' }) })),
    { url: 'https://y' }
  );
  assert.deepEqual(L.parseCustomViewDef('{}'), {});
});

test('normalizeList: mapping Proprietes (une colonne ou plusieurs)', function () {
  assert.deepEqual(L.normalizeList(null), []);
  assert.deepEqual(L.normalizeList('Adequation'), ['Adequation']);
  assert.deepEqual(L.normalizeList(['A', 'B']), ['A', 'B']);
});

test('decodeChoiceList: format Grist ChoiceList / Attachments / RefList', function () {
  assert.deepEqual(L.decodeChoiceList(['L', 'x', 'y']), ['x', 'y']);
  // Deja decode ou valeur simple.
  assert.deepEqual(L.decodeChoiceList(['x']), ['x']);
  assert.deepEqual(L.decodeChoiceList(null), []);
});

test('widgetUrlKey: ignore ?access=&readonly= pour comparer a la section', function () {
  assert.equal(
    L.widgetUrlKey('https://ex.test/w/index.html?access=full&readonly=false'),
    'https://ex.test/w/index.html'
  );
});
