# AgentFlow

**Read-only counterfactual inspector for LLM agent execution traces.**

Import a trace from LangSmith, LangFuse, or W&B Weave. View it as an interactive directed acyclic graph. Inspect the counterfactuals embedded in the trace to see how the agent's metrics and final answer would change under different node states.

Zero build step. Zero runtime dependencies. One HTML file, eight JavaScript modules, one stylesheet. Ship it with a static file server.

---

## What it does today

**Trace import.** Drop in a `.agentflow.json` file or a raw trace export from LangSmith, LangFuse, or W&B Weave. The adapter layer auto-detects the format, validates the structure, and produces a native run object. Maximum file size is 2 MB.

**Graph rendering.** Every imported node is rendered as a color-coded card — Input, Retrieve, Plan, Tool, Synthesize, Validate, Output — connected by dependency edges and laid out automatically via Kahn's BFS topological sort. Layout is deterministic; the same input produces the same coordinates.

**Counterfactual viewing.** A run can carry a `counterfactuals[]` array. Each counterfactual specifies node-level overrides plus optional replacement metrics and final answer. Activating a counterfactual renders the merged view: the original run's structure with the overrides applied. The original run is never mutated.

**Run export.** The active run can be exported as a `.agentflow.json` file containing the run plus all its counterfactuals.

**Run navigation.** Multiple imported runs can coexist. Switch between runs via the sidebar or the arrow keys.

---

## What it does NOT do (deliberate scope decisions for this version)

- **No node creation, editing, or deletion.** AgentFlow is read-only on imported data. The trace you import is the trace you inspect.
- **No interactive counterfactual authoring.** Counterfactuals come from the imported file. Authoring counterfactuals interactively in the UI is out of scope.
- **No drag-to-reposition.** Node positions come from the layout algorithm only.
- **No command palette.**
- **No sample data on first load.** The empty state prompts the user to import a file.
- **No live streaming.** Imports are static files, not live agent runs.

These are scope decisions, not missing features.

---

## Architecture

A pure static site. No framework, no bundler, no package manager runtime dependencies. Eight JavaScript files loaded in dependency order via script tags: constants → utils → data → state → layout → adapters → render → events → main

Each file depends only on symbols defined by files loaded before it.

State flows in one direction. A user action calls a handler, which calls `setState`, which normalizes and validates, persists to `localStorage`, and triggers a full DOM rebuild from HTML-string builders. No virtual DOM, no diffing.

Counterfactual application is a read-time computation. `_materializeCounterfactualRun` merges overrides onto a fresh copy of the base run to produce a view object. The base run is never modified.

---

## Security

Content-Security-Policy is set in both `<meta>` (in `index.html`) and HTTP headers (via `vercel.json`).

All user-derived strings are HTML-entity escaped before DOM insertion via `esc()` (text content) and `escAttr()` (attribute values).

All identifiers in imported runs and counterfactuals are validated against `SAFE_ID_RE = /^[A-Za-z0-9_-]{1,80}$/`.

Schema length caps in `validateRunSchema`: name ≤ 200, content ≤ 10 000, nodes ≤ 500, edges ≤ 2 000.

`SafeStore` serializes to JSON, then discards the result if it exceeds 4 MB; the prior `localStorage` value is preserved.

---
```

Agent-Flow/
├── index.html              # Single HTML entry point
├── css/
│   └── styles.css          # Application stylesheet
├── js/
│   ├── constants.js        # ICONS, ROLES, STATUSES, SAFE_ID_RE
│   ├── utils.js            # esc, escAttr, clampStr, SafeStore, ErrorBoundary
│   ├── data.js             # validateRunSchema
│   ├── state.js            # State atom, setState, getActiveRunView,
│   │                       #   _materializeCounterfactualRun, _buildRunView
│   ├── layout.js           # layoutNodes (Kahn's BFS DAG layout)
│   ├── adapters.js         # importFromThirdParty, fromLangSmith,
│   │                       #   fromLangFuse, fromWeave, detectFormat
│   ├── render.js           # HTML string builders for every UI region
│   ├── events.js           # Action dispatch, import/export, key bindings
│   └── main.js             # Boot
├── tests/
│   ├── helpers/loadContext.js
│   ├── adapters.test.js
│   ├── data-validation.test.js
│   ├── layout.test.js
│   ├── state.test.js
│   └── utils.test.js
├── package.json
├── vercel.json
└── README.md

```

## Tests

255 tests pass, 0 skipped, 0 failed (Jest 29, Node test environment). Source files except DOM-dependent ones (`render.js`, `events.js`, `main.js`) are loaded into a `vm.createContext` sandbox that mocks browser globals.

Per-suite breakdown:

| Suite | Tests |
|---|---|
| `tests/utils.test.js` | 40 |
| `tests/data-validation.test.js` | 52 |
| `tests/layout.test.js` | 14 |
| `tests/state.test.js` | 50 |
| `tests/adapters.test.js` | 99 |
| **Total** | **255** |

> The validator's audit found per-suite counts in earlier docs were inaccurate. The numbers above represent the verified post-A-block state. Run `npm test -- --verbose` to confirm exact per-suite counts.

---

## Running locally

```bash
python3 -m http.server 8000
# or
npx serve .
```

No install step.

---

## Running tests

```bash
npm install
npm test
```

---

## Deployment

Push to GitHub. Point Vercel at the repo with framework preset set to "Other" and every build field left blank. The included `vercel.json` handles security headers, cache control, and SPA rewrites.

> See `docs/release-validation-2025-04-25.md` for details.

---


## Status

Pre-1.0. Not yet tagged. Outstanding work tracked in `docs/release-validation-2025-04-25.md`.

---

*Built by Visigence.*
*Proprietary. See `LICENSE` for terms.*
