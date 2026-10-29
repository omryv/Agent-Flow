'use strict';

const vm = require('vm');
const { createAppContext } = require('./helpers/loadContext');

let ctx, run;
beforeEach(() => {
  ctx = createAppContext();
  run = JSON.parse(JSON.stringify(vm.runInContext('EXAMPLE_RUN', ctx)));
});

function viewWithCounterfactual(cfId) {
  ctx.setState({ runs: [run], activeRunId: run.id, activeCounterfactual: cfId });
  return ctx.getActiveRunView();
}

describe('EXAMPLE_RUN', () => {
  test('passes the native schema', () => {
    expect(ctx.validateRunSchema(run)).toBeNull();
  });

  test('node and edge ids are unique', () => {
    const nodeIds = run.nodes.map(n => n.id);
    const edgeKeys = run.edges.map(e => e.from + '>' + e.to);
    expect(new Set(nodeIds).size).toBe(nodeIds.length);
    expect(new Set(edgeKeys).size).toBe(edgeKeys.length);
  });

  test('metrics match its nodes', () => {
    const totalMs = run.nodes.reduce((sum, n) => sum + n.durationMs, 0);
    expect(run.metrics.totalMs).toBe(totalMs);
    expect(run.metrics.nodes).toBe(run.nodes.length);
    expect(run.metrics.successful + run.metrics.failed).toBe(run.nodes.length);
  });

  test('ships at least one authored counterfactual', () => {
    expect(run.counterfactuals.length).toBeGreaterThan(0);
  });

  test('every counterfactual override targets an existing node', () => {
    const ids = new Set(run.nodes.map(n => n.id));
    run.counterfactuals.forEach(cf => {
      Object.keys(cf.nodeOverrides).forEach(id => expect(ids.has(id)).toBe(true));
    });
  });

  test('every counterfactual materializes and changes the final answer', () => {
    run.counterfactuals.forEach(cf => {
      const view = viewWithCounterfactual(cf.id);
      expect(view.isCounterfactual).toBe(true);
      expect(view.run.finalAnswer).not.toBe(run.finalAnswer);
      expect(view.overriddenNodeIds.size).toBeGreaterThan(0);
    });
  });

  test('each counterfactual totalMs matches its step durations', () => {
    run.counterfactuals.forEach(cf => {
      const view = viewWithCounterfactual(cf.id);
      const totalMs = view.run.nodes.reduce((sum, n) => sum + n.durationMs, 0);
      expect(view.run.metrics.totalMs).toBe(totalMs);
    });
  });

  test('the Logic Engine computes at least one scenario for it', () => {
    const found = run.nodes.flatMap(n =>
      ctx.window.AgentFlowCounterfactual.computeNodeCounterfactuals(run, n.id));
    expect(found.length).toBeGreaterThan(0);
  });
});
