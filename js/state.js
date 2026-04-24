'use strict';

let state = makeSampleData();

function setState(patch) {
  state = Object.assign({}, state, patch);
  render();
}

function getActiveRunView() { /* paste verbatim */ }