/*! AgentFlow — Copyright (c) 2026 Omry Damari 'Visigence" . Proprietary. */
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
function selectRun(id)  { setState({ activeRunId: id, selectedNodeId: null, activeCounterfactual: null, activeTab: 'graph' }); }
function selectNode(id) { setState({ selectedNodeId: state.selectedNodeId === id ? null : id }); }
function setTab(tab)    { setState({ activeTab: tab }); }
function setCf(id)      { setState({ activeCounterfactual: id || null, selectedNodeId: null }); }
function toggleCf(id)   { setState({ activeCounterfactual: state.activeCounterfactual === id ? null : id, activeTab: 'graph' }); }

// ── Active-context mutation (base run OR active CF) ──────
function _mutateActiveContext(updater) {
  return state.runs.map(r => {
    if (r.id !== state.activeRunId) return r;

    if (state.activeCounterfactual) {
      return Object.assign({}, r, {
        counterfactuals: (r.counterfactuals || []).map(cf => {
          if (cf.id !== state.activeCounterfactual) return cf;
          // Materialize snapshot from legacy override-only CFs on first edit
          const baseNodes = Array.isArray(cf.nodes)
            ? cf.nodes
            : r.nodes.map(n =>
                cf.nodeOverrides && cf.nodeOverrides[n.id]
                  ? Object.assign({}, n, cf.nodeOverrides[n.id])
                  : Object.assign({}, n));
          const baseEdges = Array.isArray(cf.edges)
            ? cf.edges
            : r.edges.map(e => Object.assign({}, e));
          const updated = updater({ nodes: baseNodes, edges: baseEdges });
          return Object.assign({}, cf, updated);
        })
      });
    }
    const updated = updater({ nodes: r.nodes, edges: r.edges });
    return Object.assign({}, r, updated);
  });
}

// ── Destructive ──────────────────────────────────────────
function deleteActiveRun() {
  if (!state.activeRunId) return;
  if (!confirm('Delete this run? This cannot be undone.')) return;
  const runs = state.runs.filter(r => r.id !== state.activeRunId);
  setState({
    runs,
    activeRunId: runs[0]?.id || null,
    selectedNodeId: null,
    activeCounterfactual: null,
  });
}

function deleteNode(id) {
  const runs = _mutateActiveContext(({ nodes, edges }) => ({
    nodes: nodes.filter(n => n.id !== id),
    edges: edges.filter(e => e.from !== id && e.to !== id),
  }));
  const positions = Object.assign({}, state.nodePositions || {});
  if (positions[state.activeRunId]) {
    const copy = Object.assign({}, positions[state.activeRunId]);
    delete copy[id];
    positions[state.activeRunId] = copy;
  }
  setState({ runs, selectedNodeId: null, nodePositions: positions });
}

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

// ── Dialogs ──────────────────────────────────────────────
function openNewRunDialog() {
  showModal(`
    <h2>${ICONS.plus} New Run</h2>
    <label for="nr-name">Run name</label>
    <input id="nr-name" maxlength="200" autocomplete="off" placeholder="e.g. Customer-support QA"/>
    <label for="nr-answer">Final answer (optional)</label>
    <textarea id="nr-answer" maxlength="10000" placeholder="Final response text…"></textarea>
    <div id="nr-error" class="error-msg"></div>
    <div class="modal-actions">
      <button class="btn" data-action="closeModal">Cancel</button>
      <button class="btn primary" data-action="createNewRun">Create</button>
    </div>
  `);
}

function createNewRun() {
  const name = clampStr(document.getElementById('nr-name')?.value.trim(), 200);
  const answer = clampStr(document.getElementById('nr-answer')?.value, 10000);
  const err = document.getElementById('nr-error');
  if (!name) { err.textContent = 'Name is required.'; return; }
  const run = {
    id: 'run-' + Date.now(),
    name,
    createdAt: new Date().toISOString(),
    nodes: [], edges: [],
    metrics: { totalMs: 0, tokens: 0, nodes: 0, successful: 0, failed: 0 },
    finalAnswer: answer,
    counterfactuals: [],
  };
  closeModal();
  setState({ runs: [...state.runs, run], activeRunId: run.id, selectedNodeId: null, activeCounterfactual: null });
}

function openAddNodeDialog() {
  if (!state.activeRunId) return;
  const roles = ROLE_KEYS.map(k => `<option value="${esc(k)}">${esc(ROLES[k].label)}</option>`).join('');
  const statuses = STATUS_KEYS.map(k => `<option value="${esc(k)}">${esc(STATUSES[k].label)}</option>`).join('');
  const ctxLabel = state.activeCounterfactual ? 'in active counterfactual' : 'in base run';
  showModal(`
    <h2>${ICONS.node} Add Node</h2>
    <p style="font-size:11px;color:var(--text-3);margin-bottom:12px;">Will be added <strong>${ctxLabel}</strong>.</p>
    <label for="an-name">Name</label>
    <input id="an-name" maxlength="200" autocomplete="off"/>
    <label for="an-role">Role</label>
    <select id="an-role">${roles}</select>
    <label for="an-status">Status</label>
    <select id="an-status">${statuses}</select>
    <label for="an-content">Content</label>
    <textarea id="an-content" maxlength="10000"></textarea>
    <div id="an-error" class="error-msg"></div>
    <div class="modal-actions">
      <button class="btn" data-action="closeModal">Cancel</button>
      <button class="btn primary" data-action="addNode">Add</button>
    </div>
  `);
}

function addNode() {
  const name = clampStr(document.getElementById('an-name')?.value.trim(), 200);
  const role = document.getElementById('an-role')?.value;
  const status = document.getElementById('an-status')?.value;
  const content = clampStr(document.getElementById('an-content')?.value, 10000);
  const errEl = document.getElementById('an-error');
  if (!name) { errEl.textContent = 'Name is required.'; return; }
  if (!ROLE_KEYS.includes(role)) { errEl.textContent = 'Invalid role.'; return; }
  if (!STATUS_KEYS.includes(status)) { errEl.textContent = 'Invalid status.'; return; }

  const node = { id: 'n' + Date.now(), name, role, status, content };
  const runs = _mutateActiveContext(({ nodes, edges }) => ({
    nodes: [...nodes, node],
    edges,
  }));
  closeModal();
  setState({ runs, selectedNodeId: node.id });
}

function openEditNodeDialog(nodeId) {
  const view = getActiveRunView();
  const node = view?.run.nodes.find(n => n.id === nodeId);
  if (!node) return;
  const roles = ROLE_KEYS.map(k => `<option value="${esc(k)}" ${k === node.role ? 'selected' : ''}>${esc(ROLES[k].label)}</option>`).join('');
  const statuses = STATUS_KEYS.map(k => `<option value="${esc(k)}" ${k === node.status ? 'selected' : ''}>${esc(STATUSES[k].label)}</option>`).join('');
  const ctxLabel = state.activeCounterfactual ? 'in active counterfactual only' : 'in base run';
  showModal(`
    <h2>Edit Node</h2>
    <p style="font-size:11px;color:var(--text-3);margin-bottom:12px;">Edits saved <strong>${ctxLabel}</strong>.</p>
    <input type="hidden" id="en-id" value="${esc(node.id)}"/>
    <label for="en-name">Name</label>
    <input id="en-name" maxlength="200" autocomplete="off" value="${esc(node.name)}"/>
    <label for="en-role">Role</label>
    <select id="en-role">${roles}</select>
    <label for="en-status">Status</label>
    <select id="en-status">${statuses}</select>
    <label for="en-content">Content</label>
    <textarea id="en-content" maxlength="10000">${esc(node.content)}</textarea>
    <div id="en-error" class="error-msg"></div>
    <div class="modal-actions">
      <button class="btn" data-action="closeModal">Cancel</button>
      <button class="btn primary" data-action="saveEditNode">Save</button>
    </div>
  `);
}

function saveEditNode() {
  const id = document.getElementById('en-id')?.value;
  const name = clampStr(document.getElementById('en-name')?.value.trim(), 200);
  const role = document.getElementById('en-role')?.value;
  const status = document.getElementById('en-status')?.value;
  const content = clampStr(document.getElementById('en-content')?.value, 10000);
  const errEl = document.getElementById('en-error');
  if (!name) { errEl.textContent = 'Name is required.'; return; }
  if (!ROLE_KEYS.includes(role)) { errEl.textContent = 'Invalid role.'; return; }
  if (!STATUS_KEYS.includes(status)) { errEl.textContent = 'Invalid status.'; return; }

  const runs = _mutateActiveContext(({ nodes, edges }) => ({
    nodes: nodes.map(n => n.id === id ? Object.assign({}, n, { name, role, status, content }) : n),
    edges,
  }));
  closeModal();
  setState({ runs });
}

function openAddCfDialog() {
  const run = state.runs.find(r => r.id === state.activeRunId);
  if (!run || run.nodes.length === 0) { alert('Add at least one node first.'); return; }
  const nodeOpts = run.nodes.map(n => `<option value="${esc(n.id)}">${esc(n.name)}</option>`).join('');
  showModal(`
    <h2>${ICONS.cf} New Counterfactual</h2>
    <p style="font-size:11px;color:var(--text-3);margin-bottom:12px;">
      A snapshot of the current run will be taken. Subsequent edits to nodes while this scenario is active will only affect this scenario.
    </p>
    <label for="cf-name">Scenario name</label>
    <input id="cf-name" maxlength="200" autocomplete="off" placeholder="e.g. What if retrieval failed"/>
    <label for="cf-desc">Description</label>
    <textarea id="cf-desc" maxlength="1000" placeholder="What's the hypothesis?"></textarea>
    <label for="cf-node">Override which node</label>
    <select id="cf-node">${nodeOpts}</select>
    <label for="cf-status">New status</label>
    <select id="cf-status">
      <option value="failed">Failed</option>
      <option value="skipped">Skipped</option>
      <option value="success">Success</option>
    </select>
    <label for="cf-content">New content</label>
    <textarea id="cf-content" maxlength="10000" placeholder="What would this node have produced?"></textarea>
    <div id="cf-error" class="error-msg"></div>
    <div class="modal-actions">
      <button class="btn" data-action="closeModal">Cancel</button>
      <button class="btn primary" data-action="createCf">Create</button>
    </div>
  `);
}

function createCf() {
  const run = state.runs.find(r => r.id === state.activeRunId);
  if (!run) return;
  const name = clampStr(document.getElementById('cf-name')?.value.trim(), 200);
  const description = clampStr(document.getElementById('cf-desc')?.value, 1000);
  const nodeId = document.getElementById('cf-node')?.value;
  const status = document.getElementById('cf-status')?.value;
  const content = clampStr(document.getElementById('cf-content')?.value, 10000);
  const errEl = document.getElementById('cf-error');
  if (!name) { errEl.textContent = 'Name is required.'; return; }
  if (!run.nodes.find(n => n.id === nodeId)) { errEl.textContent = 'Invalid node.'; return; }
  if (!STATUS_KEYS.includes(status)) { errEl.textContent = 'Invalid status.'; return; }

  // Full snapshot at creation — independent from base & other CFs
  const overrideEntry = { status, content };
  const snapshotNodes = run.nodes.map(n =>
    n.id === nodeId ? Object.assign({}, n, overrideEntry) : Object.assign({}, n)
  );
  const snapshotEdges = run.edges.map(e => Object.assign({}, e));

  const cf = {
    id: 'cf-' + Date.now(),
    name, description,
    nodes: snapshotNodes,
    edges: snapshotEdges,
    nodeOverrides: { [nodeId]: overrideEntry }, // kept for legacy export readers
    metrics: Object.assign({}, run.metrics),
    finalAnswer: run.finalAnswer,
  };
  const runs = state.runs.map(r => r.id !== run.id ? r : Object.assign({}, r, {
    counterfactuals: [...(r.counterfactuals || []), cf]
  }));
  closeModal();
  setState({ runs, activeCounterfactual: cf.id });
}

// ── Action dispatch ──────────────────────────────────────
const ACTIONS = {
  closeModal, doImport, handleExport, openImportDialog, openNewRunDialog,
  createNewRun, openAddNodeDialog, addNode, openEditNodeDialog, saveEditNode,
  openAddCfDialog, createCf, deleteActiveRun, deleteNode, resetLayout,
  selectRun, selectNode, setTab, setCf, toggleCf, openCmdPalette,
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

function _delegatedMouseDown(e) {
  const t = e.target.closest('[data-drag-handle]');
  if (!t) return;
  initDrag(e, t.dataset.dragId);
// ── Command palette ──────────────────────────────────────
const CMDS = [
  { id: 'new-run',     label: 'New Run',                    keys: '⌘N',     run: () => openNewRunDialog() },
  { id: 'import',      label: 'Import Run',                 keys: '⌘I',     run: () => openImportDialog() },
  { id: 'export',      label: 'Export Active Run',          keys: '⌘E',     run: () => handleExport(),       when: () => !!state.activeRunId },
  { id: 'add-node',    label: 'Add Node',                   keys: '⌘⇧N',    run: () => openAddNodeDialog(),  when: () => !!state.activeRunId && state.activeTab === 'graph' },
  { id: 'new-cf',      label: 'New Counterfactual',         keys: '⌘⇧C',    run: () => openAddCfDialog(),    when: () => !!state.activeRunId },
  { id: 'tab-graph',   label: 'View: Graph',                keys: 'G',      run: () => setTab('graph'),      when: () => !!state.activeRunId },
  { id: 'tab-cf',      label: 'View: Counterfactuals',      keys: 'C',      run: () => setTab('counterfactuals'), when: () => !!state.activeRunId },
  { id: 'reset-layout',label: 'Reset Layout',               keys: '⌘⌥R',    run: () => resetLayout(),        when: () => !!state.activeRunId && state.activeTab === 'graph' },
  { id: 'clear-cf',    label: 'Clear Active Scenario',      keys: '⌘⌥0',    run: () => setCf(''),            when: () => !!state.activeCounterfactual },
  { id: 'delete-run',  label: 'Delete Active Run',          keys: '⌘⌫',     run: () => deleteActiveRun(),    when: () => !!state.activeRunId, danger: true },
  { id: 'delete-node', label: 'Delete Selected Node',       keys: 'Del',    run: () => deleteNode(state.selectedNodeId), when: () => !!state.selectedNodeId, danger: true },
];

function _availableCmds() {
  return CMDS.filter(c => !c.when || c.when());
}

function _scoreCmd(cmd, q) {
  if (!q) return 1;
  const label = cmd.label.toLowerCase();
  q = q.toLowerCase().trim();
  if (label === q) return 1000;
  if (label.startsWith(q)) return 500;
  if (label.includes(q)) return 250;
  // fuzzy: all chars in order
  let i = 0;
  for (const ch of label) { if (ch === q[i]) i++; if (i === q.length) return 100 - label.length; }
  return 0;
}

let _palette = null;
let _paletteIdx = 0;
let _paletteResults = [];

function openCmdPalette() {
  if (_palette) return closeCmdPalette();
  _paletteIdx = 0;
  _paletteResults = _availableCmds();
  _palette = document.createElement('div');
  _palette.className = 'cmdk-backdrop';
  _palette.innerHTML = `
    <div class="cmdk" role="dialog" aria-label="Command palette">
      <div class="cmdk-search">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <circle cx="6" cy="6" r="4.2" stroke="currentColor" stroke-width="1.5"/>
          <path d="M9.2 9.2L12 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <input id="cmdk-input" placeholder="Type a command…" autocomplete="off" spellcheck="false"/>
        <kbd class="cmdk-hint">esc</kbd>
      </div>
      <div class="cmdk-list" id="cmdk-list" role="listbox"></div>
      <div class="cmdk-foot">
        <span><kbd>↑↓</kbd> navigate</span>
        <span><kbd>↵</kbd> run</span>
        <span><kbd>esc</kbd> close</span>
      </div>
    </div>`;
  document.body.appendChild(_palette);
  _palette.addEventListener('mousedown', e => { if (e.target === _palette) closeCmdPalette(); });
  const input = document.getElementById('cmdk-input');
  input.addEventListener('input', _onCmdInput);
  input.addEventListener('keydown', _onCmdKey);
  _renderCmdList('');
  setTimeout(() => input.focus(), 10);
}

function closeCmdPalette() {
  if (!_palette) return;
  _palette.remove();
  _palette = null;
  _paletteResults = [];
}

function _onCmdInput(e) {
  const q = e.target.value;
  _renderCmdList(q);
}

function _renderCmdList(q) {
  const cmds = _availableCmds()
    .map(c => ({ c, s: _scoreCmd(c, q) }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map(x => x.c);
  _paletteResults = cmds;
  _paletteIdx = 0;
  const list = document.getElementById('cmdk-list');
  if (!list) return;
  if (cmds.length === 0) {
    list.innerHTML = `<div class="cmdk-empty">No matching commands</div>`;
    return;
  }
  list.innerHTML = cmds.map((c, i) => `
    <div class="cmdk-item ${i === 0 ? 'active' : ''} ${c.danger ? 'danger' : ''}" data-cmd-i="${i}" role="option">
      <span class="cmdk-label">${esc(c.label)}</span>
      <span class="cmdk-keys">${esc(c.keys || '')}</span>
    </div>`).join('');
  list.querySelectorAll('.cmdk-item').forEach(el => {
    el.addEventListener('mouseenter', () => _setCmdActive(parseInt(el.dataset.cmdI, 10)));
    el.addEventListener('click', () => _runCmd(parseInt(el.dataset.cmdI, 10)));
  });
}

function _setCmdActive(i) {
  _paletteIdx = Math.max(0, Math.min(_paletteResults.length - 1, i));
  const items = document.querySelectorAll('.cmdk-item');
  items.forEach((el, idx) => el.classList.toggle('active', idx === _paletteIdx));
  items[_paletteIdx]?.scrollIntoView({ block: 'nearest' });
}

function _runCmd(i) {
  const cmd = _paletteResults[i];
  if (!cmd) return;
  closeCmdPalette();
  try { cmd.run(); } catch (err) { ErrorBoundary.show(err, 'cmd:' + cmd.id); }
}

function _onCmdKey(e) {
  if (e.key === 'ArrowDown') { e.preventDefault(); _setCmdActive(_paletteIdx + 1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); _setCmdActive(_paletteIdx - 1); }
  else if (e.key === 'Enter') { e.preventDefault(); _runCmd(_paletteIdx); }
  else if (e.key === 'Escape') { e.preventDefault(); closeCmdPalette(); }
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

// ── Global keys (replace existing _onKey) ────────────────
function _onKey(e) {
  const tag = document.activeElement?.tagName;
  const inField = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag);
  const mod = e.metaKey || e.ctrlKey;

  // Palette toggle — works everywhere
  if (mod && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); openCmdPalette(); return; }

  if (e.key === 'Escape') {
    if (_palette) { closeCmdPalette(); return; }
    if (_modalEl) { closeModal(); return; }
    if (state.selectedNodeId) { setState({ selectedNodeId: null }); return; }
  }

  if (inField || _modalEl || _palette) return;

  // ⌘N new run, ⌘I import, ⌘E export
  if (mod && !e.shiftKey && !e.altKey) {
    if (e.key === 'n' || e.key === 'N') { e.preventDefault(); openNewRunDialog(); return; }
    if (e.key === 'i' || e.key === 'I') { e.preventDefault(); openImportDialog(); return; }
    if (e.key === 'e' || e.key === 'E') { e.preventDefault(); handleExport(); return; }
    if (e.key === 'Backspace')           { e.preventDefault(); deleteActiveRun(); return; }
  }
  // ⌘⇧N add node, ⌘⇧C new CF
  if (mod && e.shiftKey) {
    if (e.key === 'N' || e.key === 'n') { e.preventDefault(); openAddNodeDialog(); return; }
    if (e.key === 'C' || e.key === 'c') { e.preventDefault(); openAddCfDialog(); return; }
  }
  // ⌘⌥R reset layout, ⌘⌥0 clear scenario
  if (mod && e.altKey) {
    if (e.key === 'r' || e.key === 'R') { e.preventDefault(); resetLayout(); return; }
    if (e.key === '0')                  { e.preventDefault(); setCf(''); return; }
  }

  // Single-key shortcuts
  if (!mod && !e.altKey && !e.shiftKey) {
    if (e.key === '/') { e.preventDefault(); openCmdPalette(); return; }
    if (e.key === 'g' || e.key === 'G') { e.preventDefault(); setTab('graph'); return; }
    if (e.key === 'c' || e.key === 'C') { e.preventDefault(); setTab('counterfactuals'); return; }
    if (e.key === '?') { e.preventDefault(); openCmdPalette(); return; }
    if (e.key === 'ArrowUp')    { e.preventDefault(); _cycleRun(-1); return; }
    if (e.key === 'ArrowDown')  { e.preventDefault(); _cycleRun(1); return; }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); _cycleNode(-1); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); _cycleNode(1); return; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedNodeId) {
      e.preventDefault(); deleteNode(state.selectedNodeId); return;
    }
  }
}

function installDelegation() {
  const app = document.getElementById('app');
  if (!app) return;
  app.addEventListener('click', _delegatedClick);
  app.addEventListener('change', _delegatedChange);
  app.addEventListener('mousedown', _delegatedMouseDown);
  document.addEventListener('click', _delegatedClick);
  document.addEventListener('change', _delegatedChange);
  document.addEventListener('keydown', _onKey);
}

function attachEvents() {}
