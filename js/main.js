'use strict';

const exported = [
  'selectRun', 'selectNode', 'setTab', 'setCf', 'toggleCf',
  'deleteActiveRun', 'deleteNode', 'handleExport',
  'openImportDialog', 'doImport', 'closeModal',
  'openNewRunDialog', 'createNewRun',
  'openAddNodeDialog', 'addNode',
  'openEditNodeDialog', 'saveEditNode',
  'openAddCfDialog', 'createCf',
  'initDrag', 'resetLayout',
];
exported.forEach(fn => { window[fn] = eval(fn); });

render(); // boot