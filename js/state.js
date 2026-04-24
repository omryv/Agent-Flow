/*!
 * AgentFlow
 * Copyright (c) 2026 Visigence. All rights reserved.
 * Proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use is prohibited.
 */
'use strict';



let state = makeSampleData();

function setState(patch) {
  state = Object.assign({}, state, patch);
  render();
}

function getActiveRunView() {
  const run = state.runs.find(r => r.id === state.activeRunId);
  if (!run) return null;
  if (!state.activeCounterfactual) {
    return { run, isCounterfactual: false, overriddenNodeIds: new Set() };
  }

  const cf = run.counterfactuals.find(c => c.id === state.activeCounterfactual);
  if (!cf) {
    return { run, isCounterfactual: false, overriddenNodeIds: new Set() };
  }

  const overriddenNodeIds = new Set(Object.keys(cf.nodeOverrides));
  const mergedNodes = run.nodes.map(node =>
    cf.nodeOverrides[node.id]
      ? Object.assign({}, node, cf.nodeOverrides[node.id])
      : node
  );
  const mergedRun = Object.assign({}, run, {
    nodes:       mergedNodes,
    metrics:     cf.metrics,
    finalAnswer: cf.finalAnswer,
  });
  return {
    run:              mergedRun,
    originalRun:      run,
    isCounterfactual: true,
    overriddenNodeIds,
    cf,
  };
}