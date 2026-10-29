/*! AgentFlow — Copyright (c) 2026 Visigence. SPDX-License-Identifier: Apache-2.0 */
'use strict';

// ── Modal ────────────────────────────────────────────────
let _modalEl = null;

function showModal(html) {
  closeModal();
  _modalEl = document.createElement('div');
  _modalEl.className = 'modal-backdrop';
  _modalEl.dataset.action = 'modalBackdrop';
  _modalEl.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
  document.body.appendChild(_modalEl);
  setTimeout(() => _modalEl?.querySelector('input,textarea,select,button')?.focus(), 30);
}
function closeModal() { if (_modalEl) { _modalEl.remove(); _modalEl = null; } }
function modalOpen() { return !!_modalEl; }

// ── Navigation ───────────────────────────────────────────
function selectRun(id)  { setState({ activeRunId: id, selectedNodeId: null, activeCounterfactual: null }); }
function selectNode(id) { setState({ selectedNodeId: state.selectedNodeId === id ? null : id }); }
function setTab(tab)    { setState({ activeTab: tab }); }
function setCf(id)      { setState({ activeCounterfactual: id || null, selectedNodeId: null }); }
function toggleCf(id)   { setState({ activeCounterfactual: state.activeCounterfactual === id ? null : id, activeTab: 'graph' }); }

// ── Export / Import ──────────────────────────────────────
function handleExport() {
  const run = state.runs.find(r => r.id === state.activeRunId);
  if (!run) return;
  const blob = new Blob([JSON.stringify(run, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.rel = 'noopener';
  a.download = run.id.replace(/[^A-Za-z0-9_-]/g, '_') + '.agentflow.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function openImportDialog() {
  showModal(`
    <h2>${ICONS.import} Import Run</h2>
    <p style="font-size:12px;color:var(--text-2);margin-bottom:12px;">
      Accepts <strong>.agentflow.json</strong> or raw trace exports from
      <strong>LangSmith</strong>, <strong>LangFuse</strong>, or <strong>W&amp;B Weave</strong>.
      Max 2&nbsp;MB.
    </p>
    <input type="file" id="import-file" accept="application/json,.json" data-role="import-file"/>
    <div id="import-format-badge" style="font-size:11px;color:var(--accent-2);margin-top:8px;min-height:16px;"></div>
    <div id="import-error" class="error-msg"></div>
    <div class="modal-actions">
      <button class="btn" data-action="closeModal">Cancel</button>
      <button class="btn primary" data-action="doImport">Import</button>
    </div>
  `);
}

function _onImportFileChange(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    document.getElementById('import-error').textContent = 'File too large (max 2 MB).';
    return;
  }
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const obj = JSON.parse(ev.target.result);
      const fmt = detectFormat(obj);
      const badge = document.getElementById('import-format-badge');
      if (!badge) return;
      const labels = { langsmith: 'LangSmith trace', langfuse: 'LangFuse trace', weave: 'W&B Weave call' };
      badge.textContent = fmt ? ('Detected: ' + labels[fmt]) : 'Detected: AgentFlow native (or unknown)';
    } catch { /* ignore */ }
  };
  reader.readAsText(file);
}

function doImport() {
  const file = document.getElementById('import-file')?.files?.[0];
  const errEl = document.getElementById('import-error');
  if (!file) { errEl.textContent = 'Please select a file.'; return; }
  if (!/\.json$/i.test(file.name)) { errEl.textContent = 'Must be a .json file.'; return; }
  if (file.size > 2 * 1024 * 1024) { errEl.textContent = 'File too large (max 2 MB).'; return; }

  const reader = new FileReader();
  reader.onerror = () => { errEl.textContent = 'Could not read file.'; };
  reader.onload = e => {
    let parsed;
    try { parsed = JSON.parse(e.target.result); }
    catch { errEl.textContent = 'Invalid JSON.'; return; }

    const nativeErr = validateRunSchema(parsed);
    if (!nativeErr) return _finishImport(parsed);

    const { run, error } = importFromThirdParty(parsed);
    if (error) { errEl.textContent = `Not native (${nativeErr}). Adapter: ${error}`; return; }

    const adapterErr = validateRunSchema(run);
    if (adapterErr) { errEl.textContent = 'Adapter output invalid: ' + adapterErr; return; }
    _finishImport(run);
  };
  reader.readAsText(file);
}

function _finishImport(run) {
  if (state.runs.find(r => r.id === run.id)) {
    run = Object.assign({}, run, { id: 'run-' + Date.now() });
  }
  closeModal();
  setState({
    runs: [...state.runs, run],
    activeRunId: run.id,
    selectedNodeId: null,
    activeCounterfactual: null,
  });
}

// ── Search ───────────────────────────────────────────────
function setSearch(q) { setState({ searchQuery: typeof q === 'string' ? q : '' }); }

// ── Toast ────────────────────────────────────────────────
function _showToast(msg) {
  var t = document.createElement('div');
  t.className = 'import-toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(function() { t.remove(); }, 3000);
}

// ── Paste import ─────────────────────────────────────────
function _onPaste(e) {
  const tag = e.target && e.target.tagName;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
  if (modalOpen()) return;
  const text = e.clipboardData && e.clipboardData.getData('text');
  if (!text) return;
  let parsed;
  try { parsed = JSON.parse(text); } catch { return; }
  const nativeErr = validateRunSchema(parsed);
  if (!nativeErr) { _finishImport(parsed); return; }
  const { run, error } = importFromThirdParty(parsed);
  if (error) return;
  const adapterErr = validateRunSchema(run);
  if (adapterErr) return;
  _finishImport(run);
}

// ── Drag-and-drop import ─────────────────────────────────
function _onDragOver(e) {
  if (e.dataTransfer && e.dataTransfer.types && Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') !== -1) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }
}

function _onDrop(e) {
  e.preventDefault();
  if (modalOpen()) return;
  const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if (!file) return;
  if (!/\.json$/i.test(file.name)) { _showToast('Only .json files are supported.'); return; }
  if (file.size > 2 * 1024 * 1024) { _showToast('File too large (max 2 MB).'); return; }
  const reader = new FileReader();
  reader.onerror = function() { _showToast('Could not read file.'); };
  reader.onload = function(ev) {
    let parsed;
    try { parsed = JSON.parse(ev.target.result); } catch { _showToast('Invalid JSON.'); return; }
    const nativeErr = validateRunSchema(parsed);
    if (!nativeErr) { _finishImport(parsed); return; }
    const { run, error } = importFromThirdParty(parsed);
    if (error) { _showToast('Unrecognised format: ' + error); return; }
    const adapterErr = validateRunSchema(run);
    if (adapterErr) { _showToast('Adapter output invalid.'); return; }
    _finishImport(run);
  };
  reader.readAsText(file);
}

// ── Action dispatch ──────────────────────────────────────
const ACTIONS = {
  closeModal, doImport, handleExport, openImportDialog, materializeCounterfactual, generateCounterfactuals,
  selectRun, selectNode, setTab, setCf, toggleCf, setSearch,
  modalBackdrop(_id, _el, e) { if (e.target === _el) closeModal(); },
};

function _dispatch(action, id, el, e) {
  const fn = ACTIONS[action];
  if (typeof fn !== 'function') return;
  try { fn(id, el, e); }
  catch (err) { ErrorBoundary.show(err, 'action:' + action); }
}

function _delegatedClick(e) {
  const t = e.target.closest('[data-action]');
  if (!t) return;
  _dispatch(t.dataset.action, t.dataset.id, t, e);
}

function _delegatedChange(e) {
  const t = e.target.closest('[data-change]');
  if (t) { _dispatch(t.dataset.change, t.value, t, e); return; }
  if (e.target.dataset.role === 'import-file') _onImportFileChange(e);
}

// ── Run / node navigation ────────────────────────────────
function _cycleRun(dir) {
  if (state.runs.length === 0) return;
  const i = state.runs.findIndex(r => r.id === state.activeRunId);
  const next = state.runs[(i + dir + state.runs.length) % state.runs.length];
  selectRun(next.id);
}

function _cycleNode(dir) {
  const view = getActiveRunView();
  if (!view || view.run.nodes.length === 0) return;
  const nodes = view.run.nodes;
  const i = nodes.findIndex(n => n.id === state.selectedNodeId);
  const next = i === -1 ? nodes[0] : nodes[(i + dir + nodes.length) % nodes.length];
  setState({ selectedNodeId: next.id });
}

// ── Global keyboard shortcuts ────────────────────────────
function _onKey(e) {
  const tag = document.activeElement?.tagName;
  const inField = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag);
  const mod = e.metaKey || e.ctrlKey;

  if (e.key === 'Escape') {
    if (_modalEl) { closeModal(); return; }
    if (state.selectedNodeId) { setState({ selectedNodeId: null }); return; }
  }

  if (inField || _modalEl) return;

  if (mod && !e.shiftKey && !e.altKey) {
    if (e.key === 'i' || e.key === 'I') { e.preventDefault(); openImportDialog(); return; }
    if (e.key === 'e' || e.key === 'E') { e.preventDefault(); handleExport(); return; }
  }

  if (!mod && !e.altKey && !e.shiftKey) {
    if (e.key === '/') {
      var searchEl = document.querySelector('.search-box input');
      if (searchEl) { e.preventDefault(); searchEl.focus(); searchEl.select(); }
      return;
    }
    if (e.key === 'g' || e.key === 'G') { e.preventDefault(); setTab('graph'); return; }
    if (e.key === 'c' || e.key === 'C') { e.preventDefault(); setTab('counterfactuals'); return; }
    if (e.key === 'ArrowUp')    { e.preventDefault(); _cycleRun(-1); return; }
    if (e.key === 'ArrowDown')  { e.preventDefault(); _cycleRun(1); return; }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); _cycleNode(-1); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); _cycleNode(1); return; }
  }
}

function installDelegation() {
  const app = document.getElementById('app');
  if (app) {
    app.addEventListener('click', _delegatedClick);
    app.addEventListener('change', _delegatedChange);
  }
  document.addEventListener('click', _delegatedClick);
  document.addEventListener('change', _delegatedChange);
  document.addEventListener('keydown', _onKey);
  document.addEventListener('paste', _onPaste);
  document.addEventListener('dragover', _onDragOver);
  document.addEventListener('drop', _onDrop);
}

function attachEvents() {}

// ── Counterfactual materialization (Logic Engine integration) ────────────────
function materializeCounterfactual(idStr) {
  const view = getActiveRunView();
  if (!view || view.isCounterfactual) return;

  const idx = parseInt(idStr, 10);
  if (!Number.isFinite(idx) || idx < 0) return;

  const suggestions = Array.isArray(view.nodeSuggestions) ? view.nodeSuggestions : [];
  const suggestion = suggestions[idx];
  if (!suggestion) return;

  if (typeof window === 'undefined' || !window.AgentFlowCounterfactual) return;

  const newCf = window.AgentFlowCounterfactual.materializeRevision(view.run, suggestion);
  if (!newCf) return;

  const activeRun = state.runs.find(r => r.id === state.activeRunId);
  if (!activeRun) return;

  const existingCfs = Array.isArray(activeRun.counterfactuals) ? activeRun.counterfactuals : [];
  if (existingCfs.some(c => c.id === newCf.id)) {
    setState({ activeCounterfactual: newCf.id, activeTab: 'graph' });
    return;
  }

  const updatedRuns = state.runs.map(r => {
    if (r.id !== state.activeRunId) return r;
    return Object.assign({}, r, {
      counterfactuals: existingCfs.concat([newCf]),
    });
  });

  setState({
    runs: updatedRuns,
    activeCounterfactual: newCf.id,
    activeTab: 'graph',
  });
}

// ── Run-level counterfactual generation ──────────────────────────────────────
function generateCounterfactuals() {
  if (typeof window === 'undefined' || !window.AgentFlowCounterfactual) {
    alert('Logic Engine not loaded');
    return;
  }
  const view = getActiveRunView();
  if (!view) {
    alert('No active run. Import a trace first.');
    return;
  }
  if (view.isCounterfactual) {
    alert('Switch to the original run before generating counterfactuals.');
    return;
  }

  const run = view.run;
  const allSuggestions = [];
  const seenSignatures = new Set();

  run.nodes.forEach(node => {
    let suggestions;
    try {
      suggestions = window.AgentFlowCounterfactual.computeNodeCounterfactuals(run, node.id);
    } catch (e) {
      return;
    }
    suggestions.forEach(sug => {
      if (seenSignatures.has(sug.id)) return;
      seenSignatures.add(sug.id);
      allSuggestions.push(sug);
    });
  });

  allSuggestions.sort((a, b) => a.cost - b.cost || a.collateral - b.collateral);
  const top = allSuggestions.slice(0, 6);

  if (top.length === 0) {
    alert('Logic Engine found no counterfactual scenarios for this trace. The trace may be too simple or have only a single execution path.');
    return;
  }

  const newCfs = top.map(sug => window.AgentFlowCounterfactual.materializeRevision(run, sug)).filter(Boolean);

  const existing = Array.isArray(run.counterfactuals) ? run.counterfactuals : [];
  const existingIds = new Set(existing.map(c => c.id));
  const fresh = newCfs.filter(c => !existingIds.has(c.id));

  if (fresh.length === 0) {
    setState({ activeTab: 'counterfactuals' });
    alert('All Logic Engine suggestions are already adopted in this run.');
    return;
  }

  const updatedRuns = state.runs.map(r => {
    if (r.id !== state.activeRunId) return r;
    return Object.assign({}, r, {
      counterfactuals: existing.concat(fresh),
    });
  });

  setState({
    runs: updatedRuns,
    activeTab: 'counterfactuals',
  });
}
