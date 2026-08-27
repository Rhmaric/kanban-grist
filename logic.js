// Logique pure du Kanban (sans grist / DOM). UMD : KanbanLogic en navigateur, module.exports sous Node.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.KanbanLogic = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // --- Constantes -----------------------------------------------------------

  var FALLBACK_COLOR = ['#ececfe', '#3a3a3a'];
  var ZOOM_MIN = 50;
  var ZOOM_MAX = 150;
  var ZOOM_DEFAUT = 100;
  var ZOOM_OPTION_KEY = 'zoom';
  var MAPPING_KEYS = ['Titre', 'Groupe', 'Proprietes'];

  // --- Zoom / acces ---------------------------------------------------------

  function clampZoom(v) {
    if (v == null || v === '') return ZOOM_DEFAUT;
    var n = Number(v);
    if (!isFinite(n)) return ZOOM_DEFAUT;
    return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(n)));
  }

  function isConfigured(mappings) {
    return !!(mappings && mappings.Titre && mappings.Groupe);
  }

  function canEditFromSearchParams(search) {
    var p = new URLSearchParams(typeof search === 'string' ? search : '');
    if (p.get('readonly') === 'true') return false;
    var access = p.get('access');
    return access == null || access === 'full';
  }

  // --- Parsing / listes -----------------------------------------------------

  function parseWidgetOptions(raw) {
    try { return JSON.parse(raw || '{}'); } catch (e) { return {}; }
  }

  function parseCustomViewDef(rawOptions) {
    var cv = parseWidgetOptions(rawOptions).customView;
    if (typeof cv === 'string') return parseWidgetOptions(cv);
    return cv || {};
  }

  function normalizeList(v) {
    if (Array.isArray(v)) return v;
    if (v == null || v === '') return [];
    return [v];
  }

  function decodeChoiceList(raw) {
    if (Array.isArray(raw)) return raw[0] === 'L' ? raw.slice(1) : raw;
    return [];
  }

  function widgetUrlKey(url, baseHref) {
    try {
      var u = new URL(url, baseHref || 'https://example.invalid/');
      return u.origin + u.pathname;
    } catch (e) {
      return null;
    }
  }

  // --- Schema colonnes ------------------------------------------------------

  function buildChoiceDefs(widgetOptions) {
    var choices = (widgetOptions && widgetOptions.choices) || [];
    var choiceOptions = (widgetOptions && widgetOptions.choiceOptions) || {};
    return choices.map(function (val) {
      var co = choiceOptions[val] || {};
      return {
        id: val,
        libelle: val,
        colors: [co.fillColor || FALLBACK_COLOR[0], co.textColor || FALLBACK_COLOR[1]],
      };
    });
  }

  function buildColumnMeta(columnsTable, tableRef) {
    var byColId = {};
    var colIdByRef = {};
    var c = columnsTable || {};
    if (!c.id) return { byColId: byColId, colIdByRef: colIdByRef };
    for (var i = 0; i < c.id.length; i++) {
      if (c.parentId[i] !== tableRef) continue;
      byColId[c.colId[i]] = {
        colId: c.colId[i],
        ref: c.id[i],
        type: c.type[i],
        label: c.label[i],
        isFormula: Boolean(c.isFormula[i] && c.formula[i]),
        widgetOptions: parseWidgetOptions(c.widgetOptions[i]),
      };
      colIdByRef[c.id[i]] = c.colId[i];
    }
    return { byColId: byColId, colIdByRef: colIdByRef };
  }

  function buildPropDefs(mappings, byColId) {
    return normalizeList(mappings && mappings.Proprietes).map(function (colId) {
      var m = byColId[colId];
      if (!m) return null;
      var isChoice = m.type === 'Choice';
      var isChoiceList = m.type === 'ChoiceList';
      return {
        colId: colId,
        label: m.label || colId,
        type: m.type,
        isChoice: isChoice,
        isChoiceList: isChoiceList,
        isAttachments: m.type === 'Attachments',
        choiceDefs: (isChoice || isChoiceList) ? buildChoiceDefs(m.widgetOptions) : [],
      };
    }).filter(Boolean);
  }

  function buildAttachmentMeta(attachmentsTable) {
    var meta = {};
    var a = attachmentsTable || {};
    if (!a.id) return meta;
    for (var i = 0; i < a.id.length; i++) {
      meta[a.id[i]] = {
        name: a.fileName ? a.fileName[i] : '',
        type: a.fileType ? a.fileType[i] : '',
      };
    }
    return meta;
  }

  // --- Prefill --------------------------------------------------------------

  function isListColType(type) {
    return type === 'ChoiceList' || type === 'Attachments' || (type && type.indexOf('RefList:') === 0);
  }

  function isRefColType(type) {
    return Boolean(type && (type.indexOf('Ref:') === 0 || type.indexOf('RefList:') === 0));
  }

  function cellEqual(a, b) {
    if (a === b) return true;
    if (Array.isArray(a) && Array.isArray(b)) return JSON.stringify(a) === JSON.stringify(b);
    return false;
  }

  function encodeCommonPrefill(meta, values) {
    if (!meta || !values.length) return undefined;
    if (values.some(function (v) { return v === undefined; })) return undefined;
    if (isListColType(meta.type)) {
      var lists = values.map(decodeChoiceList);
      var common = lists[0].filter(function (v) {
        return lists.every(function (lst) { return lst.indexOf(v) >= 0; });
      });
      if (!common.length) return undefined;
      return ['L'].concat(common);
    }
    var first = values[0];
    for (var i = 1; i < values.length; i++) {
      if (!cellEqual(first, values[i])) return undefined;
    }
    if (first == null || first === '') return undefined;
    return first;
  }

  function writablePrefillColIds(colIds, groupeColId, columnMeta) {
    return (colIds || []).filter(function (colId) {
      if (!colId || colId === groupeColId) return false;
      var meta = columnMeta[colId];
      return meta && !meta.isFormula;
    });
  }

  function indexTableByRowId(table) {
    var indexById = {};
    if (!table || !table.id) return indexById;
    for (var i = 0; i < table.id.length; i++) {
      indexById[table.id[i]] = i;
      indexById[String(table.id[i])] = i;
    }
    return indexById;
  }

  function tableCell(table, indexById, rowId, colId) {
    if (!table || !table[colId] || !indexById) return undefined;
    var idx = indexById[rowId];
    if (idx === undefined) idx = indexById[String(rowId)];
    return idx === undefined ? undefined : table[colId][idx];
  }

  // Deduit les valeurs communes a ecrire sur une nouvelle carte.
  // Pour les Ref, preferer tableData (ids bruts) aux records (souvent expandes).
  function collectPrefillFromRecords(colIds, groupeColId, records, columnMeta, tableData) {
    colIds = writablePrefillColIds(colIds, groupeColId, columnMeta);
    if (!colIds.length || !(records || []).length) return {};

    var indexById = tableData ? indexTableByRowId(tableData) : null;
    var fields = {};
    colIds.forEach(function (colId) {
      var preferRaw = isRefColType(columnMeta[colId] && columnMeta[colId].type);
      var values = records.map(function (r) {
        if (preferRaw) return tableCell(tableData, indexById, r.id, colId);
        if (r[colId] !== undefined) return r[colId];
        return tableCell(tableData, indexById, r.id, colId);
      });
      var encoded = encodeCommonPrefill(columnMeta[colId], values);
      if (encoded !== undefined) fields[colId] = encoded;
    });
    return fields;
  }

  function inferConstantRefColIds(columnMeta) {
    return Object.keys(columnMeta || {}).filter(function (colId) {
      return isRefColType(columnMeta[colId] && columnMeta[colId].type);
    });
  }

  function parseSavedFilterFields(filtersTable, sectionRef, groupeColId, columnMeta, colIdByRef) {
    var fields = {};
    var f = filtersTable || {};
    if (!f.id) return fields;
    for (var i = 0; i < f.id.length; i++) {
      if (f.viewSectionRef[i] !== sectionRef) continue;
      var colId = colIdByRef[f.colRef[i]];
      if (!colId || colId === groupeColId) continue;
      var meta = columnMeta[colId];
      if (!meta || meta.isFormula) continue;
      var included = parseWidgetOptions(f.filter[i]).included;
      if (!Array.isArray(included) || !included.length) continue;
      var val = included[0];
      if (val == null || val === '') continue;
      fields[colId] = meta.type === 'ChoiceList' ? ['L', val] : val;
    }
    return fields;
  }

  function mergePrefillParts(parts) {
    var fields = {};
    (parts || []).forEach(function (part) {
      if (!part) return;
      Object.keys(part).forEach(function (k) { fields[k] = part[k]; });
    });
    return fields;
  }

  // --- Resolution de section ------------------------------------------------

  function mappingMatches(columnsMapping, currentMappings, colIdByRef) {
    if (!columnsMapping || !currentMappings) return false;
    return MAPPING_KEYS.every(function (name) {
      var theirs = normalizeList(columnsMapping[name]).map(function (ref) { return colIdByRef[ref]; });
      var mine = normalizeList(currentMappings[name]);
      return theirs.length === mine.length && theirs.every(function (colId, i) { return colId === mine[i]; });
    });
  }

  // Retourne l'id de section unique, ou null si ambigu / introuvable.
  function resolveSectionRef(sections, tableRef, ourUrl, currentMappings, colIdByRef) {
    var candidats = [];
    if (!sections || !sections.id) return null;
    for (var i = 0; i < sections.id.length; i++) {
      if (sections.tableRef[i] !== tableRef || sections.parentKey[i] !== 'custom') continue;
      candidats.push({ ref: sections.id[i], def: parseCustomViewDef(sections.options[i]) });
    }
    var parUrl = candidats.filter(function (c) {
      return c.def.url && widgetUrlKey(c.def.url) === ourUrl;
    });
    if (parUrl.length) candidats = parUrl;
    if (candidats.length > 1) {
      var parMapping = candidats.filter(function (c) {
        return mappingMatches(c.def.columnsMapping, currentMappings, colIdByRef);
      });
      if (parMapping.length) candidats = parMapping;
    }
    if (candidats.length > 1) {
      var avecLien = candidats.filter(function (c) {
        var j = sections.id.indexOf(c.ref);
        return j >= 0 && sections.linkSrcSectionRef[j];
      });
      if (avecLien.length === 1) candidats = avecLien;
    }
    return candidats.length === 1 ? candidats[0].ref : null;
  }

  function summaryGroupColIds(srcSectionRef, ourTableRef, sections, tables, cols, colIdByRef) {
    var si = (sections.id || []).indexOf(srcSectionRef);
    if (si < 0) return [];
    var srcTableRef = sections.tableRef[si];
    var ti = (tables.id || []).indexOf(srcTableRef);
    if (ti < 0 || tables.summarySourceTable[ti] !== ourTableRef) return [];
    var colIds = [];
    for (var i = 0; i < cols.id.length; i++) {
      if (cols.parentId[i] !== srcTableRef) continue;
      var srcCol = cols.summarySourceCol ? cols.summarySourceCol[i] : 0;
      if (!srcCol) continue;
      var colId = colIdByRef[srcCol];
      if (colId) colIds.push(colId);
    }
    return colIds;
  }

  // --- Affichage ------------------------------------------------------------

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatScalar(type, raw) {
    if (raw == null || raw === '') return '';
    if (type === 'Bool') return raw ? 'Oui' : 'Non';
    if (type && (type === 'Date' || type === 'DateTime' || type.indexOf('Date') === 0)) {
      var n = Number(raw);
      if (!isNaN(n) && n !== 0) {
        var d = new Date(n * 1000);
        if (!isNaN(d.getTime())) return d.toLocaleDateString('fr-FR');
      }
      return String(raw);
    }
    if (type && type.indexOf('Ref:') === 0) return raw ? ('#' + raw) : '';
    if (type && type.indexOf('RefList:') === 0) {
      var ids = decodeChoiceList(raw);
      return ids.length ? ids.map(function (id) { return '#' + id; }).join(', ') : '';
    }
    if (Array.isArray(raw)) return raw[0] === 'L' ? raw.slice(1).join(', ') : String(raw);
    return String(raw);
  }

  function parseHyperlink(raw) {
    if (raw == null || typeof raw !== 'string') return null;
    var s = raw.trim();
    if (!s) return null;
    var withLabel = s.match(/^(.+?)\s+(https?:\/\/\S+)$/i);
    if (withLabel) {
      return { label: withLabel[1].trim() || 'link', url: withLabel[2] };
    }
    var urlOnly = s.match(/^(https?:\/\/\S+)$/i);
    if (urlOnly) return { label: 'link', url: urlOnly[1] };
    return null;
  }

  function isImageAttachment(meta) {
    meta = meta || {};
    return /^image\//.test(meta.type || '') || /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(meta.name || '');
  }

  function isPdfAttachment(meta) {
    meta = meta || {};
    return (meta.type || '') === 'application/pdf' || /\.pdf$/i.test(meta.name || '');
  }

  // Surface publique : helpers testes + appeles par widget.js.
  // Les utilitaires internes (cellEqual, isRefColType, …) restent prives.
  return {
    FALLBACK_COLOR: FALLBACK_COLOR,
    ZOOM_MIN: ZOOM_MIN,
    ZOOM_MAX: ZOOM_MAX,
    ZOOM_DEFAUT: ZOOM_DEFAUT,
    ZOOM_OPTION_KEY: ZOOM_OPTION_KEY,

    clampZoom: clampZoom,
    canEditFromSearchParams: canEditFromSearchParams,
    isConfigured: isConfigured,

    parseWidgetOptions: parseWidgetOptions,
    parseCustomViewDef: parseCustomViewDef,
    normalizeList: normalizeList,
    decodeChoiceList: decodeChoiceList,
    widgetUrlKey: widgetUrlKey,

    buildChoiceDefs: buildChoiceDefs,
    buildColumnMeta: buildColumnMeta,
    buildPropDefs: buildPropDefs,
    buildAttachmentMeta: buildAttachmentMeta,

    encodeCommonPrefill: encodeCommonPrefill,
    writablePrefillColIds: writablePrefillColIds,
    collectPrefillFromRecords: collectPrefillFromRecords,
    inferConstantRefColIds: inferConstantRefColIds,
    parseSavedFilterFields: parseSavedFilterFields,
    mergePrefillParts: mergePrefillParts,

    resolveSectionRef: resolveSectionRef,
    summaryGroupColIds: summaryGroupColIds,

    escapeHtml: escapeHtml,
    formatScalar: formatScalar,
    parseHyperlink: parseHyperlink,
    isImageAttachment: isImageAttachment,
    isPdfAttachment: isPdfAttachment,
  };
}));
