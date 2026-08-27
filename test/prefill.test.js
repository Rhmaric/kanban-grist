'use strict';

// Prefill a la creation d'une carte : rester visible malgre filtres / Select By.
// Scenarios inspires de CANDIDATS selectionne par OFFRES (colonne Ref Offres).

var test = require('node:test');
var assert = require('node:assert/strict');
var L = require('../logic.js');

test('encodeCommonPrefill: valeur commune, Ref vide (=0) valide, divergence → rien', function () {
  assert.equal(L.encodeCommonPrefill({ type: 'Text' }, ['a', 'a']), 'a');
  assert.equal(L.encodeCommonPrefill({ type: 'Text' }, ['a', 'b']), undefined);
  // 0 = reference vide en Grist ; ne pas le traiter comme "absent".
  assert.equal(L.encodeCommonPrefill({ type: 'Ref:OFFRES' }, [0, 0]), 0);
  assert.equal(L.encodeCommonPrefill({ type: 'Text' }, [null, null]), undefined);
  // Une carte sans valeur empeche de deduire (undefined dans le lot).
  assert.equal(L.encodeCommonPrefill({ type: 'Text' }, [1, undefined]), undefined);
});

test('encodeCommonPrefill ChoiceList: intersection (Select By sur liste)', function () {
  assert.deepEqual(
    L.encodeCommonPrefill({ type: 'ChoiceList' }, [['L', 'a', 'b'], ['L', 'b', 'c']]),
    ['L', 'b']
  );
  assert.equal(
    L.encodeCommonPrefill({ type: 'ChoiceList' }, [['L', 'a'], ['L', 'b']]),
    undefined
  );
});

test('collectPrefillFromRecords: Select By — Ref commune lue dans la table (ids bruts)', function () {
  // onRecords n'a souvent pas la colonne Offres (hors mapping) : on lit fetchTable.
  var columnMeta = {
    Offres: { type: 'Ref:OFFRES', isFormula: false },
    Statut: { type: 'Choice', isFormula: false },
    Score: { type: 'Numeric', isFormula: true },
  };
  var records = [{ id: 1 }, { id: 2 }];
  var table = {
    id: [1, 2, 3],
    Offres: [7, 7, 9],
    Statut: ['Bloque', 'Screening', 'Nouveau'],
    Score: [1, 1, 1],
  };

  var fields = L.collectPrefillFromRecords(
    ['Offres', 'Statut', 'Score'],
    'Statut', // colonne de groupe Kanban : ne jamais la preremplir ici
    records,
    columnMeta,
    table
  );
  // Offres=7 commun aux cartes visibles ; Statut exclu (groupe) ; Score formule ignoree.
  assert.deepEqual(fields, { Offres: 7 });
});

test('collectPrefillFromRecords: preferer id Ref de la table a une valeur affichee', function () {
  // Si Offres est aussi en Proprietes, onRecords peut envoyer le libelle expandé.
  var columnMeta = { Offres: { type: 'Ref:OFFRES', isFormula: false } };
  var records = [
    { id: 1, Offres: 'Ingenieur Full Stack' },
    { id: 2, Offres: 'Ingenieur Full Stack' },
  ];
  var table = { id: [1, 2], Offres: [42, 42] };
  var fields = L.collectPrefillFromRecords(['Offres'], null, records, columnMeta, table);
  assert.deepEqual(fields, { Offres: 42 });
});

test('parseSavedFilterFields: included seulement, hors formules et hors autres sections', function () {
  var columnMeta = {
    Source: { type: 'Text', isFormula: false },
    Tags: { type: 'ChoiceList', isFormula: false },
    Calc: { type: 'Text', isFormula: true },
  };
  var colIdByRef = { 1: 'Source', 2: 'Tags', 3: 'Calc' };
  var filters = {
    id: [1, 2, 3, 4, 5],
    viewSectionRef: [10, 10, 10, 99, 10],
    colRef: [1, 2, 3, 1, 1],
    filter: [
      JSON.stringify({ included: ['web'] }),
      JSON.stringify({ included: ['urgent'] }),
      JSON.stringify({ included: ['x'] }),
      JSON.stringify({ included: ['other-section'] }),
      // excluded : pas de valeur unique a ecrire
      JSON.stringify({ excluded: ['spam'] }),
    ],
  };
  var fields = L.parseSavedFilterFields(filters, 10, 'Statut', columnMeta, colIdByRef);
  assert.deepEqual(fields, { Source: 'web', Tags: ['L', 'urgent'] });
});

test('mergePrefillParts: les parties suivantes ecrasent (summary / filtres apres inference)', function () {
  assert.deepEqual(L.mergePrefillParts([{ a: 1 }, { b: 2 }, { a: 3 }]), { a: 3, b: 2 });
});

test('resolveSectionRef: desambiguise deux widgets meme URL via Select By', function () {
  // Cas Widget Builder : plusieurs sections custom partagent la meme URL.
  var sections = {
    id: [1, 2, 3],
    tableRef: [5, 5, 9],
    parentKey: ['custom', 'custom', 'custom'],
    options: [
      JSON.stringify({ customView: { url: 'https://ex.test/w/', columnsMapping: { Titre: 1 } } }),
      JSON.stringify({ customView: { url: 'https://ex.test/w/', columnsMapping: { Titre: 1 } } }),
      JSON.stringify({ customView: { url: 'https://ex.test/w/' } }),
    ],
    linkSrcSectionRef: [0, 8, 0],
  };
  assert.equal(
    L.resolveSectionRef(
      sections,
      5,
      'https://ex.test/w/',
      { Titre: 'Nom', Groupe: 'Statut', Proprietes: [] },
      { 1: 'Nom' }
    ),
    2
  );
});

test('resolveSectionRef: ambiguite sans lien → null (pas de filtres sauves)', function () {
  var sections = {
    id: [1, 2],
    tableRef: [5, 5],
    parentKey: ['custom', 'custom'],
    options: [
      JSON.stringify({ customView: { url: 'https://ex.test/w/' } }),
      JSON.stringify({ customView: { url: 'https://ex.test/w/' } }),
    ],
    linkSrcSectionRef: [0, 0],
  };
  assert.equal(
    L.resolveSectionRef(sections, 5, 'https://ex.test/w/', { Titre: 'Nom' }, {}),
    null
  );
});

test('summaryGroupColIds: colonnes de groupement d un tableau recapitulatif', function () {
  var sections = { id: [20], tableRef: [3] };
  var tables = { id: [3, 1], summarySourceTable: [1, 0] };
  var cols = {
    id: [100, 101],
    parentId: [3, 3],
    summarySourceCol: [50, 0],
  };
  assert.deepEqual(
    L.summaryGroupColIds(20, 1, sections, tables, cols, { 50: 'Departement' }),
    ['Departement']
  );
});
