/*! AgentFlow — Copyright (c) 2026 Visigence. SPDX-License-Identifier: Apache-2.0 */
'use strict';

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\//g, '&#x2F;')
    .replace(/`/g, '&#96;')
    .replace(/=/g, '&#61;');
}

function escAttr(str) {
  return String(str ?? '').replace(/[^\w\-]/g, c => '&#' + c.charCodeAt(0) + ';');
}

function clampStr(str, max) {
  const s = String(str ?? '');
  return s.length > max ? s.slice(0, max) : s;
}

const SafeStore = (() => {
  const KEY = 'agentflow.v1';
  const MAX_BYTES = 4 * 1024 * 1024;
  return {
    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return null;
        if (raw.length > MAX_BYTES) { localStorage.removeItem(KEY); return null; }
        const data = JSON.parse(raw);
        return data && typeof data === 'object' ? data : null;
      } catch { return null; }
    },
    save(obj) {
      try {
        const json = JSON.stringify(obj);
        if (json.length > MAX_BYTES) return false;
        localStorage.setItem(KEY, json);
        return true;
      } catch { return false; }
    },
    clear() { try { localStorage.removeItem(KEY); } catch {} }
  };
})();

const ErrorBoundary = (() => {
  let booted = false;
  return {
    wrap(fn, label) {
      return function (...args) {
        try { return fn.apply(this, args); }
        catch (err) {
          console.error('[AgentFlow:' + label + ']', err);
          ErrorBoundary.show(err, label);
        }
      };
    },
    show(err, label) {
      const app = document.getElementById('app');
      if (!app) return;
      const msg = String(err?.message || err).slice(0, 500);
      app.innerHTML = `
        <div class="eb-panel">
          <h1 class="eb-title">Something broke</h1>
          <p class="eb-text">
            ${esc(label || 'render')} failed. Your data is preserved.
          </p>
          <pre class="eb-message">${esc(msg)}</pre>
          <div class="eb-actions">
            <button id="eb-reload" class="eb-btn eb-btn-primary">Reload</button>
            <button id="eb-reset" class="eb-btn">Reset & reload</button>
          </div>
        </div>`;
      document.getElementById('eb-reload')?.addEventListener('click', () => location.reload());
      document.getElementById('eb-reset')?.addEventListener('click', () => {
        SafeStore.clear();
        location.reload();
      });
    },
    install() {
      if (booted) return;
      booted = true;
      window.addEventListener('error', e => {
        ErrorBoundary.show(e.error || e.message, 'runtime');
      });
      window.addEventListener('unhandledrejection', e => {
        ErrorBoundary.show(e.reason, 'async');
      });
    }
  };
})();
