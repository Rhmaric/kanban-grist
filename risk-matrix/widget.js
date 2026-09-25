// ============================================================================
// MATRICE DES RISQUES
// Chaque ligne est placee dans une matrice 4x4 selon les colonnes Gravite et
// Probabilite choisies dans les parametres de la vue Grist. Un clic sur une
// pastille deplace le curseur Grist sur la ligne ; la glisser vers une autre
// case ecrit la gravite et la probabilite correspondantes.
// ============================================================================

var R = RiskMatrixLogic;

const TOAST_DUREE = 5000;

const CAN_EDIT = R.canEditFromSearchParams(window.location.search);

// ============================================================================
// ETAT
// ============================================================================

var currentMappings = null;
var currentRecords = [];
var selectedRowId = null;
var resolvedTableId = null;
var dragActive = false;

// ============================================================================
// GRIST
// ============================================================================

grist.ready({
  requiredAccess: 'full',
  allowSelectBy: true,
  columns: [
    // optional: sinon Grist masque notre ecran d'aide tant que les axes ne sont pas mappes.
    { name: 'Gravite',     title: 'Gravité',              type: 'Int',  optional: true },
    { name: 'Probabilite', title: 'Probabilité',          type: 'Int',  optional: true },
    { name: 'Intitule',    title: 'Intitulé (infobulle)', type: 'Text', optional: true },
  ],
});

grist.onRecords(function (records, mappings) {
  currentRecords = records || [];
  currentMappings = mappings || {};
  render();
});

grist.onRecord(function (record) {
  var rowId = record && record.id != null ? parseInt(record.id) : null;
  highlight(rowId);
});

function ensureTableId() {
  if (resolvedTableId) return Promise.resolve(resolvedTableId);
  var op = grist.selectedTable || (grist.getTable && grist.getTable());
  if (!op || typeof op.getTableId !== 'function') {
    return Promise.reject(new Error('table du widget introuvable'));
  }
  return op.getTableId().then(function (id) {
    if (!id) throw new Error('table du widget introuvable');
    resolvedTableId = id;
    return id;
  });
}

// ============================================================================
// ECRITURE
// ============================================================================

function showToast(msg) {
  var el = document.createElement('div');
  el.className = 'toast toast-erreur';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(function () { el.remove(); }, TOAST_DUREE);
}

function moveRisk(rowId, g, p) {
  var fields = R.buildMoveFields(currentMappings, g, p);
  return ensureTableId().then(function (tableId) {
    return grist.docApi.applyUserActions([['UpdateRecord', tableId, rowId, fields]]);
  }).catch(function (e) {
    showToast('Deplacement impossible: ' + (e && e.message ? e.message : e));
    render();
  });
}

// ============================================================================
// SELECTION
// ============================================================================

function highlight(rowId) {
  selectedRowId = rowId;
  document.querySelectorAll('.pastille.pastille-selected').forEach(function (el) {
    el.classList.remove('pastille-selected');
  });
  if (rowId == null) return;
  var el = document.querySelector('.pastille[data-row-id="' + rowId + '"]');
  if (el) el.classList.add('pastille-selected');
}

function selectRisk(rowId) {
  highlight(rowId);
  if (typeof grist.setCursorPos === 'function') {
    grist.setCursorPos({ rowId: rowId }).catch(function (e) {
      console.warn('setCursorPos:', e && e.message ? e.message : e);
    });
  }
}

// ============================================================================
// RENDU
// ============================================================================

function showAide() {
  document.getElementById('page-aide').hidden = false;
  document.getElementById('app').hidden = true;
}

function showMatrice() {
  document.getElementById('page-aide').hidden = true;
  document.getElementById('app').hidden = false;
}

function makeEl(tag, className, text) {
  var el = document.createElement(tag);
  if (className) el.className = className;
  if (text != null) el.textContent = text;
  return el;
}

function tooltip(row) {
  var parts = [R.riskLabel(row.id)];
  var intitule = currentMappings.Intitule ? row[currentMappings.Intitule] : '';
  if (intitule) parts[0] += ' \u2013 ' + intitule;
  var g = R.parseLevel(row[currentMappings.Gravite]);
  var p = R.parseLevel(row[currentMappings.Probabilite]);
  var gTxt = g != null ? g + ' (' + R.LIBELLES_GRAVITE[g] + ')' : 'non renseignée';
  var pTxt = p != null ? p + ' (' + R.LIBELLES_PROBABILITE[p] + ')' : 'non renseignée';
  parts.push('Gravité : ' + gTxt);
  parts.push('Probabilité : ' + pTxt);
  return parts.join('\n');
}

function buildPastille(row, level) {
  var btn = makeEl('button', 'pastille' + (level ? ' pastille-' + level : ''));
  btn.type = 'button';
  var rowId = parseInt(row.id);
  btn.dataset.rowId = rowId;
  btn.title = tooltip(row);
  if (selectedRowId === rowId) btn.classList.add('pastille-selected');
  btn.appendChild(makeEl('span', 'pastille-dot'));
  btn.appendChild(makeEl('span', 'pastille-ref', R.riskLabel(rowId)));
  btn.onclick = function () {
    if (dragActive) return;
    selectRisk(rowId);
  };
  return btn;
}

function buildAxes(matrice) {
  var titreG = makeEl('div', 'axe-titre axe-titre-gravite', 'Gravité');
  var titreP = makeEl('div', 'axe-titre axe-titre-probabilite', 'Probabilité');
  matrice.appendChild(titreG);
  matrice.appendChild(titreP);

  R.NIVEAUX.forEach(function (n) {
    var lg = makeEl('div', 'libelle-gravite');
    lg.style.gridRow = String(5 - n);
    lg.appendChild(makeEl('span', 'libelle-num', String(n)));
    lg.appendChild(makeEl('span', 'libelle-texte', R.LIBELLES_GRAVITE[n]));
    matrice.appendChild(lg);

    var lp = makeEl('div', 'libelle-probabilite');
    lp.style.gridColumn = String(n + 2);
    lp.appendChild(makeEl('span', 'libelle-num', String(n)));
    lp.appendChild(makeEl('span', 'libelle-texte', R.LIBELLES_PROBABILITE[n]));
    matrice.appendChild(lp);
  });
}

function buildCell(g, p, rowIds, rowsById) {
  var level = R.riskLevel(g, p);
  var cell = makeEl('div', 'case case-' + level);
  cell.dataset.cle = R.cellKey(g, p);
  cell.setAttribute('role', 'gridcell');
  cell.setAttribute('aria-label',
    'Gravité ' + g + ', probabilité ' + p + ' : risque ' + R.riskLevelLabel(level).toLowerCase());
  // Gravite 4 en haut, probabilite 4 a droite.
  cell.style.gridRow = String(5 - g);
  cell.style.gridColumn = String(p + 2);
  cell.appendChild(makeEl('span', 'case-compteur', rowIds.length ? String(rowIds.length) : ''));
  rowIds.forEach(function (id) {
    cell.appendChild(buildPastille(rowsById[id], level));
  });
  return cell;
}

function buildLegende() {
  var legende = document.getElementById('legende');
  legende.innerHTML = '';
  R.NIVEAUX_RISQUE.forEach(function (level) {
    var item = makeEl('span', 'legende-item');
    item.appendChild(makeEl('span', 'legende-carre legende-' + level));
    item.appendChild(document.createTextNode(R.riskLevelLabel(level)));
    legende.appendChild(item);
  });
}

function horsTitre(n) {
  return 'Non positionnés (' + n + ')';
}

function buildHorsMatrice(rowIds, rowsById) {
  var band = document.getElementById('hors-matrice');
  band.innerHTML = '';
  band.hidden = !rowIds.length;
  if (!rowIds.length) return;
  band.appendChild(makeEl('span', 'hors-titre', horsTitre(rowIds.length)));
  rowIds.forEach(function (id) {
    band.appendChild(buildPastille(rowsById[id], null));
  });
}

// ============================================================================
// GLISSER-DEPOSER
// ============================================================================

function refreshCounters() {
  document.querySelectorAll('#matrice .case').forEach(function (cell) {
    var n = cell.querySelectorAll('.pastille').length;
    cell.querySelector('.case-compteur').textContent = n ? String(n) : '';
  });
  var band = document.getElementById('hors-matrice');
  var restants = band.querySelectorAll('.pastille').length;
  band.hidden = !restants;
  var titre = band.querySelector('.hors-titre');
  if (titre) titre.textContent = horsTitre(restants);
}

function clearDropTarget() {
  document.querySelectorAll('.case.case-cible').forEach(function (el) {
    el.classList.remove('case-cible');
  });
}

function onRiskMoved(evt) {
  if (evt.from === evt.to) return;
  var cible = R.parseCellKey(evt.to.dataset.cle);
  if (!cible) return;
  var pastille = evt.item;
  var rowId = parseInt(pastille.dataset.rowId);

  R.NIVEAUX_RISQUE.forEach(function (lvl) { pastille.classList.remove('pastille-' + lvl); });
  pastille.classList.add('pastille-' + R.riskLevel(cible.g, cible.p));
  refreshCounters();

  selectRisk(rowId);
  moveRisk(rowId, cible.g, cible.p);
}

function makeSortable(zone, acceptsDrop) {
  new Sortable(zone, {
    group: { name: 'risk-matrix', pull: true, put: acceptsDrop },
    sort: false,
    draggable: '.pastille',
    animation: 150,
    ghostClass: 'sortable-ghost',
    dragClass: 'sortable-drag',
    onStart: function () { dragActive = true; },
    onMove: function (evt) {
      clearDropTarget();
      if (evt.to.classList.contains('case')) evt.to.classList.add('case-cible');
    },
    onEnd: function (evt) {
      clearDropTarget();
      onRiskMoved(evt);
      setTimeout(function () { dragActive = false; }, 0);
    },
  });
}

function setupDragAndDrop() {
  document.querySelectorAll('#matrice .case').forEach(function (cell) { makeSortable(cell, true); });
  makeSortable(document.getElementById('hors-matrice'), false);
}

function render() {
  if (!R.isConfigured(currentMappings)) {
    showAide();
    return;
  }
  showMatrice();

  var rowsById = {};
  currentRecords.forEach(function (row) { rowsById[row.id] = row; });

  if (selectedRowId != null && !rowsById[selectedRowId]) selectedRowId = null;

  var placed = R.placeRecords(currentRecords, currentMappings);
  var matrice = document.getElementById('matrice');
  matrice.innerHTML = '';
  buildAxes(matrice);
  R.NIVEAUX.forEach(function (g) {
    R.NIVEAUX.forEach(function (p) {
      matrice.appendChild(buildCell(g, p, placed.cells[R.cellKey(g, p)], rowsById));
    });
  });

  buildLegende();
  buildHorsMatrice(placed.horsMatrice, rowsById);

  document.getElementById('app').classList.toggle('peut-editer', CAN_EDIT);
  if (CAN_EDIT) setupDragAndDrop();
}
