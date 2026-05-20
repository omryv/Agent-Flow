'use strict';

const vm   = require('vm');
const fs   = require('fs');
const path = require('path');

// Create a fresh V8 context that hosts the Logic Engine globals.
// vm.createContext seeds the sandbox with all standard JS built-ins
// (Map, Set, Array, etc.) so the engine code runs without modification.
const context = {};
vm.createContext(context);

function load(filename) {
  const filepath = path.join(__dirname, '../../js', filename);
  const code = fs.readFileSync(filepath, 'utf8');
  vm.runInContext(code, context);
}

// Load in the same order as index.html to mirror production.
load('graph.js');
load('facts.js');
load('explain.js');
load('revision.js');

module.exports = context;
