/*! AgentFlow — Copyright (c) 2026 Visigence. Proprietary. */
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
        <div style="padding:48px;max-width:560px;margin:0 auto;color:#ecf0fb;font-family:system-ui">
          <h1 style="font-size:18px;margin-bottom:12px;color:#ff7a85">Something broke</h1>
          <p style="font-size:13px;color:#9aa3c0;margin-bottom:16px">
            ${esc(label || 'render')} failed. Your data is preserved.
          </p>
          <pre style="font-size:11px;background:rgba(255,255,255,.04);padding:12px;border-radius:8px;overflow:auto;max-height:240px;white-space:pre-wrap;word-break:break-word">${esc(msg)}</pre>
          <div style="display:flex;gap:8px;margin-top:16px">
            <button id="eb-reload" style="padding:8px 14px;border-radius:8px;background:#5f7ef5;color:#0b0d15;border:0;font-weight:600;cursor:pointer">Reload</button>
            <button id="eb-reset" style="padding:8px 14px;border-radius:8px;background:transparent;color:#ecf0fb;border:1px solid rgba(255,255,255,.14);cursor:pointer">Reset & reload</button>
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
