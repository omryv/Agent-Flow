'use strict';

const vm   = require('vm');
const fs   = require('fs');
const path = require('path');

const JS_DIR = path.join(__dirname, '../../public/js');

const SOURCE_FILES = [
  'graph.js',
  'facts.js',
  'explain.js',
  'revision.js',
];

const COMBINED_SCRIPT = SOURCE_FILES
  .map(f => fs.readFileSync(path.join(JS_DIR, f), 'utf8'))
  .join('\n');

// class/const declarations are lexically scoped — not promoted to context.
// Explicitly export them.
const EXPORTS = '\nthis.Fact=Fact;this.Query=Query;this.Revision=Revision;';

// Share host built-ins so toBeInstanceOf(Map/Set) works across the vm boundary.
const context = { Map, Set, Array, Object, TypeError, Error, Number, JSON, String, console };
vm.createContext(context);
vm.runInContext(COMBINED_SCRIPT + EXPORTS, context);

module.exports = context;
