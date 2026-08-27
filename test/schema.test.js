'use strict';

// Construction du schema a partir des tables metadonnees Grist (format colonnaire).

var test = require('node:test');
var assert = require('node:assert/strict');
var L = require('../logic.js');

test('buildChoiceDefs: couleurs des colonnes Kanban (choix + repli)', function () {
  var defs = L.buildChoiceDefs({
    choices: ['Nouveau', 'Bloque'],
    choiceOptions: { Nouveau: { fillColor: '#111', textColor: '#eee' } },
  });
  assert.equal(defs[0].id, 'Nouveau');
  assert.deepEqual(defs[0].colors, ['#111', '#eee']);
  // Choix sans couleur configuree → palette de repli du widget.
  assert.deepEqual(defs[1].colors, L.FALLBACK_COLOR);
});

test('buildColumnMeta: filtre la table, detecte les vraies formules', function () {
  // isFormula=true sans formule = colonne vide encore editable (piege Grist).
  var table = {
    id: [10, 11, 12],
    parentId: [1, 1, 2],
    colId: ['Nom', 'Calc', 'Autre'],
    type: ['Text', 'Text', 'Text'],
    label: ['Nom', 'Calc', 'Autre'],
    isFormula: [false, true, true],
    formula: ['', '1+1', ''],
    widgetOptions: ['{}', '{}', '{}'],
  };
  var built = L.buildColumnMeta(table, 1);
  assert.equal(built.byColId.Nom.isFormula, false);
  assert.equal(built.byColId.Calc.isFormula, true);
  assert.equal(built.colIdByRef[10], 'Nom');
  // parentId 2 → autre table, ignoree.
  assert.equal(built.byColId.Autre, undefined);
});

test('buildPropDefs: ignore les colonnes non mappees, prepare les badges Choice', function () {
  var byColId = {
    Statut: { type: 'Choice', label: 'Statut', widgetOptions: { choices: ['X'] } },
    Note: { type: 'Text', label: 'Note', widgetOptions: {} },
  };
  var props = L.buildPropDefs({ Proprietes: ['Statut', 'Note', 'Missing'] }, byColId);
  assert.equal(props.length, 2);
  assert.equal(props[0].isChoice, true);
  assert.equal(props[0].choiceDefs.length, 1);
  assert.equal(props[1].isChoice, false);
});

test('isConfigured: Titre et Groupe doivent etre mappes', function () {
  assert.equal(L.isConfigured(null), false);
  assert.equal(L.isConfigured({}), false);
  assert.equal(L.isConfigured({ Titre: 'Nom' }), false);
  assert.equal(L.isConfigured({ Groupe: 'Statut' }), false);
  assert.equal(L.isConfigured({ Titre: 'Nom', Groupe: 'Statut' }), true);
  assert.equal(L.isConfigured({ Titre: 'Nom', Groupe: 'Statut', Proprietes: ['Note'] }), true);
});

test('buildAttachmentMeta: table _grist_Attachments → { id: {name, type} }', function () {
  assert.deepEqual(
    L.buildAttachmentMeta({
      id: [3],
      fileName: ['cv.pdf'],
      fileType: ['application/pdf'],
    }),
    { 3: { name: 'cv.pdf', type: 'application/pdf' } }
  );
});
