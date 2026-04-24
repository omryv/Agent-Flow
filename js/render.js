/*!
 * AgentFlow
 * Copyright (c) 2026 Visigence. All rights reserved.
 * Proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use is prohibited.
 */
'use strict';



function render() {
  document.getElementById('app').innerHTML = buildHTML();
  attachEvents();
}

function buildHTML() {
  const view = getActiveRunView();
  return `
    ${buildHeader(view)}
    <div id="main">
      ${buildSidebar()}
      ${buildCanvasArea(view)}
      ${buildDetail(view)}
    </div>
  `;
}

function buildHeader(view) {
  const run = view ? view.run : null;
  return `
  <div id="header">
    <div class="logo">${ICONS.logo} AgentFlow <span class="tagline">counterfactual trace engine</span></div>
    <div class="spacer"></div>
    ${run ? `<button class="btn" onclick="handleExport()">${ICONS.export} Export</button>` : ''}
    <button class="btn" onclick="openImportDialog()">${ICONS.import} Import</button>
    <button class="btn primary" onclick="openNewRunDialog()">${ICONS.plus} New Run</button>
  </div>`;
}

function buildSidebar() {
  const runs = state.runs;
  return `
  <div id="sidebar">
    <div id="sidebar-header">
      <h2>Runs</h2>
      <span style="font-size:11px;color:var(--text-3)">${runs.length} trace${runs.length !== 1 ? 's' : ''}</span>
    </div>
    <div id="runs-list">
      ${runs.length === 0 ? `<div class="no-runs-msg">No runs yet.<br>Import or create one.</div>` : ''}
      ${runs.map(r => buildRunItem(r)).join('')}
    </div>
  </div>`;
}

function buildRunItem(r) {
  const active = r.id === state.activeRunId;
  const t = new Date(r.createdAt);
  const timeStr = t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const failed = r.metrics.failed;
  return `
  <div class="run-item ${active ? 'active' : ''}" onclick="selectRun('${esc(r.id)}')">
    <div class="run-meta">
      <div class="run-name">${esc(r.name)}</div>
      <div class="run-sub">${timeStr} · ${r.nodes.length} nodes</div>
    </div>
    ${failed > 0 ? `<span class="run-badge" style="color:var(--danger)">${failed} err</span>` : ''}
  </div>`;
}

function buildCanvasArea(view) {
  if (!view) {
    return `<div id="canvas-area" style="display:flex;flex:1;flex-direction:column;">
      <div id="empty-state">
        ${ICONS.cursor}
        <h2>No run selected</h2>
        <p>Create a new run or import a .agentflow.json file to get started.</p>
        <button class="btn primary" onclick="openNewRunDialog()">${ICONS.plus} New Run</button>
      </div>
    </div>`;
  }

  const { run, isCounterfactual } = view;
  const activeCfId  = state.activeCounterfactual;
  const originalRun = view.originalRun || run;
  const realCfList  = originalRun.counterfactuals || [];

  return `
  <div id="canvas-area">
    <div id="toolbar">
      <span class="section-label">View</span>
      <div class="tab-bar">
        <div class="tab ${state.activeTab === 'graph'            ? 'active' : ''}" onclick="setTab('graph')">Graph</div>
        <div class="tab ${state.activeTab === 'counterfactuals'  ? 'active' : ''}" onclick="setTab('counterfactuals')">
          Counterfactuals <span style="font-size:10px;color:var(--text-3);margin-left:3px">${realCfList.length}</span>
        </div>
      </div>
      <div style="flex:1"></div>
      ${state.activeTab === 'graph' ? `
        <div class="cf-selector">
          <label>Scenario:</label>
          <select onchange="setCf(this.value)">
            <option value="">Original run</option>
            ${realCfList.map(c =>
              `<option value="${esc(c.id)}" ${activeCfId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`
            ).join('')}
          </select>
        </div>
        ${isCounterfactual ? `<span id="cf-badge">${ICONS.cf} Counterfactual active</span>` : ''}
        <button class="btn" onclick="openAddNodeDialog()" title="Add node">${ICONS.node} Add Node</button>
        <button class="btn" onclick="openAddCfDialog()"   title="New counterfactual">${ICONS.cf} New Scenario</button>
        <button class="btn" onclick="resetLayout()"        title="Reset node positions">↺ Reset Layout</button>
        <button class="btn danger" onclick="deleteActiveRun()" title="Delete run">${ICONS.delete}</button>
      ` : ''}
    </div>
    ${buildLegend()}
    ${state.activeTab === 'graph' ? buildGraph(view) : buildCfTab(view)}
    ${buildMetricsBar(view)}
  </div>`;
}

function buildLegend() {
  return `<div id="legend">
    ${Object.entries(ROLES).map(([k, v]) => `
      <div class="legend-item">
        <div class="legend-dot" style="background:${v.color}"></div>
        <span>${v.label}</span>
      </div>`).join('')}
  </div>`;
}

function buildGraph(view) {
  const { run, overriddenNodeIds } = view;

  // ── positions: stored overrides win over auto-layout ──────────────────────
  const positions = getPositionsForRun(state.activeRunId, run);

  // ── canvas dimensions ─────────────────────────────────────────────────────
  const nodeW = 220;
  let maxX = 0, maxY = 0;
  Object.values(positions).forEach(p => {
    maxX = Math.max(maxX, p.x + nodeW);
    maxY = Math.max(maxY, p.y + 140);
  });
  const cw = maxX + 60, ch = Math.max(maxY + 60, 500);

  // ── nodes ─────────────────────────────────────────────────────────────────
  const nodesHTML = run.nodes.map(node => {
    const pos       = positions[node.id];
    if (!pos) return '';
    const role      = ROLES[node.role]   || ROLES.input;
    const statusDef = STATUSES[node.status] || STATUSES.pending;
    const isSelected   = state.selectedNodeId === node.id;
    const isCfOverride = overriddenNodeIds.has(node.id);

    return `
    <div class="node-wrapper"
         data-node-id="${esc(node.id)}"
         style="left:${pos.x}px;top:${pos.y}px;">
      <div class="node ${isSelected ? 'selected' : ''} ${isCfOverride ? 'cf-override' : ''}"
           style="border-color:${isCfOverride ? 'var(--accent)' : 'var(--border)'}"
           onclick="selectNode('${esc(node.id)}')">
        <div class="node-header"
             style="cursor:grab"
             onmousedown="initDrag(event,'${esc(node.id)}')">
          <div class="role-dot" style="background:${role.color}"></div>
          <span class="role-label" style="color:${role.color}">${role.label}</span>
        </div>
        <div class="node-name">${esc(node.name)}</div>
        <div class="node-content">${esc(node.content)}</div>
        <div class="node-footer">
          <div class="status-dot ${statusDef.cls}"></div>
          <span class="status-label">${statusDef.label}</span>
          ${node.durationMs !== undefined
            ? `<span class="node-duration">${node.durationMs}ms</span>`
            : ''}
        </div>
      </div>
    </div>`;
  }).join('');

  // ── edges (SVG) ───────────────────────────────────────────────────────────
  const edgesHTML = run.edges.map(e => {
    const from = positions[e.from], to = positions[e.to];
    if (!from || !to) return '';
    const isCf  = overriddenNodeIds.has(e.from) || overriddenNodeIds.has(e.to);
    const pathD = makeEdgePath(from, to);
    return `<path class="edge ${isCf ? 'cf' : ''}"
                  data-edge-id="${esc(e.from + '__' + e.to)}"
                  d="${pathD}"/>`;
  }).join('');

  return `
  <div id="graph-scroll">
    <div id="graph-canvas" style="width:${cw}px;height:${ch}px;">
      <svg class="edges-layer" width="${cw}" height="${ch}">${edgesHTML}</svg>
      ${nodesHTML}
    </div>
  </div>`;
}

function buildCfTab(view) {
  const originalRun = view.originalRun || view.run;
  const cfs = originalRun.counterfactuals || [];
  if (cfs.length === 0) {
    return `<div id="graph-scroll" style="display:flex;align-items:center;justify-content:center;">
      <div class="detail-empty-state" style="padding:48px;">
        ${ICONS.cf}
        <p style="margin-top:16px;font-size:13px;color:var(--text-2);">No counterfactuals yet.</p>
        <p style="margin-top:6px;font-size:12px;">Create one using "New Scenario" in the toolbar.</p>
      </div>
    </div>`;
  }
  return `<div id="graph-scroll"><div id="cf-list">
    ${cfs.map(cf => {
      const active = state.activeCounterfactual === cf.id;
      return `
      <div class="cf-card ${active ? 'active' : ''}" onclick="toggleCf('${esc(cf.id)}')">
        <div class="cf-card-title">
          ${ICONS.cf}
          ${esc(cf.name)}
          ${active ? `<span style="font-size:10px;color:var(--accent);margin-left:auto">Active</span>` : ''}
        </div>
        <div class="cf-card-desc">${esc(cf.description || '')}</div>
        <div class="cf-overrides">
          ${Object.keys(cf.nodeOverrides).map(nid => {
            const node = originalRun.nodes.find(n => n.id === nid);
            return `<span class="cf-override-tag">${node ? esc(node.name) : nid}</span>`;
          }).join('')}
        </div>
      </div>`;
    }).join('')}
  </div></div>`;
}

function buildMetricsBar(view) {
  if (!view) return '';
  const { run, isCounterfactual, originalRun } = view;
  const m  = run.metrics;
  const om = isCounterfactual && originalRun ? originalRun.metrics : null;

  function delta(key, unit, invert) {
    if (!om) return '';
    const diff = m[key] - om[key];
    if (diff === 0) return '';
    const sign = diff > 0 ? '+' : '';
    const cls  = (diff > 0) === !invert ? 'pos' : 'neg';
    return `<span class="metric-delta ${cls}">${sign}${diff}${unit}</span>`;
  }

  return `
  <div id="metrics-bar">
    <div class="metric">
      <div class="metric-label">TOTAL TIME</div>
      <div class="metric-value" style="color:var(--accent)">${m.totalMs.toLocaleString()}ms</div>
      ${delta('totalMs', 'ms', true)}
    </div>
    <div class="metric-sep"></div>
    <div class="metric">
      <div class="metric-label">TOKENS</div>
      <div class="metric-value">${m.tokens.toLocaleString()}</div>
      ${delta('tokens', '', true)}
    </div>
    <div class="metric-sep"></div>
    <div class="metric">
      <div class="metric-label">NODES</div>
      <div class="metric-value">${m.nodes}</div>
    </div>
    <div class="metric-sep"></div>
    <div class="metric">
      <div class="metric-label">SUCCESSFUL</div>
      <div class="metric-value" style="color:var(--success)">${m.successful}</div>
    </div>
    ${m.failed > 0 ? `
    <div class="metric-sep"></div>
    <div class="metric">
      <div class="metric-label">FAILED</div>
      <div class="metric-value" style="color:var(--danger)">${m.failed}</div>
    </div>` : ''}
    <div style="flex:1"></div>
    ${run.finalAnswer ? `
    <div id="answer-panel">
      <h3>Final Answer ${isCounterfactual
        ? '<span style="color:var(--accent)">(counterfactual)</span>'
        : ''}</h3>
      <div class="answer-box ${isCounterfactual ? 'cf' : ''}">${esc(run.finalAnswer)}</div>
    </div>` : ''}
  </div>`;
}

function buildDetail(view) {
  if (!view) {
    return `<div id="detail" class="empty">
      <div class="detail-empty-state">${ICONS.cursor}<p>Select a run</p></div>
    </div>`;
  }

  const node = view.run.nodes.find(n => n.id === state.selectedNodeId);
  if (!node) {
    return `<div id="detail" class="empty">
      <div class="detail-empty-state">
        <div style="opacity:.35;margin-bottom:12px;">${ICONS.cursor}</div>
        <p>Click a node to inspect it</p>
      </div>
    </div>`;
  }

  const role         = ROLES[node.role]      || ROLES.input;
  const statusDef    = STATUSES[node.status] || STATUSES.pending;
  const isCfOverride = view.overriddenNodeIds.has(node.id);
  const originalNode = view.isCounterfactual && view.originalRun
    ? view.originalRun.nodes.find(n => n.id === node.id)
    : null;

  return `<div id="detail">
    <div id="detail-inner">
      ${isCfOverride ? `
        <div class="cf-note">
          ${ICONS.info} This node was modified by the counterfactual scenario.
        </div>` : ''}

      <div class="detail-section">
        <h3>Node</h3>
        <div class="detail-row">
          <span class="label">Name</span>
          <span class="value">${esc(node.name)}</span>
        </div>
        <div class="detail-row">
          <span class="label">Role</span>
          <span class="value" style="color:${role.color}">${role.label}</span>
        </div>
        <div class="detail-row">
          <span class="label">Status</span>
          <span class="value" style="display:flex;align-items:center;gap:6px">
            <span class="status-dot ${statusDef.cls}"></span>${statusDef.label}
          </span>
        </div>
        ${node.durationMs !== undefined ? `
        <div class="detail-row">
          <span class="label">Duration</span>
          <span class="value">${node.durationMs}ms</span>
        </div>` : ''}
        <div class="detail-row">
          <span class="label">ID</span>
          <span class="value" style="color:var(--text-3);font-family:var(--mono);font-size:11px">${esc(node.id)}</span>
        </div>
      </div>

      <div class="detail-section">
        <h3>Content</h3>
        <div class="detail-content-box">${esc(node.content)}</div>
      </div>

      ${isCfOverride && originalNode ? `
      <div class="detail-section">
        <h3>Original (before counterfactual)</h3>
        <div class="detail-row">
          <span class="label">Status</span>
          <span class="value" style="display:flex;align-items:center;gap:6px">
            <span class="status-dot ${STATUSES[originalNode.status]?.cls || 's-pending'}"></span>
            ${STATUSES[originalNode.status]?.label || originalNode.status}
          </span>
        </div>
        <div class="detail-content-box" style="opacity:.6">${esc(originalNode.content)}</div>
      </div>` : ''}

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
        <button class="btn" onclick="openEditNodeDialog('${esc(node.id)}')">Edit Node</button>
        <button class="btn danger" onclick="deleteNode('${esc(node.id)}')">${ICONS.delete} Delete</button>
      </div>
    </div>
  </div>`;
}