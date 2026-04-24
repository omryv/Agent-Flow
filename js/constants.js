/*!
 * AgentFlow
 * Copyright (c) 2026 Visigence. All rights reserved.
 * Proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use is prohibited.
 */
'use strict';



const SAFE_ID_RE = /^[A-Za-z0-9_-]{1,80}$/;

const ICONS = {
  logo: `<svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="11" cy="11" r="9" stroke="#6c8eff" stroke-width="1.8"/>
    <circle cx="11" cy="7" r="2" stroke="#6c8eff" stroke-width="1.5"/>
    <circle cx="6.5" cy="14.5" r="2" stroke="#f97316" stroke-width="1.5"/>
    <circle cx="15.5" cy="14.5" r="2" stroke="#10b981" stroke-width="1.5"/>
    <path d="M11 9L6.5 12.5" stroke="#6c8eff" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M11 9L15.5 12.5" stroke="#6c8eff" stroke-width="1.2" stroke-linecap="round"/>
  </svg>`,

  plus: `<svg width="13" height="13" viewBox="0 0 13 13" fill="none">
    <path d="M6.5 2v9M2 6.5h9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
  </svg>`,

  import: `<svg width="13" height="13" viewBox="0 0 13 13" fill="none">
    <path d="M6.5 1.5v7M4 6.5l2.5 2.5L9 6.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M1.5 10.5h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,

  export: `<svg width="13" height="13" viewBox="0 0 13 13" fill="none">
    <path d="M6.5 9V2M4 4.5L6.5 2 9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M1.5 10.5h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,

  delete: `<svg width="13" height="13" viewBox="0 0 13 13" fill="none">
    <path d="M2.5 4h8M5 4V2.5h3V4M5.5 6v4M7.5 6v4M3.5 4l.7 7h5.6l.7-7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  node: `<svg width="13" height="13" viewBox="0 0 13 13" fill="none">
    <rect x="1.5" y="3.5" width="10" height="6" rx="1.5" stroke="currentColor" stroke-width="1.4"/>
    <path d="M4.5 6.5h4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
  </svg>`,

  cf: `<svg width="13" height="13" viewBox="0 0 13 13" fill="none">
    <path d="M2 6.5C2 4 4 2 6.5 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="2 1.5"/>
    <path d="M11 6.5C11 9 9 11 6.5 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M9 4.5l2-2 2 2M3.5 11l-2-2 2-2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  info: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.4"/>
    <path d="M7 6.5v3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <circle cx="7" cy="4.5" r=".8" fill="currentColor"/>
  </svg>`,

  cursor: `<svg width="64" height="64" viewBox="0 0 64 64" fill="none">
    <rect x="8" y="8" width="48" height="48" rx="10" stroke="#2a3050" stroke-width="2"/>
    <circle cx="32" cy="28" r="8" stroke="#3a4468" stroke-width="2"/>
    <path d="M20 44 c0-8 24-8 24 0" stroke="#3a4468" stroke-width="2"/>
  </svg>`,
};

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