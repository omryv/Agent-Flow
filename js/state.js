/*! AgentFlow — Copyright (c) 2026 Omry Damari 'Visigence" . Proprietary. */
'use strict';

let state = makeSampleData();

function setState(patch) {
  state = Object.assign({}, state, patch);
  render();
}

function _diffNodes(baseList, mergedList) {
  const baseById = {};
  baseList.forEach(n => baseById[n.id] = n);
  const ids = new Set();
  mergedList.forEach(n => {
    const b = baseById[n.id];
    if (!b) { ids.add(n.id); return; }
    if (b.name !== n.name || b.role !== n.role || b.status !== n.status || b.content !== n.content) {
      ids.add(n.id);
    }
  });
  const mergedIds = new Set(mergedList.map(n => n.id));
  baseList.forEach(n => { if (!mergedIds.has(n.id)) ids.add(n.id); });
  return ids;
}

function getActiveRunView() {
  const run = state.runs.find(r => r.id === state.activeRunId);
  if (!run) return null;
  if (!state.activeCounterfactual) {
    return { run, isCounterfactual: false, overriddenNodeIds: new Set() };
  }

  const cf = (run.counterfactuals || []).find(c => c.id === state.activeCounterfactual);
  if (!cf) {
    return { run, isCounterfactual: false, overriddenNodeIds: new Set() };
  }

  let mergedNodes, mergedEdges;
  if (Array.isArray(cf.nodes) && Array.isArray(cf.edges)) {
    // New snapshot model — independent per CF
    mergedNodes = cf.nodes;
    mergedEdges = cf.edges;
  } else {
    // Legacy override-only model (back-compat with old saves / sample data)
    mergedNodes = run.nodes.map(node =>
      cf.nodeOverrides && cf.nodeOverrides[node.id]
        ? Object.assign({}, node, cf.nodeOverrides[node.id])
        : node
    );
    mergedEdges = run.edges;
  }

  const overriddenNodeIds = _diffNodes(run.nodes, mergedNodes);

  const mergedRun = Object.assign({}, run, {
    nodes: mergedNodes,
    edges: mergedEdges,
    metrics: cf.metrics || run.metrics,
    finalAnswer: cf.finalAnswer != null ? cf.finalAnswer : run.finalAnswer,
  });
  return {
    run: mergedRun,
    originalRun: run,
    isCounterfactual: true,
    overriddenNodeIds,
    cf,
  };
}
