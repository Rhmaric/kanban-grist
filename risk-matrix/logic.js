// Logique pure de la matrice des risques (sans grist / DOM). UMD : RiskMatrixLogic en navigateur, module.exports sous Node.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RiskMatrixLogic = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // --- Constantes -----------------------------------------------------------

  var NIVEAUX = [1, 2, 3, 4];

  var LIBELLES_GRAVITE = {
    1: 'Faible',
    2: 'Limitée',
    3: 'Importante',
    4: 'Critique',
  };

  var LIBELLES_PROBABILITE = {
    1: 'Peu probable',
    2: 'Probable',
    3: 'Très probable',
    4: 'Quasi-certain',
  };

  var NIVEAUX_RISQUE = ['vert', 'jaune', 'orange', 'rouge'];

  // --- Configuration --------------------------------------------------------

  function isConfigured(mappings) {
    return !!(mappings && mappings.Gravite && mappings.Probabilite);
  }

  function canEditFromSearchParams(search) {
    var p = new URLSearchParams(typeof search === 'string' ? search : '');
    if (p.get('readonly') === 'true') return false;
    var access = p.get('access');
    return access == null || access === 'full';
  }

  // --- Niveaux --------------------------------------------------------------

  function parseLevel(v) {
    if (v == null || v === '' || typeof v === 'boolean') return null;
    var n = Number(v);
    if (!Number.isInteger(n)) return null;
    return NIVEAUX.indexOf(n) >= 0 ? n : null;
  }

  // Seuils sur g x p : reproduit la matrice de reference (produits possibles : 1..4, 6, 8, 9, 12, 16).
  function riskLevel(g, p) {
    var score = g * p;
    if (score <= 2) return 'vert';
    if (score <= 6) return 'jaune';
    if (score <= 9) return 'orange';
    return 'rouge';
  }

  function riskLevelLabel(level) {
    switch (level) {
      case 'vert': return 'Faible';
      case 'jaune': return 'Modéré';
      case 'orange': return 'Élevé';
      case 'rouge': return 'Critique';
      default: throw new Error('Niveau de risque inconnu : ' + level);
    }
  }

  function cellKey(g, p) {
    return g + ':' + p;
  }

  function parseCellKey(key) {
    var m = /^(\d+):(\d+)$/.exec(typeof key === 'string' ? key : '');
    if (!m) return null;
    var g = parseLevel(m[1]);
    var p = parseLevel(m[2]);
    return g != null && p != null ? { g: g, p: p } : null;
  }

  function buildMoveFields(mappings, g, p) {
    var fields = {};
    fields[mappings.Gravite] = g;
    fields[mappings.Probabilite] = p;
    return fields;
  }

  function riskLabel(rowId) {
    return 'R' + rowId;
  }

  // Repartit les lignes dans les 16 cases ; l'ordre d'entree (tri de la vue) est conserve.
  function placeRecords(records, mappings) {
    var cells = {};
    var horsMatrice = [];
    NIVEAUX.forEach(function (g) {
      NIVEAUX.forEach(function (p) { cells[cellKey(g, p)] = []; });
    });
    if (!isConfigured(mappings)) return { cells: cells, horsMatrice: horsMatrice };

    (records || []).forEach(function (row) {
      var g = parseLevel(row[mappings.Gravite]);
      var p = parseLevel(row[mappings.Probabilite]);
      if (g == null || p == null) horsMatrice.push(row.id);
      else cells[cellKey(g, p)].push(row.id);
    });
    return { cells: cells, horsMatrice: horsMatrice };
  }

  return {
    NIVEAUX: NIVEAUX,
    LIBELLES_GRAVITE: LIBELLES_GRAVITE,
    LIBELLES_PROBABILITE: LIBELLES_PROBABILITE,
    NIVEAUX_RISQUE: NIVEAUX_RISQUE,

    isConfigured: isConfigured,
    canEditFromSearchParams: canEditFromSearchParams,
    parseLevel: parseLevel,
    riskLevel: riskLevel,
    riskLevelLabel: riskLevelLabel,
    cellKey: cellKey,
    parseCellKey: parseCellKey,
    buildMoveFields: buildMoveFields,
    riskLabel: riskLabel,
    placeRecords: placeRecords,
  };
}));
