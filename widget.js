// ============================================================================
// CONFIGURATION
// La table est detectee dynamiquement (repli sur DEFAULT_TABLE_ID). Les colonnes
// (Titre / Groupe / Proprietes visibles) sont choisies par l'utilisateur
// dans les parametres de la vue Grist. L'ordre des cartes suit le tri (et
// les filtres) configures dans l'onglet "Trier et Filtrer" de la vue.
// ============================================================================

var L = KanbanLogic;

// Repli si getTableId() echoue (hors Grist / ancienne API).
const DEFAULT_TABLE_ID = 'TACHES';

const ZOOM_PERSIST_DELAI = 300;
const TOAST_DUREE = 5000;
const NOUVELLE_CARTE_DELAI = 1500;

const ICONE_PLUS = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">'
  + '<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>';

const ICONE_CORBEILLE = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">'
  + '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" stroke="currentColor" '
  + 'stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const CAN_EDIT = L.canEditFromSearchParams(window.location.search);

// ============================================================================
// ETAT
// ============================================================================

var currentMappings = null;
var schemaSignature = null;
var resolvedTableId = null;

var groupDefs = [];
var propDefs = [];
var attachmentMeta = {};

var columnMeta = {};
var colIdByRef = {};

var resolvedSectionRef = null;
var sectionRefResolved = false;

var zonesByGroupe = {};
var selectedRowId = null;
var cardDragActive = false;

var pendingNewRowId = null;
var pendingNewTimer = null;
var currentRecords = [];

var currentZoom = L.ZOOM_DEFAUT;
var zoomPersistTimer = null;

// ============================================================================
// ZOOM
// ============================================================================

function applyZoom(pct) {
  currentZoom = pct;
  document.documentElement.style.setProperty('--zoom', pct / 100);
  var out = document.getElementById('zoom-valeur');
  if (out) out.textContent = pct + ' %';
}

function persistZoom(pct) {
  clearTimeout(zoomPersistTimer);
  zoomPersistTimer = setTimeout(function () {
    grist.setOption(L.ZOOM_OPTION_KEY, pct).catch(function (e) {
      console.warn('Zoom non memorise:', e && e.message ? e.message : e);
    });
  }, ZOOM_PERSIST_DELAI);
}

function setupZoomControl() {
  var input = document.getElementById('zoom-range');
  if (!input) return;
  input.min = L.ZOOM_MIN;
  input.max = L.ZOOM_MAX;
  input.value = currentZoom;
  input.addEventListener('input', function () {
    var pct = L.clampZoom(input.value);
    applyZoom(pct);
    persistZoom(pct);
  });
}

setupZoomControl();

// ============================================================================
// GRIST
// ============================================================================

grist.ready({
  requiredAccess: 'full',
  allowSelectBy: true,
  columns: [
    { name: 'Titre',      title: 'Titre de la carte',   type: 'Text' },
    { name: 'Groupe',     title: 'Grouper par',         type: 'Choice' },
    { name: 'Proprietes', title: 'Proprietes visibles', type: 'Any', allowMultiple: true, optional: true },
  ],
});

grist.onOptions(function (options) {
  var pct = L.clampZoom(options ? options[L.ZOOM_OPTION_KEY] : L.ZOOM_DEFAUT);
  if (pct === currentZoom) return;
  applyZoom(pct);
  var input = document.getElementById('zoom-range');
  if (input) input.value = pct;
});

grist.onRecords(function (records, mappings) {
  currentRecords = records || [];
  currentMappings = mappings || {};
  ensureTableId().then(function () { loadSchemaThenRender(records); });
});

function ensureTableId() {
  if (resolvedTableId) return Promise.resolve(resolvedTableId);
  var op = grist.selectedTable || (grist.getTable && grist.getTable());
  if (op && typeof op.getTableId === 'function') {
    return op.getTableId().then(function (id) {
      resolvedTableId = id || DEFAULT_TABLE_ID;
      return resolvedTableId;
    }).catch(function () {
      resolvedTableId = DEFAULT_TABLE_ID;
      return resolvedTableId;
    });
  }
  resolvedTableId = DEFAULT_TABLE_ID;
  return Promise.resolve(resolvedTableId);
}

function tableId() {
  return resolvedTableId || DEFAULT_TABLE_ID;
}

function fetchTableRowRef(id) {
  return grist.docApi.fetchTable('_grist_Tables').then(function (t) {
    var i = (t.tableId || []).indexOf(id);
    return i >= 0 ? t.id[i] : null;
  });
}

function loadSchemaThenRender(records) {
  var sig = JSON.stringify(currentMappings) + '|' + tableId();
  if (schemaSignature === sig) { render(records); return; }

  fetchTableRowRef(tableId()).then(function (tableRef) {
    return grist.docApi.fetchTable('_grist_Tables_column').then(function (c) {
      var built = L.buildColumnMeta(c, tableRef);
      columnMeta = built.byColId;
      colIdByRef = built.colIdByRef;
      return columnMeta;
    });
  }).then(function (byColId) {
    var groupeMeta = currentMappings.Groupe ? byColId[currentMappings.Groupe] : null;
    groupDefs = groupeMeta ? L.buildChoiceDefs(groupeMeta.widgetOptions) : [];
    propDefs = L.buildPropDefs(currentMappings, byColId);

    if (!propDefs.some(function (d) { return d.isAttachments; })) {
      attachmentMeta = {};
      schemaSignature = sig;
      render(records);
      return;
    }
    return grist.docApi.fetchTable('_grist_Attachments').then(function (a) {
      attachmentMeta = L.buildAttachmentMeta(a);
    }).catch(function () {
      attachmentMeta = {};
    }).then(function () {
      schemaSignature = sig;
      render(records);
    });
  }).catch(function (e) {
    console.error('Erreur de lecture du schema Grist:', e);
    render(records);
  });
}

// ============================================================================
// ECRITURE
// ============================================================================

function updateField(rowId, col, value) {
  if (!col) return Promise.resolve();
  var rec = {};
  rec[col] = value;
  return grist.docApi.applyUserActions([['UpdateRecord', tableId(), rowId, rec]])
    .catch(function (e) { showToast('Erreur: ' + e.message, 'erreur'); });
}

function showToast(msg, type) {
  var el = document.createElement('div');
  el.className = 'toast toast-' + (type || 'erreur');
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(function () { el.remove(); }, TOAST_DUREE);
}

// ============================================================================
// CREATION / PREFILL
// ============================================================================

function resolveSectionRef() {
  if (sectionRefResolved) return Promise.resolve(resolvedSectionRef);
  return Promise.all([
    fetchTableRowRef(tableId()),
    grist.docApi.fetchTable('_grist_Views_section'),
  ]).then(function (res) {
    resolvedSectionRef = L.resolveSectionRef(
      res[1],
      res[0],
      L.widgetUrlKey(window.location.href),
      currentMappings,
      colIdByRef
    );
    sectionRefResolved = true;
    return resolvedSectionRef;
  }).catch(function (e) {
    console.warn('Section du widget indeterminable:', e && e.message ? e.message : e);
    sectionRefResolved = true;
    return null;
  });
}

// Toujours passer par fetchTable : les Ref du mapping sont souvent expandes dans onRecords.
function prefillFromVisibleRecords(colIds, groupeColId) {
  if (!currentRecords.length) return Promise.resolve({});
  return grist.docApi.fetchTable(tableId()).then(function (table) {
    return L.collectPrefillFromRecords(colIds, groupeColId, currentRecords, columnMeta, table);
  });
}

function inferConstantRefFields(groupeColId) {
  return prefillFromVisibleRecords(L.inferConstantRefColIds(columnMeta), groupeColId);
}

// Select By classique (Ref cible) : couvert par inferConstantRefFields.
// Ici uniquement le linking via tableau recapitulatif (colonnes de groupement).
function fetchSummaryPrefillFields(sectionRef, groupeColId) {
  return Promise.all([
    grist.docApi.fetchTable('_grist_Views_section'),
    fetchTableRowRef(tableId()),
    grist.docApi.fetchTable('_grist_Tables'),
    grist.docApi.fetchTable('_grist_Tables_column'),
  ]).then(function (res) {
    var sections = res[0];
    var i = (sections.id || []).indexOf(sectionRef);
    if (i < 0) return {};
    var srcSectionRef = sections.linkSrcSectionRef[i];
    if (!srcSectionRef) return {};
    if (sections.linkTargetColRef[i] || sections.linkSrcColRef[i]) return {};
    var colIds = L.summaryGroupColIds(
      srcSectionRef, res[1], sections, res[2], res[3], colIdByRef
    );
    return prefillFromVisibleRecords(colIds, groupeColId);
  }).catch(function (e) {
    console.warn('Summary Select By non lu:', e && e.message ? e.message : e);
    return {};
  });
}

function fetchSavedFilterFields(sectionRef, groupeColId) {
  return grist.docApi.fetchTable('_grist_Filters').then(function (f) {
    return L.parseSavedFilterFields(f, sectionRef, groupeColId, columnMeta, colIdByRef);
  });
}

function fetchPrefillFields(groupeColId) {
  return resolveSectionRef().then(function (sectionRef) {
    var tasks = [inferConstantRefFields(groupeColId)];
    if (sectionRef) {
      tasks.push(fetchSavedFilterFields(sectionRef, groupeColId));
      tasks.push(fetchSummaryPrefillFields(sectionRef, groupeColId));
    }
    return Promise.all(tasks).then(L.mergePrefillParts);
  }).catch(function (e) {
    console.warn('Filtres non lus:', e && e.message ? e.message : e);
    return inferConstantRefFields(groupeColId);
  });
}

function watchNewCard(rowId) {
  pendingNewRowId = rowId;
  clearTimeout(pendingNewTimer);
  pendingNewTimer = setTimeout(function () {
    if (pendingNewRowId !== rowId) return;
    pendingNewRowId = null;
    showToast('Carte creee, mais masquee par les filtres actifs de la vue.', 'info');
  }, NOUVELLE_CARTE_DELAI);
}

function createCard(groupeId) {
  var groupeCol = currentMappings && currentMappings.Groupe;
  if (!groupeCol) return;
  fetchPrefillFields(groupeCol).then(function (fields) {
    fields[groupeCol] = groupeId;
    return grist.docApi.applyUserActions([['AddRecord', tableId(), null, fields]]);
  }).then(function (res) {
    var rowId = res && res.retValues && res.retValues[0];
    if (!rowId) return;
    selectCard(rowId);
    watchNewCard(rowId);
  }).catch(function (e) {
    showToast('Creation impossible: ' + (e && e.message ? e.message : e), 'erreur');
  });
}

function deleteCard(rowId) {
  return grist.docApi.applyUserActions([['RemoveRecord', tableId(), rowId]])
    .then(function () {
      if (selectedRowId === rowId) selectedRowId = null;
    })
    .catch(function (e) {
      showToast('Suppression impossible: ' + (e && e.message ? e.message : e), 'erreur');
    });
}

function selectCard(rowId) {
  if (!rowId) return;
  selectedRowId = rowId;
  document.querySelectorAll('.carte.carte-selected').forEach(function (el) {
    el.classList.remove('carte-selected');
  });
  var el = document.querySelector('.carte[data-id-tache="' + rowId + '"]');
  if (el) el.classList.add('carte-selected');
  if (typeof grist.setCursorPos === 'function') {
    grist.setCursorPos({ rowId: rowId }).catch(function (e) {
      console.warn('setCursorPos:', e && e.message ? e.message : e);
    });
  }
}

function showAide() {
  var aide = document.getElementById('page-aide');
  var app = document.getElementById('app');
  if (aide) aide.hidden = false;
  if (app) app.hidden = true;
}

function showKanban() {
  var aide = document.getElementById('page-aide');
  var app = document.getElementById('app');
  if (aide) aide.hidden = true;
  if (app) app.hidden = false;
}

function helpMessage(msg) {
  return '<div style="padding:2em;color:#777;font-size:0.85em;">' + L.escapeHtml(msg) + '</div>';
}

// ============================================================================
// PIECES JOINTES / OVERLAYS
// ============================================================================

function openAttachment(attId) {
  var meta = attachmentMeta[attId] || {};
  grist.docApi.getAccessToken({ readOnly: true }).then(function (t) {
    var url = t.baseUrl + '/attachments/' + attId + '/download?auth=' + encodeURIComponent(t.token) + '&inline=true';
    if (meta.name) url += '&name=' + encodeURIComponent(meta.name);
    showAttachmentViewer(url, meta);
  }).catch(function (e) {
    showToast('Impossible d\'ouvrir la piece jointe: ' + (e && e.message ? e.message : e), 'erreur');
  });
}

function openOverlay(box) {
  var ov = document.createElement('div');
  ov.className = 'viewer-overlay';
  ov.appendChild(box);
  document.body.appendChild(ov);

  function close() {
    ov.remove();
    document.removeEventListener('keydown', onKey);
  }
  function onKey(e) { if (e.key === 'Escape') close(); }

  ov.onclick = function (e) { if (e.target === ov) close(); };
  document.addEventListener('keydown', onKey);
  return close;
}

function showAttachmentViewer(url, meta) {
  var name = meta.name || 'Piece jointe';

  var box = document.createElement('div');
  box.className = 'viewer-box';

  var head = document.createElement('div');
  head.className = 'viewer-head';
  var title = document.createElement('span');
  title.className = 'viewer-title';
  title.textContent = name;
  var closeBtn = document.createElement('button');
  closeBtn.className = 'viewer-close';
  closeBtn.type = 'button';
  closeBtn.title = 'Fermer';
  closeBtn.innerHTML = '&times;';
  head.appendChild(title);
  head.appendChild(closeBtn);

  var body = document.createElement('div');
  body.className = 'viewer-body';

  if (L.isImageAttachment(meta)) {
    var img = document.createElement('img');
    img.className = 'viewer-media';
    img.alt = name;
    img.src = url;
    body.appendChild(img);
  } else if (L.isPdfAttachment(meta)) {
    var frame = document.createElement('iframe');
    frame.className = 'viewer-frame';
    frame.src = url;
    body.appendChild(frame);
  } else {
    var fb = document.createElement('div');
    fb.className = 'viewer-fallback';
    fb.appendChild(document.createTextNode('Apercu non disponible pour ce type de fichier.'));
    var dl = document.createElement('a');
    dl.className = 'viewer-dl';
    dl.href = url;
    dl.target = '_blank';
    dl.rel = 'noopener';
    dl.textContent = 'Telecharger ' + name;
    fb.appendChild(dl);
    body.appendChild(fb);
  }

  box.appendChild(head);
  box.appendChild(body);
  closeBtn.onclick = openOverlay(box);
}

function confirmDeleteCard(rowId, titre) {
  var box = document.createElement('div');
  box.className = 'confirm-box';

  var titreEl = document.createElement('div');
  titreEl.className = 'confirm-titre';
  titreEl.textContent = 'Supprimer la carte ?';

  var texte = document.createElement('div');
  texte.className = 'confirm-texte';
  texte.textContent = titre
    ? ('\u00AB ' + titre + ' \u00BB sera supprimee du document. Cette action est definitive.')
    : 'Cette carte sera supprimee du document. Cette action est definitive.';

  var actions = document.createElement('div');
  actions.className = 'confirm-actions';

  var annuler = document.createElement('button');
  annuler.type = 'button';
  annuler.className = 'btn-secondaire';
  annuler.textContent = 'Annuler';

  var supprimer = document.createElement('button');
  supprimer.type = 'button';
  supprimer.className = 'btn-danger';
  supprimer.textContent = 'Supprimer';

  actions.appendChild(annuler);
  actions.appendChild(supprimer);
  box.appendChild(titreEl);
  box.appendChild(texte);
  box.appendChild(actions);

  var close = openOverlay(box);
  annuler.onclick = close;
  supprimer.onclick = function () {
    close();
    deleteCard(rowId);
  };
  annuler.focus();
}

// ============================================================================
// CARTE / COLONNE
// ============================================================================

function makeAttachmentButton(attId, idx, total) {
  var meta = attachmentMeta[attId] || {};
  var name = meta.name || '';
  var label = name || (total > 1 ? ('Piece jointe ' + (idx + 1)) : 'Ouvrir la piece jointe');
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'carte-attach-btn';
  btn.title = 'Ouvrir la piece jointe';
  var icon = document.createElement('span');
  icon.className = 'carte-attach-icon';
  icon.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
    '<path d="M21.44 11.05l-9.19 9.19a5 5 0 0 1-7.07-7.07l9.19-9.19a3 3 0 0 1 4.24 4.24l-9.2 9.19a1 1 0 0 1-1.41-1.41l8.49-8.49" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var lab = document.createElement('span');
  lab.className = 'carte-attach-label';
  lab.textContent = label;
  btn.appendChild(icon);
  btn.appendChild(lab);
  btn.onclick = function (e) {
    e.stopPropagation();
    openAttachment(attId);
  };
  return btn;
}

function makeBadge(value, choiceDefs) {
  var def = (choiceDefs || []).find(function (d) { return d.id === value; });
  var span = document.createElement('span');
  span.className = 'carte-prop-badge';
  span.style.background = def ? def.colors[0] : L.FALLBACK_COLOR[0];
  span.style.color = def ? def.colors[1] : L.FALLBACK_COLOR[1];
  span.textContent = value;
  return span;
}

function makeHyperlink(link) {
  var a = document.createElement('a');
  a.className = 'carte-prop-link';
  a.href = link.url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.textContent = link.label;
  a.title = link.url;
  a.onclick = function (e) { e.stopPropagation(); };
  return a;
}

function buildPropRow(def, raw) {
  var wrap = document.createElement('div');
  wrap.className = 'carte-prop';

  var lab = document.createElement('span');
  lab.className = 'carte-prop-label';
  lab.textContent = def.label;

  var valWrap = document.createElement('span');
  valWrap.className = 'carte-prop-val';

  if (def.isAttachments) {
    var attIds = L.decodeChoiceList(raw);
    if (!attIds.length) return null;
    attIds.forEach(function (attId, idx) {
      valWrap.appendChild(makeAttachmentButton(attId, idx, attIds.length));
    });
  } else if (def.isChoiceList) {
    var vals = L.decodeChoiceList(raw);
    if (!vals.length) return null;
    vals.forEach(function (v) { valWrap.appendChild(makeBadge(v, def.choiceDefs)); });
  } else if (def.isChoice) {
    if (raw == null || raw === '') return null;
    valWrap.appendChild(makeBadge(String(raw), def.choiceDefs));
  } else {
    var link = L.parseHyperlink(raw);
    if (link) {
      valWrap.appendChild(makeHyperlink(link));
    } else {
      var text = L.formatScalar(def.type, raw);
      if (text === '') return null;
      valWrap.textContent = text;
    }
  }

  wrap.appendChild(lab);
  wrap.appendChild(valWrap);
  return wrap;
}

function makeDeleteButton(rowId, titre) {
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'carte-supprimer';
  btn.title = 'Supprimer la carte';
  btn.innerHTML = ICONE_CORBEILLE;
  btn.onclick = function (e) {
    e.stopPropagation();
    confirmDeleteCard(rowId, titre);
  };
  return btn;
}

function buildCard(row) {
  var carte = document.createElement('div');
  carte.className = 'carte';
  carte.dataset.idTache = row.id;
  var rowId = parseInt(row.id);
  if (selectedRowId === rowId) carte.classList.add('carte-selected');

  var titre = currentMappings.Titre ? (row[currentMappings.Titre] || '') : '';

  var titreEl = document.createElement('div');
  titreEl.className = 'carte-titre';
  titreEl.textContent = titre || '(sans titre)';
  carte.appendChild(titreEl);

  propDefs.forEach(function (def) {
    var propEl = buildPropRow(def, row[def.colId]);
    if (propEl) carte.appendChild(propEl);
  });

  if (CAN_EDIT) carte.appendChild(makeDeleteButton(rowId, titre));

  carte.addEventListener('click', function (e) {
    if (cardDragActive) return;
    if (e.target.closest && e.target.closest('.carte-attach-btn, .carte-prop-link, .carte-supprimer')) return;
    selectCard(rowId);
  });

  return carte;
}

function makeHeaderAddButton(groupeId) {
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'entete-ajout';
  btn.title = 'Ajouter une carte';
  btn.innerHTML = ICONE_PLUS;
  btn.onclick = function () { createCard(groupeId); };
  return btn;
}

function makeFooterAddButton(groupeId) {
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'pied-ajout';
  btn.innerHTML = ICONE_PLUS + '<span>Ajouter une carte</span>';
  btn.onclick = function () { createCard(groupeId); };
  return btn;
}

function buildColumn(def) {
  var col = document.createElement('div');
  col.className = 'colonne-kanban';

  var entete = document.createElement('div');
  entete.className = 'entete-colonne';
  entete.style.background = def.colors[0];
  entete.style.color = def.colors[1];

  var libelle = document.createElement('span');
  libelle.textContent = def.libelle;

  var actions = document.createElement('span');
  actions.className = 'entete-actions';
  var compteur = document.createElement('span');
  compteur.className = 'compteur-colonne';
  compteur.textContent = '0';
  actions.appendChild(compteur);
  if (CAN_EDIT) actions.appendChild(makeHeaderAddButton(def.id));

  entete.appendChild(libelle);
  entete.appendChild(actions);

  var contenu = document.createElement('div');
  contenu.className = 'contenu-colonne';
  contenu.dataset.groupe = def.id;

  col.appendChild(entete);
  col.appendChild(contenu);
  if (CAN_EDIT) col.appendChild(makeFooterAddButton(def.id));
  return col;
}

function refreshCounters() {
  document.querySelectorAll('.colonne-kanban').forEach(function (col) {
    var z = col.querySelector('.contenu-colonne');
    var c = col.querySelector('.compteur-colonne');
    if (z && c) c.textContent = z.children.length;
  });
}

function onCardMoved(evt) {
  var idTache = parseInt(evt.item.dataset.idTache);
  var nouveauGroupe = evt.to.dataset.groupe;
  if (evt.from !== evt.to) updateField(idTache, currentMappings.Groupe, nouveauGroupe);
  selectCard(idTache);
  refreshCounters();
}

function render(records) {
  if (!L.isConfigured(currentMappings)) {
    showAide();
    return;
  }
  showKanban();

  var board = document.getElementById('conteneur-kanban');
  board.innerHTML = '';
  zonesByGroupe = {};

  if (!groupDefs.length) {
    board.innerHTML = helpMessage(
      'La colonne de groupement selectionnee ne definit aucune valeur. Ajoutez des choix a cette colonne '
      + 'dans Grist (vous pourrez aussi les reordonner par glisser-deposer dans l\'editeur de colonne).');
    return;
  }

  groupDefs.forEach(function (def) {
    var col = buildColumn(def);
    board.appendChild(col);
    var zone = col.querySelector('.contenu-colonne');
    zonesByGroupe[def.id] = zone;
    new Sortable(zone, {
      group: 'taches',
      animation: 180,
      ghostClass: 'sortable-ghost',
      dragClass: 'sortable-drag',
      filter: '.carte-attach-btn, .carte-prop-link, .carte-supprimer',
      onStart: function () { cardDragActive = true; },
      onEnd: function (evt) {
        onCardMoved(evt);
        setTimeout(function () { cardDragActive = false; }, 0);
      },
    });
  });

  (records || []).forEach(function (row) {
    var carte = buildCard(row);
    var groupeVal = row[currentMappings.Groupe] || '';
    var zone = zonesByGroupe[groupeVal] || zonesByGroupe[groupDefs[0].id];
    if (zone) zone.appendChild(carte);
  });

  refreshCounters();

  if (selectedRowId != null) {
    var stillThere = (records || []).some(function (r) { return parseInt(r.id) === selectedRowId; });
    if (!stillThere) selectedRowId = null;
  }

  if (pendingNewRowId != null) {
    var nouvelle = document.querySelector('.carte[data-id-tache="' + pendingNewRowId + '"]');
    if (nouvelle) {
      clearTimeout(pendingNewTimer);
      pendingNewRowId = null;
      nouvelle.scrollIntoView({ block: 'nearest' });
    }
  }
}
