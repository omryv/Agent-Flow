# AgentFlow

**Read-only counterfactual inspector for LLM agent execution traces.**

Import a trace exported from LangSmith, LangFuse, or W&B Weave — or a native `.agentflow.json` file. AgentFlow renders the execution as an interactive directed acyclic graph, lets you flip between the original run and any embedded counterfactual scenarios, and shows you exactly which nodes changed, how the metrics shifted, and what the final answer would have been.

Zero build step. Zero runtime dependencies. One HTML file, eight JavaScript modules, one stylesheet.

---

## Contents

1. [What it does](#what-it-does)
2. [Deliberate scope limits](#deliberate-scope-limits)
3. [The data model](#the-data-model)
4. [Supported import formats](#supported-import-formats)
5. [The UI in detail](#the-ui-in-detail)
6. [Keyboard shortcuts](#keyboard-shortcuts)
7. [Architecture](#architecture)
8. [File structure](#file-structure)
9. [Script load order](#script-load-order)
10. [Security model](#security-model)
11. [Running locally](#running-locally)
12. [Running tests](#running-tests)
13. [Deployment](#deployment)
14. [Known limitations](#known-limitations)
15. [Status](#status)

---

## What it does

### Trace import

Open the Import dialog (toolbar button or `⌘I`). Pick any `.json` file up to **2 MB**. AgentFlow tries to parse it as a native `.agentflow.json` first; if that fails validation it hands the raw object to the adapter layer, which auto-detects whether it is a LangSmith run, a LangFuse trace, or a W&B Weave call tree (nested or flat-array export). The adapter converts it to the internal run schema, re-validates the result, and on success adds the run to the sidebar. Invalid files are rejected with a plain-English message; the existing session is never touched.

Multiple runs can coexist in the same session. The sidebar lists them all; clicking one makes it active.

### Graph view

The active run is laid out as a DAG. Each node is a colour-coded card showing:

- **Role** — one of seven categories, each with its own accent colour (see [Node roles](#node-roles))
- **Name** — the step name from the trace
- **Content** — the node's output or error, truncated to 300 characters
- **Status** — success / failed / running / skipped / pending, shown as a coloured dot plus label
- **Duration** — milliseconds, when present in the source trace

Edges are cubic-bezier SVG curves drawn from the right edge of the source node to the left edge of the target node. The canvas expands to fit the graph and scrolls independently.

Clicking a node opens its detail panel on the right, which shows all fields and, when a counterfactual is active, a side-by-side comparison with the original node state.

### Counterfactual viewing

A run can carry a `counterfactuals[]` array. Each counterfactual declares:

- `nodeOverrides` — a map of `nodeId → partial node` with fields to override
- `nodes` / `edges` — optional full replacement node/edge arrays
- `metrics` — optional per-field metric overrides (any omitted fields fall back to the base run's values)
- `finalAnswer` — optional replacement final answer string

Selecting a counterfactual from the **Scenario** dropdown (or from the Counterfactuals tab) re-renders the graph with overrides applied. Overridden nodes are highlighted with a blue glow ring; removed nodes (present in the base run but absent from the CF) are added to the override set and visually distinguished. The metrics bar shows delta indicators (+/−) for total time and token count. The Final Answer panel labels itself "counterfactual" in the CF view.

Counterfactual materialisation is a **read-time computation** — `_materializeCounterfactualRun` merges overrides onto a deep clone of the base run. The stored base run is never mutated.

### Run export

The Export button (`⌘E`) downloads the active run — including all its counterfactuals — as `{runId}.agentflow.json`. The downloaded file is valid native AgentFlow JSON and can be re-imported.

### Run navigation

- Click a run in the sidebar to activate it.
- `↑` / `↓` arrows cycle through runs.
- `←` / `→` arrows cycle through nodes in the active run.
- `Esc` closes the import modal, or deselects the selected node.

---

## Deliberate scope limits

These are design decisions for this version, not missing features:

| Not supported | Reason |
|---|---|
| Node creation, editing, or deletion | AgentFlow is a **read-only** inspector |
| Interactive counterfactual authoring | CFs come from the imported file |
| Drag-to-reposition nodes | Positions are computed by the layout algorithm |
| Command palette | Out of scope for v1 |
| Sample data on first load | Empty state prompts import |
| Live streaming / real-time traces | Imports are static files |
| Node search or filtering | Not yet implemented |

---

## The data model

### Run

```jsonc
{
  "id": "run-abc",          // SAFE_ID_RE: /^[A-Za-z0-9_-]{1,80}$/
  "name": "My agent run",  // string, max 200 chars
  "createdAt": "2026-04-25T12:00:00Z",
  "nodes": [ /* Node[] */ ],
  "edges": [ /* Edge[] */ ],
  "metrics": {
    "totalMs": 1420,
    "tokens": 320,
    "nodes": 6,
    "successful": 5,
    "failed": 1
  },
  "finalAnswer": "The answer is 42.",
  "counterfactuals": [ /* Counterfactual[] — optional */ ]
}
```

### Node

```jsonc
{
  "id": "node-1",           // SAFE_ID_RE
  "name": "Retrieve docs",  // max 200 chars
  "content": "...",         // string, max 10 000 chars
  "role": "retrieve",       // see Node roles below
  "status": "success",      // see Node statuses below
  "durationMs": 230         // optional, non-negative number
}
```

### Node roles

| Key | Colour | Typical use |
|---|---|---|
| `input` | orange `#ff9f45` | User query, initial prompt |
| `retrieve` | cyan `#22d3ee` | Vector search, document fetch, embedding |
| `plan` | purple `#a78bfa` | Reasoning, routing, decomposition (default for unknown types) |
| `tool` | pink `#f472b6` | API calls, calculators, code execution |
| `synthesize` | green `#34d399` | LLM generation (OpenAI, Anthropic, Gemini, etc.) |
| `validate` | amber `#fbbf24` | Fact-checking, guard rails, verification |
| `output` | blue `#60a5fa` | Final response, formatting, answer |

### Node statuses

| Key | Dot colour | Meaning |
|---|---|---|
| `success` | green | Completed without error |
| `failed` | red | Completed with error |
| `running` | blue | Currently executing |
| `skipped` | grey | Deliberately not executed |
| `pending` | muted | Not yet started |

### Edge

```jsonc
{ "from": "node-1", "to": "node-2" }
```

Both `from` and `to` must reference IDs that exist in `nodes`. `validateRunSchema` enforces referential integrity.

### Counterfactual

```jsonc
{
  "id": "cf-no-retrieval",
  "name": "Skip retrieval step",
  "description": "What if we answered from LLM knowledge only?",
  "nodeOverrides": {
    "node-2": { "status": "skipped", "content": "Skipped." }
  },
  "metrics": { "totalMs": 800 },   // per-field; absent fields fall back to run.metrics
  "finalAnswer": "42 (no context)"
}
```

---

## Supported import formats

### Native `.agentflow.json`

The full run schema above. Validated first. Re-import a file you previously exported.

### LangSmith

Detected by the presence of a `run_type` string on the root object.

```jsonc
{
  "id": "...", "name": "History QA", "run_type": "chain",
  "inputs": { ... }, "outputs": { ... }, "error": null,
  "start_time": "...", "end_time": "...",
  "extra": { "usage_metadata": { "total_tokens": 150 } },
  "child_runs": [ /* recursive */ ]
}
```

The adapter walks the `child_runs` tree recursively. Token counts are accumulated from `extra.usage_metadata`, `extra.token_usage`, and `outputs.llm_output.token_usage`.

### LangFuse

Detected by the presence of an `observations` array on the root object.

```jsonc
{
  "id": "...", "name": "My Trace", "timestamp": "...",
  "observations": [
    { "id": "...", "type": "GENERATION", "name": "...",
      "input": "...", "output": "...",
      "startTime": "...", "endTime": "...",
      "parentObservationId": null,
      "level": "DEFAULT",
      "usage": { "totalTokens": 120 } }
  ]
}
```

A virtual root node is created from the trace-level fields. Each observation becomes a node; `parentObservationId` determines edges. `level: ERROR` maps to `status: "failed"`.

### W&B Weave — nested

Detected when the root object (or first array element) has an `op_name` string.

```jsonc
{
  "id": "...", "op_name": "weave:///op/RetrieveStep:1",
  "display_name": "RetrieveStep",
  "inputs": { ... }, "output": { ... }, "exception": null,
  "started_at": "...", "ended_at": "...",
  "output": { "usage": { "total_tokens": 200 } },
  "children": [ /* recursive */ ]
}
```

### W&B Weave — flat array

An array of call objects where each has a `parent_id` field. Produced by the Weave query API.

```jsonc
[
  { "id": "root", "parent_id": null, "op_name": "...", ... },
  { "id": "child1", "parent_id": "root", "op_name": "...", ... }
]
```

---

## The UI in detail

```
┌─────────────────────────────────────────────────────────┐
│  Header: logo · tagline · [Export] · [Import]           │
├──────────┬──────────────────────────────────┬───────────┤
│          │  Toolbar: Graph | CFs  Scenario ▼│           │
│ Sidebar  │  Legend row                      │  Detail   │
│          │                                  │  panel    │
│  Runs    │  Graph canvas (scrollable)        │           │
│  list    │  ┌──────────────────────────┐    │  Node     │
│          │  │ SVG edges layer          │    │  name     │
│          │  │ Node cards (absolute)    │    │  role     │
│          │  └──────────────────────────┘    │  status   │
│          ├──────────────────────────────────│  duration │
│          │  Metrics bar                     │  id       │
│          │  totalMs · tokens · nodes ·      │  content  │
│          │  successful · failed · answer    │           │
└──────────┴──────────────────────────────────┴───────────┘
```

**Sidebar** (272 px): lists all loaded runs. Active run is highlighted with a blue left-edge indicator and accent background. Each row shows the run name, time, node count, and a red badge for any failed nodes.

**Toolbar**: Graph / Counterfactuals tab switcher. In Graph mode, a Scenario `<select>` lists available CFs plus "Original run". A `Counterfactual active` badge appears when a CF is selected.

**Legend**: seven role dots with labels, always visible above the canvas.

**Graph canvas**: expands to `contentWidth + 60px` × `max(contentHeight + 60px, 500px)`. Scrollable. Node layout formula: `x = 40 + layerIndex × 280`, `y = centred within 600px viewport + nodeIndex × 170`.

**Metrics bar**: always visible below the canvas. In CF mode, `+N ms` / `−N tokens` delta spans appear next to the values.

**Detail panel**: right-hand column. Empty state when no node is selected. When a node is selected, shows all node fields. In CF mode, if the node was overridden, shows an info banner plus the original node state for comparison.

**Error boundary**: if `render()` or any action handler throws, the `#app` div is replaced with a friendly error screen offering Reload and Reset & reload buttons. Your data in `localStorage` is preserved unless you choose Reset.

---

## Keyboard shortcuts

| Keys | Action |
|---|---|
| `⌘I` / `Ctrl+I` | Open Import dialog |
| `⌘E` / `Ctrl+E` | Export active run |
| `G` | Switch to Graph tab |
| `C` | Switch to Counterfactuals tab |
| `↑` | Previous run |
| `↓` | Next run |
| `←` | Previous node |
| `→` | Next node |
| `Esc` | Close modal · deselect node |

Shortcuts are suppressed when focus is inside an `<input>`, `<textarea>`, or `<select>`, and when a modal is open (except `Esc`).

---

## Architecture

### Module system

No ES modules, no bundler. Nine JavaScript files are loaded in dependency order via `<script>` tags. Each file is an immediately-evaluated `'use strict'` script that writes named functions and constants into the global scope. Each file may only reference names declared by files listed before it.

```
constants → utils → data → state → layout → adapters → render → events → main
```

### State machine

A single mutable `state` object lives in `state.js`. Every user action calls `setState(patch)`:

1. `Object.assign({}, state, patch)` produces a candidate.
2. `_normalizeState()` validates runs (filtering out any that fail `validateRunSchema`), sanitises `activeRunId`, `activeCounterfactual`, `selectedNodeId`, `activeTab`, and deep-clones everything.
3. `SafeStore.save(state)` serializes to JSON and writes to `localStorage` under key `agentflow.v1` — unless the JSON string exceeds 4 MB, in which case the save is silently skipped and the prior value is preserved.
4. `render()` rebuilds the entire `#app` innerHTML from string.

### Rendering

`render.js` uses a DOM string-builder pattern. Every call to `render()` produces a full HTML string and writes it to `document.getElementById('app').innerHTML`. There is no virtual DOM, no diffing, and no incremental updates. `render` is wrapped in `ErrorBoundary.wrap` so any rendering exception shows the error screen instead of a blank page.

Event delegation is installed once in `main.js` via `installDelegation()`. Clicks and change events bubble to `document`; the handler reads `data-action` and `data-change` attributes and dispatches to the named function in the `ACTIONS` map.

### DAG layout

`layoutNodes(nodes, edges)` runs Kahn's BFS:

1. Compute in-degrees and adjacency lists.
2. Collect all zero-in-degree nodes into layer 0.
3. Decrement in-degrees along outgoing edges; nodes that reach 0 enter the next layer.
4. Repeat until queue is empty.
5. Any node not yet visited (part of a cycle) is placed in its own single-node layer.

Position formula:
- `x = 40 + layerIndex × 280`
- `y = max(40, (600 − totalLayerHeight) / 2) + nodeIndexInLayer × 170`

### Adapter layer

`importFromThirdParty(obj)` is the public entry point. It calls `detectFormat(obj)` to identify the trace format (LangSmith → `run_type` string present; LangFuse → `observations` array present; Weave → `op_name` on root or first element), then delegates to the appropriate `fromLangSmith` / `fromLangFuse` / `fromWeave` function. Each adapter walks the trace tree, calls `inferRole(type, name)` for keyword-based role classification, calls `inferStatus(error)`, accumulates token counts, and calls `_buildRun(...)` to produce a validated-ready run object.

`truncate(obj, maxLen=300)` safely stringifies any value — including objects with circular references — before truncating.

---

## File structure

```
Agent-Flow/
├── index.html                    # Single HTML entry point; CSP meta; script tags
├── assets/
│   └── favicon.png               # App favicon (PNG); referenced by <link rel="icon">
├── css/
│   └── styles.css                # Full application stylesheet (~700 lines)
│                                 # Dark theme, glass morphism, CSS variables
├── js/
│   ├── constants.js              # SAFE_ID_RE, ICONS (SVG), ROLES, STATUSES
│   ├── utils.js                  # esc(), escAttr(), clampStr(), SafeStore, ErrorBoundary
│   ├── data.js                   # validateRunSchema() — schema + referential integrity
│   ├── state.js                  # State atom, setState(), getActiveRunView(),
│   │                             #   _normalizeState(), _materializeCounterfactualRun(),
│   │                             #   _buildRunView(), clone helpers
│   ├── layout.js                 # layoutNodes() — Kahn's BFS DAG layout
│   ├── adapters.js               # importFromThirdParty(), fromLangSmith/LangFuse/Weave(),
│   │                             #   detectFormat(), inferRole(), inferStatus(),
│   │                             #   safeId(), msDiff(), truncate()
│   ├── render.js                 # HTML string builders for every UI region
│   ├── events.js                 # DOM event delegation, action dispatch,
│   │                             #   import/export flows, keyboard shortcuts
│   └── main.js                   # Boot: ErrorBoundary.install(), installDelegation(), render()
├── tests/
│   ├── helpers/
│   │   └── loadContext.js        # vm sandbox factory — mocks browser globals for Node tests
│   ├── adapters.test.js          # 103 tests
│   ├── data-validation.test.js   # 52 tests
│   ├── layout.test.js            # 14 tests
│   ├── state.test.js             # 50 tests
│   └── utils.test.js             # 40 tests
├── docs/
│   ├── release-validation-2025-04-25.md   # Full v1.0 audit report
│   └── report-v0.2.0.md                   # v0.2.0 change report
├── CODEBASE_OVERVIEW.md          # Architecture reference and test documentation
├── SECURITY.md                   # Vulnerability disclosure policy
├── LICENSE                       # Proprietary — Visigence
├── package.json                  # Jest 29 dev dependency; npm test script
├── vercel.json                   # Security headers, cache control, SPA rewrites
└── .gitignore
```

---

## Script load order

```
constants.js
    └─▶ utils.js
            └─▶ data.js
                    └─▶ state.js
                            └─▶ layout.js
                                    └─▶ adapters.js
                                            └─▶ render.js
                                                    └─▶ events.js
                                                            └─▶ main.js
```

Each file may only use names introduced by files above it in this list. There are no circular dependencies.

---

## Security model

| Control | Implementation |
|---|---|
| HTML-entity escaping | `esc(str)` escapes `& < > " ' / ` =` before any DOM insertion. `escAttr(str)` converts every non-`\w-` character to a numeric entity for attribute values. |
| ID allow-list | `SAFE_ID_RE = /^[A-Za-z0-9_-]{1,80}$/` — all node, run, edge, and CF IDs are validated on import and sanitised in `safeId()` during adapter conversion. |
| Schema length caps | `validateRunSchema`: name ≤ 200, content ≤ 10 000, nodes ≤ 500, edges ≤ 2 000 |
| Referential integrity | Edges whose `from` or `to` reference a non-existent node ID are rejected at import time |
| Content Security Policy | `default-src 'none'` with `style-src 'self' 'unsafe-inline'` (required for inline node colour variables). Identical directives in both the `<meta>` tag and the `vercel.json` HTTP header. |
| Robots meta | `<meta name="robots" content="noindex, nofollow">` prevents search-engine indexing and link-following of the app. |
| localStorage cap | `SafeStore` serializes, checks `json.length > 4 MB`, and discards the write if over limit. The prior stored value is not overwritten. |
| Import file size cap | `events.js` rejects files larger than 2 MB before attempting to parse. |
| No eval, no Function() | No dynamic code execution anywhere in the codebase. |
| No credentials in source | No API keys, tokens, or secrets. |
| `style-src 'unsafe-inline'` | The only CSP relaxation. Required for inline `style` attributes on node cards (role-specific colours set via CSS variables at render time). Accepted and documented. |

HTTP security headers set by `vercel.json` on every response:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: no-referrer
Permissions-Policy: camera=(), microphone=(), geolocation=(), ...
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
Content-Security-Policy: (matches index.html meta)
```

Cache policy: `index.html` is served with `max-age=0, must-revalidate`. JS and CSS assets use `max-age=3600, must-revalidate` (not immutable, since filenames are not content-hashed).

---

## Running locally

No install step is needed to view the app:

```bash
# Python (built-in)
python3 -m http.server 8000

# Node (npx, no install)
npx serve .

# Any static server works
```

Open `http://localhost:8000`.

---

## Running tests

```bash
npm install   # installs Jest 29
npm test      # runs all 260 tests
npm test -- --verbose   # per-test output
```

Tests run in a Node.js `vm.createContext` sandbox that mocks `document`, `window`, `localStorage`, `location`, and `CSS`. DOM-dependent files (`render.js`, `events.js`, `main.js`) are excluded from unit test coverage; they require manual browser verification.

### Test suite breakdown

| Suite | Count | What it covers |
|---|---|---|
| `tests/utils.test.js` | 40 | `esc()`, `escAttr()`, `clampStr()`, `SafeStore` load/save/clear/quota |
| `tests/data-validation.test.js` | 52 | `validateRunSchema()` — happy path, root errors, node errors, edge errors, dangling-edge detection, CF errors |
| `tests/layout.test.js` | 14 | `layoutNodes()` — single node, linear chain, fan-out, fan-in, diamond, cycle, disconnected components, self-loop |
| `tests/state.test.js` | 50 | `setState`, `getActiveRunView`, `_normalizeState`, `_materializeCounterfactualRun`, `_buildRunView` (CF overrides, removed-node detection, partial-metrics fallback), clone helpers |
| `tests/adapters.test.js` | 103 | `safeId`, `msDiff`, `truncate` (including circular refs), `inferRole`, `inferStatus`, `detectFormat`, LangSmith/LangFuse/Weave adapters, error cases |
| **Total** | **260** | |

---

## Deployment

1. Push to GitHub.
2. Create a new Vercel project; point it at the repo.
3. Set framework preset to **Other**. Leave all build fields blank.
4. Deploy.

`vercel.json` handles all security headers, cache rules, and the SPA catch-all rewrite (`/` → `index.html`). No build step, no environment variables, no server-side code.

---

## Known limitations

| Behaviour | Impact | Notes |
|---|---|---|
| `localStorage` unavailable (private browsing, blocked by browser policy) | App boots to empty state; imports are not persisted across reloads | No crash; session still works |
| Import file limit is 2 MB | Trace files larger than 2 MB are rejected | Split large traces before importing |
| `localStorage` session cap is ~4 MB serialized | Very large graphs may not persist across reloads | In-session use is unaffected |
| Node positions are algorithm-only | No drag-to-reposition | Layout is reproducible and consistent |
| Status indicator dots are colour-only | May be ambiguous for protan/deuteran colour-blind users | Text label is always present beside the dot |
| No `aria-live` region for state changes | Screen readers are not notified when a run or CF is activated | User must navigate to updated content |
| `role="tab"` without `role="tablist"` on the container | Assistive technology may not expose the tab pattern correctly | Known; to be addressed post-v1.0 |
| `render.js`, `events.js`, `main.js` have no automated unit test coverage | DOM-dependent code is tested manually only | Manual verification checklist in `docs/release-validation-2025-04-25.md` |

---

## Status

**Pre-1.0. Not yet tagged.**

All known blockers from the release validation audit (`docs/release-validation-2025-04-25.md`) have been resolved. The `v1.0` tag will be pushed after manual browser verification is complete (XSS paste test, localStorage-disabled boot, 500-node render performance, accessibility pass).

Favicon (`assets/favicon.png`) and all security structures have been verified:

- `assets/favicon.png` is present and correctly referenced via `<link rel="icon">` in `index.html`.
- The CSP directive in the `<meta http-equiv="Content-Security-Policy">` tag is identical to the `Content-Security-Policy` HTTP header in `vercel.json`.
- All nine security HTTP headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`, `Cross-Origin-Embedder-Policy`, `Content-Security-Policy`) are set in `vercel.json`.
- All 260 unit tests pass (`npm test`).

**Vercel deployment is pending re-deployment.** The `vercel.json` configuration is in place and will take effect on the next deploy.

---

*Copyright © 2026 Visigence. All rights reserved.*
*Proprietary and confidential. See `LICENSE` for terms.*
*Security disclosures: see `SECURITY.md`.*
