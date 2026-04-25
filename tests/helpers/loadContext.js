/**
 * Shared helper that compiles all application source files into a single
 * script and evaluates it inside a fresh Node.js vm sandbox on every call.
 *
 * Why one combined script?
 *   The source files use top-level `const` / `let` declarations that are NOT
 *   promoted to the vm context's global object (only `var` and `function`
 *   declarations are).  Joining the files into a single vm.runInContext call
 *   keeps every binding in the same lexical scope, so later files can reference
 *   constants defined in earlier ones — exactly like the browser's sequential
 *   <script> tag loading.
 *
 * What is accessible after loading?
 *   • All top-level `function` declarations (e.g. esc, validateRunSchema,
 *     layoutNodes, importFromThirdParty, setState, getActiveRunView …) become
 *     properties of the returned context object.
 *   • Top-level `var` declarations likewise become context properties.
 *   • Top-level `const` / `let` live only in the combined script's lexical
 *     scope; they are NOT directly accessible on ctx, but closures inside the
 *     exported functions reference them correctly at runtime.
 */

'use strict';

const vm   = require('vm');
const fs   = require('fs');
const path = require('path');

const JS_DIR = path.join(__dirname, '../../js');

// Scripts loaded in the same dependency order as the HTML <script> tags.
// render.js, events.js, drag.js, and main.js are intentionally excluded:
// they depend on live DOM APIs that are not needed for unit-testing the
// pure business-logic layer.
const SOURCE_FILES = [
  'constants.js',
  'utils.js',
  'data.js',
  'state.js',
  'layout.js',
  'adapters.js',
];

// Read and concatenate once at module load time.
const COMBINED_SCRIPT = SOURCE_FILES
  .map(f => fs.readFileSync(path.join(JS_DIR, f), 'utf8'))
  .join('\n');

/**
 * Creates a fresh application context with mocked browser globals.
 *
 * The returned object is the vm sandbox; all `function` declarations from the
 * source files are accessible as direct properties (e.g. ctx.esc(),
 * ctx.validateRunSchema(), ctx.setState(), …).
 *
 * @param {object} [overrides] – extra globals to inject before scripts run.
 * @returns {vm.Context}
 */
function createAppContext(overrides = {}) {
  // A minimal, resettable localStorage mock.
  const mockLocalStorage = {
    _store: Object.create(null),
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(this._store, key)
        ? this._store[key]
        : null;
    },
    setItem(key, val) { this._store[key] = String(val); },
    removeItem(key)   { delete this._store[key]; },
    clear()           { this._store = Object.create(null); },
  };

  const ctx = vm.createContext({
    // Standard built-ins the scripts may reference
    console,
    setTimeout: () => 0,
    clearTimeout: () => {},

    // Browser-specific globals
    localStorage: mockLocalStorage,
    location:     { reload() {} },
    CSS:          { escape: s => s },
    URL:          { createObjectURL: () => 'blob:test', revokeObjectURL: () => {} },
    confirm:      () => true,
    document: {
      getElementById:       () => null,
      querySelector:        () => null,
      querySelectorAll:     () => [],
      createElement:        () => ({
        click() {},
        remove() {},
        addEventListener() {},
        style: {},
        rel: '',
        href: '',
        download: '',
      }),
      body: {
        appendChild:         () => {},
        removeEventListener: () => {},
        addEventListener:    () => {},
        style:               {},
      },
    },
    window: {
      addEventListener:    () => {},
      removeEventListener: () => {},
    },

    // render is guarded by `typeof render === 'function'` in state.js;
    // setting it to null prevents accidental DOM side-effects during tests.
    render: null,

    ...overrides,
  });

  vm.runInContext(COMBINED_SCRIPT, ctx);

  return ctx;
}

module.exports = { createAppContext };
