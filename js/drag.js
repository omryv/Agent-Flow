/*!
 * AgentFlow
 * Copyright (c) 2026 Visigence. All rights reserved.
 * Proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use is prohibited.
 */
'use strict';



let _drag = null;

const DRAG_NODE_W = 220;
const DRAG_NODE_H = 100;

function getPositionsForRun(runId, run) {
  const stored = (state.nodePositions || {})[runId] || {};
  const base   = layoutNodes(run.nodes, run.edges);
  return Object.assign({}, base, stored);
}

function makeEdgePath(fp, tp) {
  const x1 = fp.x + DRAG_NODE_W, y1 = fp.y + DRAG_NODE_H / 2;
  const x2 = tp.x,               y2 = tp.y + DRAG_NODE_H / 2;
  const mx = (x1 + x2) / 2;
  return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
}

function _liveEdges(nodeId, newX, newY) {
  const run = state.runs.find(r => r.id === _drag.runId);
  if (!run) return;
  const positions = getPositionsForRun(_drag.runId, run);
  positions[nodeId] = { x: newX, y: newY };
  run.edges.forEach(e => {
    if (e.from !== nodeId && e.to !== nodeId) return;
    const path = document.querySelector(
      `[data-edge-id="${CSS.escape(e.from + '__' + e.to)}"]`
    );
    if (!path) return;
    const fp = positions[e.from], tp = positions[e.to];
    if (fp && tp) path.setAttribute('d', makeEdgePath(fp, tp));
  });
}

function _onMove(e) {
  if (!_drag) return;
  const newX = Math.max(0, _drag.origX + e.clientX - _drag.startMouseX);
  const newY = Math.max(0, _drag.origY + e.clientY - _drag.startMouseY);
  const wrapper = document.querySelector(
    `[data-node-id="${CSS.escape(_drag.nodeId)}"]`
  );
  if (wrapper) {
    wrapper.style.left = newX + 'px';
    wrapper.style.top  = newY + 'px';
  }
  _liveEdges(_drag.nodeId, newX, newY);
}

function _onUp(e) {
  if (!_drag) return;
  const newX = Math.max(0, _drag.origX + e.clientX - _drag.startMouseX);
  const newY = Math.max(0, _drag.origY + e.clientY - _drag.startMouseY);
  const { runId, nodeId } = _drag;

  _drag = null;
  document.removeEventListener('mousemove', _onMove);
  document.removeEventListener('mouseup',   _onUp);
  document.body.style.userSelect = '';
  document.body.style.cursor     = '';

  const runPositions       = Object.assign({}, (state.nodePositions || {})[runId] || {});
  runPositions[nodeId]      = { x: newX, y: newY };
  const nodePositions       = Object.assign({}, state.nodePositions || {});
  nodePositions[runId]      = runPositions;
  setState({ nodePositions });
}

function initDrag(e, nodeId) {
  if (e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  const run = state.runs.find(r => r.id === state.activeRunId);
  if (!run) return;
  const pos = getPositionsForRun(state.activeRunId, run)[nodeId] || { x: 0, y: 0 };
  _drag = {
    nodeId,
    runId:       state.activeRunId,
    startMouseX: e.clientX,
    startMouseY: e.clientY,
    origX:       pos.x,
    origY:       pos.y,
  };
  document.body.style.userSelect = 'none';
  document.body.style.cursor     = 'grabbing';
  document.addEventListener('mousemove', _onMove);
  document.addEventListener('mouseup',   _onUp);
}

function resetLayout() {
  if (!state.activeRunId) return;
  const nodePositions = Object.assign({}, state.nodePositions || {});
  delete nodePositions[state.activeRunId];
  setState({ nodePositions });
}