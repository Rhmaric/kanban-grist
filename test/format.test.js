'use strict';

// Rendu lecture seule des proprietes de carte (types Grist + hyperliens + PJ).

var test = require('node:test');
var assert = require('node:assert/strict');
var L = require('../logic.js');

test('formatScalar: Bool, Ref, liste, Date (secondes epoch Grist)', function () {
  assert.equal(L.formatScalar('Bool', true), 'Oui');
  assert.equal(L.formatScalar('Bool', false), 'Non');
  assert.equal(L.formatScalar('Ref:T', 12), '#12');
  assert.equal(L.formatScalar('RefList:T', ['L', 1, 2]), '#1, #2');
  assert.equal(L.formatScalar('Text', null), '');
  // Midi UTC le 1er janv. 2020 → reste en 2020 dans les fuseaux usuels (fr-FR force).
  var label = L.formatScalar('Date', 1577880000);
  assert.match(label, /2020/);
  assert.notEqual(label, '1577880000');
});

test('parseHyperlink: format Grist "label URL" ou URL seule', function () {
  assert.deepEqual(L.parseHyperlink('Doc https://ex.test/a'), {
    label: 'Doc',
    url: 'https://ex.test/a',
  });
  assert.deepEqual(L.parseHyperlink('https://ex.test/a'), {
    label: 'link',
    url: 'https://ex.test/a',
  });
  assert.equal(L.parseHyperlink('pas un lien'), null);
});

test('isImageAttachment / isPdfAttachment: routage de la visionneuse', function () {
  assert.equal(L.isImageAttachment({ type: 'image/png' }), true);
  assert.equal(L.isImageAttachment({ name: 'photo.JPG' }), true);
  assert.equal(L.isPdfAttachment({ type: 'application/pdf' }), true);
  assert.equal(L.isPdfAttachment({ name: 'doc.pdf' }), true);
  assert.equal(L.isPdfAttachment({ name: 'doc.txt' }), false);
});

test('escapeHtml: messages d aide injectes en innerHTML', function () {
  assert.equal(L.escapeHtml('<b>&"\''), '&lt;b&gt;&amp;&quot;&#39;');
});
