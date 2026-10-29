'use strict';

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');
const { createAppContext } = require('./helpers/loadContext');

// events.js only defines functions at load time, so it can run in the shared
// sandbox; the DOM it touches is replaced by the minimal event targets below.
const EVENTS_SRC = fs.readFileSync(path.join(__dirname, '../public/js/events.js'), 'utf8');

function makeTarget(extra) {
  const listeners = {};
  return Object.assign({
    listeners,
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    removeEventListener() {},
  }, extra);
}

let ctx, app, doc;
beforeEach(() => {
  app = makeTarget();
  doc = makeTarget({
    getElementById: id => (id === 'app' ? app : null),
    querySelector: () => null,
    querySelectorAll: () => [],
    activeElement: null,
    body: { appendChild() {}, style: {} },
  });
  ctx = createAppContext({ document: doc });
  vm.runInContext(EVENTS_SRC, ctx);
  vm.runInContext('installDelegation()', ctx);
});

// ── Helpers ───────────────────────────────────────────────────────────────────

// Replays an event the way a browser bubbles it: through #app when the target
// is inside it, then through document, with the same event object throughout.
function fire(type, event, { insideApp = true } = {}) {
  if (insideApp) (app.listeners[type] || []).forEach(fn => fn(event));
  (doc.listeners[type] || []).forEach(fn => fn(event));
}

function clickOn(dataset) {
  const el = { dataset };
  return { target: { dataset: {}, closest: sel => (sel === '[data-action]' ? el : null) } };
}

function changeOn(dataset, value) {
  const el = { dataset, value };
  return { target: { dataset: {}, closest: sel => (sel === '[data-change]' ? el : null) } };
}

function spyOnAction(name) {
  const calls = [];
  vm.runInContext('ACTIONS', ctx)[name] = (...args) => calls.push(args);
  return calls;
}

function chainRun() {
  return {
    id: 'run-chain',
    name: 'Chain',
    nodes: [
      { id: 'n1', name: 'Input',  content: 'q', role: 'input',  status: 'success' },
      { id: 'n2', name: 'Output', content: 'a', role: 'output', status: 'success' },
    ],
    edges: [{ from: 'n1', to: 'n2' }],
    counterfactuals: [
      { id: 'cf1', name: 'Scenario', nodeOverrides: { n2: { status: 'failed' } } },
    ],
  };
}

// ── Delegation ────────────────────────────────────────────────────────────────

describe('event delegation', () => {
  test('a click inside #app dispatches its action exactly once', () => {
    const calls = spyOnAction('selectNode');
    fire('click', clickOn({ action: 'selectNode', id: 'n1' }));
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe('n1');
  });

  test('a click outside #app (the import dialog) still dispatches once', () => {
    const calls = spyOnAction('doImport');
    fire('click', clickOn({ action: 'doImport' }), { insideApp: false });
    expect(calls).toHaveLength(1);
  });

  test('a change inside #app dispatches its data-change action exactly once', () => {
    const calls = spyOnAction('setCf');
    fire('change', changeOn({ change: 'setCf' }, 'cf1'));
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe('cf1');
  });

  test('a click on an element without data-action dispatches nothing', () => {
    const calls = spyOnAction('selectNode');
    fire('click', { target: { dataset: {}, closest: () => null } });
    expect(calls).toHaveLength(0);
  });
});

// ── Toggle actions through real clicks ────────────────────────────────────────

describe('toggle actions through delegated clicks', () => {
  const state = () => vm.runInContext('state', ctx);

  beforeEach(() => {
    const run = chainRun();
    ctx.setState({ runs: [run], activeRunId: run.id });
  });

  test('clicking a node selects it', () => {
    fire('click', clickOn({ action: 'selectNode', id: 'n2' }));
    expect(state().selectedNodeId).toBe('n2');
  });

  test('clicking the selected node again deselects it', () => {
    fire('click', clickOn({ action: 'selectNode', id: 'n2' }));
    fire('click', clickOn({ action: 'selectNode', id: 'n2' }));
    expect(state().selectedNodeId).toBeNull();
  });

  test('clicking a counterfactual card activates it', () => {
    fire('click', clickOn({ action: 'toggleCf', id: 'cf1' }));
    expect(state().activeCounterfactual).toBe('cf1');
  });

  test('clicking the active counterfactual card again deactivates it', () => {
    fire('click', clickOn({ action: 'toggleCf', id: 'cf1' }));
    fire('click', clickOn({ action: 'toggleCf', id: 'cf1' }));
    expect(state().activeCounterfactual).toBeNull();
  });
});

// ── Try an example ────────────────────────────────────────────────────────────

describe('Try an example', () => {
  const state = () => vm.runInContext('state', ctx);
  const exampleId = () => vm.runInContext('EXAMPLE_RUN.id', ctx);

  test('loads the example run and makes it active', () => {
    fire('click', clickOn({ action: 'loadExample' }));
    expect(state().runs.map(r => r.id)).toEqual([exampleId()]);
    expect(state().activeRunId).toBe(exampleId());
  });

  test('loading it again selects the existing copy instead of duplicating it', () => {
    fire('click', clickOn({ action: 'loadExample' }));
    const run = chainRun();
    ctx.setState({ runs: state().runs.concat([run]), activeRunId: run.id });
    fire('click', clickOn({ action: 'loadExample' }));
    expect(state().runs).toHaveLength(2);
    expect(state().activeRunId).toBe(exampleId());
  });

  test('the loaded run is a copy, so edits never reach EXAMPLE_RUN', () => {
    fire('click', clickOn({ action: 'loadExample' }));
    state().runs[0].nodes[0].name = 'changed';
    expect(vm.runInContext('EXAMPLE_RUN.nodes[0].name', ctx)).not.toBe('changed');
  });
});
