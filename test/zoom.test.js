'use strict';

// Curseur "Taille" : une option effacee / corrompue ne doit PAS tomber sur ZOOM_MIN
// (Number(null)===0 et Number('')===0).

var test = require('node:test');
var assert = require('node:assert/strict');
var L = require('../logic.js');

test('clampZoom: valeurs absentes → defaut, sinon borne [min, max]', function () {
  assert.equal(L.clampZoom(null), L.ZOOM_DEFAUT);
  assert.equal(L.clampZoom(''), L.ZOOM_DEFAUT);
  assert.equal(L.clampZoom('abc'), L.ZOOM_DEFAUT);
  assert.equal(L.clampZoom(10), L.ZOOM_MIN);
  assert.equal(L.clampZoom(200), L.ZOOM_MAX);
  assert.equal(L.clampZoom(87.4), 87);
});
