'use strict';

const SAFE_ID_RE = /^[A-Za-z0-9_-]{1,80}$/;

const ICONS = { /* paste the full ICONS object here */ };

const ROLES = {
  input:      { color: 'var(--role-input)',      label: 'Input' },
  retrieve:   { color: 'var(--role-retrieve)',   label: 'Retrieve' },
  plan:       { color: 'var(--role-plan)',        label: 'Plan' },
  tool:       { color: 'var(--role-tool)',        label: 'Tool' },
  synthesize: { color: 'var(--role-synthesize)', label: 'Synthesize' },
  validate:   { color: 'var(--role-validate)',   label: 'Validate' },
  output:     { color: 'var(--role-output)',     label: 'Output' },
};
const ROLE_KEYS = Object.keys(ROLES);

const STATUSES = {
  success: { cls: 's-success', label: 'Success' },
  failed:  { cls: 's-failed',  label: 'Failed' },
  running: { cls: 's-running', label: 'Running' },
  skipped: { cls: 's-skipped', label: 'Skipped' },
  pending: { cls: 's-pending', label: 'Pending' },
};
const STATUS_KEYS = Object.keys(STATUSES);