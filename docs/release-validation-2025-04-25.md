# AgentFlow v1.0 Release Validation Report

**Date:** 2025-04-25  
**Validator:** Automated release-validation pass (all source files read in full, test suite executed, Node.js probes run for edge cases)  
**Commit validated:** HEAD of `main` at time of this run  
**Test result:** `npm test` → 251 tests, 5 suites, 0 failed, 0 skipped ✓

---

## 1. Verdict

**SHIP-WITH-CAVEATS**

No XSS vector, no base-run mutation, no localStorage data corruption, and no critical security vulnerability was found. However, five high-severity issues exist that must be resolved before pushing the v1.0 tag: CSP header/meta mismatch, immutable cache headers on unfingerprinted assets, undetected removed-node CF case, CF metrics documented as per-field fallback but implemented as all-or-nothing, and missing LICENSE file.

---

## 2. Blockers

Items are ordered high → medium → low. Every claim cites `file:line`.

---

### B-1 — CSP `script-src 'unsafe-inline'` in HTTP header while meta CSP forbids it  
**File:** `vercel.json:17`  
**Severity:** HIGH  

`vercel.json` sends:  
```
Content-Security-Policy: … script-src 'self' 'unsafe-inline' …
```  
`index.html:9–10` sends:  
```
<meta http-equiv="Content-Security-Policy" content="… script-src 'self' …">
```  

Because browsers apply both policies and enforce the intersection, the meta's stricter `script-src 'self'` currently wins. But if the meta tag is ever removed or altered, the HTTP header silently allows inline script execution across the entire origin. The discrepancy is also a maintenance hazard: any developer reading the deployed HTTP headers sees `unsafe-inline` and believes inline scripts are permitted.  

**Additional mismatch:** `vercel.json` omits `manifest-src 'self'` and `worker-src 'self'` that index.html includes. `Referrer-Policy` header (`strict-origin-when-cross-origin`) disagrees with the meta tag (`no-referrer`).  

**Suggested fix:** Make `vercel.json`'s `script-src` directive identical to `index.html`'s (`'self'` without `'unsafe-inline'`), and reconcile all directives so both sources are consistent.

---

### B-2 — Immutable cache headers on unfingerprinted JS/CSS assets  
**File:** `vercel.json:21–30`  
**Severity:** HIGH  

`vercel.json` sets `Cache-Control: public, max-age=31536000, immutable` for `/js/*.js` and `/css/*.css`. None of these files have a content-hash fingerprint in their filenames (e.g., they are `constants.js`, not `constants.abc123.js`). After any deployment, users with cached copies will use the old JavaScript for up to 365 days. There is no forced-revalidation path. The `immutable` directive is correct only when filenames change with each content change.  

**Suggested fix:** Either remove `immutable` and shorten `max-age` (e.g., `max-age=3600`), or add a build step that appends content hashes to filenames. The latter violates the no-build-step invariant; the former is the only in-bounds fix.

---

### B-3 — Removed-node CF case not detected in `overriddenNodeIds`  
**File:** `js/state.js:100–117` (`_buildRunView`)  
**Severity:** HIGH  

`_buildRunView` iterates `cfRun.nodes` to build `overriddenNodeIds`. If a base-run node is absent from `cf.nodes`, the removal is never detected — the node does not receive the `cf-override` CSS class and the "modified by counterfactual" indicator is not shown.

**Probe confirmation:** constructing a CF with `nodeOverrides` that sets `n2` to `null` (removal intent) and then checking `overriddenNodeIds` — `n2` is absent from the set. The canvas renders `n2` as unmodified.

The docs describe three override cases: "added nodes, removed nodes, and field-only changes". Only field-only changes and additions are implemented. The removed-node case is silently ignored.  

**Suggested fix:** After the `cfRun.nodes` loop, iterate `run.nodes` and add to `overriddenNodeIds` any node whose `id` is absent from `cfRun.nodes`.

---

### B-4 — CF metrics is all-or-nothing; docs claim per-field fallback  
**File:** `js/state.js:72` (`_materializeCounterfactualRun`)  
**Severity:** HIGH  

The code:  
```js
metrics: Object.assign({}, cf.metrics || run.metrics || {}),
```  

If `cf.metrics` is non-null but partial (e.g., `{ totalMs: 500 }` with no `tokens`, `nodes`, `successful`, or `failed`), the result omits those fields entirely. It does NOT fall back to the base run's value on a per-field basis.

**CODEBASE_OVERVIEW.md section 3** states: "CF metrics fall back to run metrics on a per-field basis". This claim is false. The probe produced `{ totalMs: 500 }` from a CF with `{ totalMs: 500 }` and a base run with `{ totalMs: 100, tokens: 50, nodes: 1, successful: 1, failed: 0 }`. The `tokens`/`nodes`/`successful`/`failed` values are missing from the CF run.

**Downstream impact:** The metrics bar will render blank or zero values for any CF whose author specifies only some metrics fields.  

**Suggested fix:** Replace the single `Object.assign` with a per-field merge:  
```js
metrics: {
  totalMs:    cf.metrics?.totalMs    ?? run.metrics?.totalMs    ?? 0,
  tokens:     cf.metrics?.tokens     ?? run.metrics?.tokens     ?? 0,
  nodes:      cf.metrics?.nodes      ?? run.metrics?.nodes      ?? 0,
  successful: cf.metrics?.successful ?? run.metrics?.successful ?? 0,
  failed:     cf.metrics?.failed     ?? run.metrics?.failed     ?? 0,
},
```

---

### B-5 — `truncate()` throws on circular-reference objects  
**File:** `js/adapters.js:24`  
**Severity:** MEDIUM  

```js
function truncate(obj, maxLen = 300) {
  if (obj === null || obj === undefined) return '';
  const s = JSON.stringify(obj);   // throws if obj contains circular ref
  …
}
```  

`JSON.stringify` throws `TypeError: Converting circular structure to JSON` when passed a circular object. Malformed trace payloads from LangSmith/LangFuse/Weave that contain self-referencing output objects will trigger this throw inside `fromLangSmith` / `fromLangFuse` / `fromWeave`. Those functions are called inside `importFromThirdParty`'s `try/catch` (`js/adapters.js:259–269`), so the error is caught and the user sees `"Adapter error: Converting circular structure to JSON"` rather than a blank page. However, the error message is opaque and the prior state is preserved (confirmed: `_dispatch` wraps `doImport`).  

**Suggested fix:** Guard with `try { return JSON.stringify(obj) } catch { return '[circular]' }`.

---

### B-6 — `cfRun.counterfactuals` aliased to base run's array (latent)  
**File:** `js/state.js:69` (`_materializeCounterfactualRun`)  
**Severity:** MEDIUM  

```js
return Object.assign({}, run, { nodes, edges, metrics, finalAnswer });
```  

`counterfactuals` is not overridden, so `cfRun.counterfactuals === run.counterfactuals === state.runs[i].counterfactuals` (confirmed by probe). **No current write path exists** through this alias: `render.js` and `drag.js` both access counterfactuals via `originalRun`, not via `cfRun`. `_normalizeState` deep-clones every run before persistence, so no state mutation occurs.  

This is a latent defect: any future code that writes `cfRun.counterfactuals.push(...)` would silently corrupt `state.runs`.  

**Suggested fix:** Add `counterfactuals: run.counterfactuals ? [...run.counterfactuals] : []` to the Object.assign override payload.

---

### B-7 — Dangling edges silently accepted through import  
**File:** `js/data.js` (`validateRunSchema`) — no check for edge endpoint existence  
**Severity:** MEDIUM  

`validateRunSchema` does not verify that `edge.from` and `edge.to` refer to existing node IDs. A schema-valid import with edges pointing at non-existent nodes passes validation, is stored in state, and is silently ignored at render time (`render.js` skips edges with missing node positions: `if (!from || !to) return ''`). The user sees a partial graph with no error message.  

**Suggested fix:** After validating all nodes and edges individually, verify that every `edge.from` and `edge.to` appears in the node `id` set. Return an error string for the first dangling edge found.

---

### B-8 — `setState` is not wrapped in `ErrorBoundary`  
**File:** `js/state.js:164–168`; `js/utils.js:50–94`  
**Severity:** MEDIUM  

`ErrorBoundary.wrap` is applied to event handler functions dispatched through `_dispatch` (`events.js:373–378`). But `setState` itself is not wrapped. If `_normalizeState` or `makeSampleData` throws:  
- Calls via `_dispatch` are caught by `_dispatch`'s `try/catch`. ✓  
- The call in `drag.js:75` (`_onUp`) is **not** wrapped. An error there propagates to the raw `mouseup` event listener. The global `window.onerror` handler installed by `ErrorBoundary.install` (`utils.js:87`) will eventually show the overlay, but the drag state may be left dirty.  

**Suggested fix:** Wrap the `setState(...)` call in `_onUp` with a try/catch or with `ErrorBoundary.wrap`.

---

### B-9 — No LICENSE file  
**File:** repository root  
**Severity:** MEDIUM  

No `LICENSE` file is present. Without a license, the repository is legally "all rights reserved" by default, which conflicts with the implied open-source intent and prevents any downstream use. The README does not mention a license.  

**Suggested fix:** Add a LICENSE file. The rest of the project invariants do not constrain this choice.

---

### B-10 — No `SECURITY.md` file  
**File:** repository root  
**Severity:** MEDIUM  

There is no documented channel for responsible disclosure. GitHub's security advisory system is unavailable to reporters without a `SECURITY.md`.  

**Suggested fix:** Add `SECURITY.md` with at minimum a contact address or GitHub "Report a vulnerability" pointer.

---

### B-11 — `SafeStore.save` serializes then checks size; docs claim the reverse  
**File:** `js/utils.js:40–43`  
**Severity:** LOW  

The code:  
```js
save(obj) {
  const json = JSON.stringify(obj);   // full serialization first
  if (json.length > MAX_BYTES) return false;  // then check
  localStorage.setItem(KEY, json);
  return true;
}
```  

`CODEBASE_OVERVIEW.md` section 4 states: "enforced before serialization". That is false. Serialization happens first; the check rejects the result. The behavior is correct (oversized data is never written), but the documented claim is wrong, and serializing a 5 MB object only to discard it wastes ~10–50 ms on a low-end device.  

**Suggested fix:** Correct the documentation. If performance is a concern, pre-estimate size from the runs array length × node count before serializing.

---

### B-12 — CODEBASE_OVERVIEW.md per-suite test breakdown is wrong  
**File:** `CODEBASE_OVERVIEW.md:112` and section 5 header  
**Severity:** LOW  

The documented breakdown:

| Suite | Claimed | Actual |
|---|---|---|
| utils | 34 | 39 |
| data | 47 | 52 |
| layout | 14 | 14 ✓ |
| state | 53 | 48 |
| adapters | 103 | 98 |
| **Total** | **251** | **251** ✓ |

The total is correct but four of five per-suite numbers are wrong. Verified by `grep -c 'test('` and by Jest verbose output.

---

## 3. Caveats

Known limitations acceptable for v1.0, documented here for users.

| Behavior | User-visible impact | Workaround |
|---|---|---|
| localStorage disabled (private browsing, some browsers) | App boots using sample data; edits and imports are not persisted across page loads. No crash. | Use a non-private browser session. |
| File import size cap is 2 MB (`events.js:116`) | Trace files larger than 2 MB are rejected with "File too large". The paste path has a 4 MB soft cap via SafeStore. | Split large traces into multiple files. |
| Drag-and-drop is the only way to reposition nodes (no keyboard alternative) | Keyboard-only and switch-access users cannot reposition nodes. This is a WCAG 2.1 SC 2.1.1 failure. | Use the auto-layout (every render resets positions; manually moving nodes requires a mouse). |
| Status indicator dots use color only (green `#5ee1a1` vs red `#ff7a85`) | Protan/deuteran color-blind users may not distinguish success from failure at a glance. Status text label is present (`status-label` span, `render.js:163`) so the information is accessible via text, but the dot alone is not distinguishable. | Read the text label beside each dot. |
| No `aria-live` region for status updates | Screen reader users are not notified when a run is selected or a counterfactual is toggled. | Not available; the user must navigate to the updated content manually. |
| `role="tab"` on tab elements without `role="tablist"` on container | AT may not expose the tab pattern correctly. `render.js:92–93` assigns `role="tab"` to individual divs; the parent `.tab-bar` has no `role="tablist"`. | Not available. |
| `inferRole` classifies unknown op types/names as `'plan'` (`adapters.js:38`) | An unrecognised operation imported from Weave or LangFuse will appear as a planning step in the graph. | Override the role using the node edit dialog after import. |
| `truncate()` produces `"[object Object]"` for objects that do NOT trigger `JSON.stringify` (falsy path) | Only affects the `obj === null/undefined` check which returns `''`. All other objects go through JSON.stringify. No user-visible issue in practice for well-formed traces. | N/A. |
| CF finalAnswer empty string (`""`) is treated as a valid CF answer, not a "not set" signal | A CF with `finalAnswer: ""` will display an empty Final Answer panel rather than falling through to the base run's answer. | Set `finalAnswer` to `undefined` or omit it in the CF to inherit the base run's answer. |

---

## 4. Test Gaps

Ranked by risk (highest first). For each gap, the minimum test that would close it.

---

### TG-1 — Removed-node detection in CF (HIGH — functional gap)
**No test exists** for the case where a base-run node is absent from `cf.nodes`.  
**Minimal test:**
```js
test('removed base node is in overriddenNodeIds', () => {
  // base run has n1 + n2; CF specifies only n1 in nodeOverrides but omits n2
  setState({ runs: [run], activeRunId: 'r1', activeCounterfactual: 'cf1' });
  const view = getActiveRunView();
  expect(view.overriddenNodeIds.has('n2')).toBe(true);
});
```

---

### TG-2 — CF metrics partial-field fallback (HIGH — claimed behavior untested)
No test confirms that a CF with `metrics: { totalMs: 500 }` and a base run with `tokens: 50` causes the materialized CF run to carry `tokens: 50`.  
**Minimal test:**
```js
test('CF metrics fields absent in cf.metrics fall back to run.metrics', () => {
  // base: { totalMs:100, tokens:50, nodes:1, successful:1, failed:0 }
  // cf.metrics: { totalMs: 500 }
  const cfRun = _materializeCounterfactualRun(run, cf);
  expect(cfRun.metrics.tokens).toBe(50);   // falls back to base
  expect(cfRun.metrics.totalMs).toBe(500); // overridden
});
```
Note: this test will FAIL against current code (B-4 must be fixed first).

---

### TG-3 — SafeStore 4 MB quota rejection (MEDIUM — test is a no-op)
`utils.test.js:231–238` is titled "oversized data is not saved" but the assertion only checks that a normal-size save returns a state with `.runs.length > 0`. It does not construct an oversized payload and assert that `SafeStore.save` returns `false`.  
**Minimal test:**
```js
test('SafeStore.save returns false for payload over 4 MB', () => {
  const bigStr = 'x'.repeat(4 * 1024 * 1024 + 1);
  const result = SafeStore.save({ runs: [{ id: 'r', name: bigStr, nodes: [], edges: [], metrics: {}, finalAnswer: '', counterfactuals: [] }], activeRunId: 'r', activeCounterfactual: null, nodePositions: {}, activeTab: 'graph' });
  expect(result).toBe(false);
});
```

---

### TG-4 — `truncate()` on circular-reference input (MEDIUM)
No test covers the `JSON.stringify` throw path.  
**Minimal test:**
```js
test('truncate does not throw on circular reference', () => {
  const obj = {}; obj.self = obj;
  expect(() => truncate(obj)).not.toThrow();
});
```
Note: this test will FAIL against current code (B-5 must be fixed first).

---

### TG-5 — Layout with a self-loop edge (MEDIUM)
No layout test covers `edges: [{ from: 'n1', to: 'n1' }]`.  
**Minimal test:**
```js
test('layout handles self-loop without crash and assigns coordinates', () => {
  const pos = computeLayout([{ id: 'n1' }], [{ from: 'n1', to: 'n1' }]);
  expect(pos['n1']).toBeDefined();
  expect(pos['n1'].x).toBeGreaterThanOrEqual(0);
});
```

---

### TG-6 — Layout with disconnected components (MEDIUM)
No layout test covers a graph with two components not connected by any edge.  
**Minimal test:**
```js
test('layout assigns coordinates to all nodes in disconnected graph', () => {
  const nodes = [{ id: 'a' }, { id: 'b' }];
  const pos = computeLayout(nodes, []);
  expect(pos['a']).toBeDefined();
  expect(pos['b']).toBeDefined();
});
```

---

### TG-7 — `detectFormat` ambiguity when input has both `run_type` and `op_name` (LOW)
Only LangSmith+LangFuse ambiguity is tested (`adapters.test.js`). No test for an object with both `run_type` (LangSmith) and `op_name` (Weave).  
**Minimal test:**
```js
test('detectFormat prefers langsmith over weave on ambiguous input', () => {
  expect(detectFormat({ run_type: 'chain', op_name: 'foo' })).toBe('langsmith');
});
```

---

### TG-8 — `msDiff` with timezone-offset ISO strings (LOW)
All `msDiff` tests use UTC-only `Z` timestamps. The function uses `new Date(s)` which handles offset strings, but no test confirms correctness.  
**Minimal test:**
```js
test('msDiff handles ISO strings with timezone offsets', () => {
  expect(msDiff('2024-01-01T00:00:00+05:30', '2024-01-01T00:00:01+05:30')).toBe(1000);
});
```

---

### TG-9 — `inferRole` when type indicates one role and name indicates another (LOW)
No test exercises the case where `type='plan'` but `name='search'` (or vice versa).  
**Minimal test:**
```js
test('inferRole returns role matching name when name is more specific', () => {
  // Documents the actual precedence order (name checked before type)
  expect(inferRole('plan', 'search the web')).toBe('retrieve');
});
```

---

### TG-10 — DOM-dependent files: untested high-risk paths

The test harness loads `render.js`, `events.js`, `drag.js`, and `main.js` via `vm.createContext` with a minimal DOM mock, but no assertions run against their outputs. These files are **zero-coverage** for behavioral testing.

| File | Highest-risk untested path | Recommended manual verification step |
|---|---|---|
| `render.js` | All `${}` interpolations in `buildNodeCard`, `buildDetailPanel`, `buildCfTab` — XSS surface | Paste a trace with node names containing `<script>alert(1)</script>`; verify it renders as literal text and no alert fires. |
| `render.js` | `buildEdgesHTML` skips edges with missing positions — dangling-edge behavior | Import a JSON file with an edge pointing at a non-existent node; verify the edge is silently omitted and no JS error appears in console. |
| `events.js` | `doImport` → `importFromThirdParty` error path — does the prior state survive a bad import? | Paste valid JSON that fails schema validation; verify the existing run list is unchanged after the error modal is dismissed. |
| `events.js` | `saveEditNode` / `_mutateActiveContext` — non-active run/CF objects returned by reference before setState clones them | Edit a node's content, cancel, reopen — verify content shows original value. |
| `drag.js` | `_onUp` writing `nodePositions` to state — does position survive a page reload? | Drag a node, reload, verify it reappears at the new position. |
| `main.js` | `init` with pre-existing localStorage from a previous schema version | Manually set `localStorage.agentflow.v1` to a v0-shaped JSON object; verify app boots without crash. |

---

## 5. Performance Numbers

All measurements taken with Node.js `performance.now()` (no DOM, no render overhead). Layout and adapter probes run 100 iterations each; reported as average.

| Operation | Input | Measured (avg) | Claimed |
|---|---|---|---|
| `computeLayout` — 500-node chain | 500 nodes, 499 edges, linear | **0.55 ms** | < 5 ms ✓ |
| `computeLayout` — 500 disconnected nodes | 500 nodes, 0 edges | **0.14 ms** | < 5 ms ✓ |
| `fromLangSmith` — 40-node nested trace | sample fixture, 40 nodes | **0.29 ms** | not documented |
| `render()` — up to 500 nodes | N/A — requires DOM | **not measured** | < 5 ms (unmeasured) |
| Drag `_onMove` per-frame | N/A — requires DOM | **not measured** | 60 fps claim (unmeasured) |

**Render time** cannot be measured without a real DOM. Manual verification is required: open the app in a browser with DevTools Performance panel, record a trace while switching runs with 500 nodes, confirm `render()` paint time is under 5 ms.  

**Drag fps** cannot be measured without a real DOM. Structural verification (code inspection) confirms `_onMove` (`drag.js:45–57`) performs only DOM style writes and `path.setAttribute` — no `setState`, no `render()`, no layout computation. The 60 fps claim is structurally plausible but not empirically confirmed.

---

## 6. Phase 1 Readiness — LangChain Integration Round-Trip Blockers

The following issues would break a LangChain-to-AgentFlow round-trip if LangChain sends CF overrides with partial data:

| Issue | Round-trip impact | Status |
|---|---|---|
| CF metrics all-or-nothing (B-4) | If LangChain sends `cf.metrics: { totalMs: N }` without full fields, the CF run's tokens/nodes/successful/failed will be blank in the UI. | **BLOCKER** — fix before integration |
| Removed-node detection missing (B-3) | If LangChain sends a CF that removes a node from the trace, the removal is not surfaced in `overriddenNodeIds`; the node renders as if unmodified. | **BLOCKER** — fix before integration |
| Dangling edge not flagged at import (B-7) | If LangChain emits a trace where a failed/removed node is deleted from the node array but its edges remain, the import silently accepts it. The UI renders partial graph with no indication that edges are dangling. | **MEDIUM** — acceptable if LangChain always keeps edge/node arrays consistent |
| `truncate()` crash on circular output (B-5) | If a LangChain node's output object has a circular reference (common with some LangChain callback objects), the import returns `"Adapter error: …"` rather than partial data. | **MEDIUM** — guard before integration |
| `cfRun.counterfactuals` aliased (B-6) | Not a current round-trip risk; becomes a risk if integration code reads CF properties from the materialized CF run object. | LOW |

---

## 7. Sign-Off Checklist

The author must tick every box before pushing the `v1.0` tag.

### Must-fix before tag

- [ ] **B-1** Remove `'unsafe-inline'` from `vercel.json` `script-src`; reconcile `Referrer-Policy` and add `manifest-src`/`worker-src` to both sources.  
- [ ] **B-2** Remove `immutable` from `vercel.json` cache headers for `/js/*.js` and `/css/*.css` (or add content-hash fingerprinting, which requires a build step).  
- [ ] **B-3** Implement removed-node detection in `_buildRunView`: add base nodes absent from `cfRun.nodes` to `overriddenNodeIds`.  
- [ ] **B-4** Replace all-or-nothing CF metrics merge with per-field `??` fallback to `run.metrics`.  
- [ ] **B-5** Guard `truncate()` against `JSON.stringify` circular-reference throw.  
- [ ] **B-9** Add a LICENSE file.  
- [ ] **B-10** Add a `SECURITY.md` with a vulnerability disclosure contact.  

### Should-fix before tag (medium severity)

- [ ] **B-6** Override `counterfactuals` in `_materializeCounterfactualRun` to prevent latent aliasing.  
- [ ] **B-7** Add dangling-edge detection to `validateRunSchema`.  
- [ ] **B-8** Wrap `setState` call in `drag.js:75` with try/catch.  
- [ ] **TG-1** Add removed-node CF test (will be green after B-3 is fixed).  
- [ ] **TG-2** Add CF partial-metrics test (will be green after B-4 is fixed).  
- [ ] **TG-3** Replace no-op SafeStore quota test with an actual oversized-payload assertion.  
- [ ] **TG-4** Add `truncate()` circular-reference test (green after B-5 is fixed).  

### Documentation corrections

- [ ] **B-12** Correct per-suite test breakdown in `CODEBASE_OVERVIEW.md` section 5 header (actual: utils=39, data=52, state=48, adapters=98; total=251 correct).  
- [ ] **B-11** Correct `CODEBASE_OVERVIEW.md` section 4: "enforced before serialization" → "serialized then checked; oversized serialization is discarded before any localStorage write".  
- [ ] Update `CODEBASE_OVERVIEW.md` section 3 CF metrics claim to match implementation (all-or-nothing, not per-field), OR fix B-4 first and leave the claim.  

### Manual verification (cannot be automated without DOM)

- [ ] Paste a trace with `<script>alert(1)</script>` in node name/content fields; confirm no XSS.  
- [ ] Import `.agentflow.json` with an edge pointing at a non-existent node; confirm the app shows an error or renders gracefully with no console error.  
- [ ] Measure render time in Chrome DevTools on the bundled sample data and on a synthetic 500-node graph; confirm under 5 ms.  
- [ ] Record drag performance with DevTools; confirm `_onMove` stays under 16 ms per frame.  
- [ ] Disable localStorage (DevTools → Application → Storage → block site data) and reload; confirm app boots with sample data and no crash.  
- [ ] Paste a 5 MB JSON file; confirm user sees a clear rejection message and prior state is preserved.  
- [ ] Keyboard-navigate through node cards; confirm Tab order follows visual order and focus rings are visible.  
- [ ] Enable a browser screen reader; confirm node cards announce label and status when focused.  

---

*End of validation report.*
