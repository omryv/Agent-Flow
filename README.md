# AgentFlow

**Counterfactual trace engine for LLM agent executions.**
Visualise, inspect, and replay agent runs as interactive DAGs. Import traces from LangSmith, LangFuse, or W&B Weave. Ask *"what if this node had failed?"* and see the answer change.

Zero build step. Zero dependencies. One `index.html`, ten JS modules, one CSS file.

---

## What it does

- **Graph view** — every agent step rendered as a coloured node (Input, Retrieve, Plan, Tool, Synthesize, Validate, Output) connected by DAG edges
- **Drag-to-reposition** — auto-layout on first render, then drag any node; positions persist in state
- **Counterfactual scenarios** — override any node's status + content, see how metrics and the final answer change
- **Third-party import** — drop in raw JSON from LangSmith / LangFuse / W&B Weave; auto-detects format and converts
- **Native format** — export and re-import `.agentflow.json` runs
- **Metrics bar** — total time, tokens, node counts, success/fail breakdown with counterfactual deltas
- **Inspector panel** — click a node to see full content, original-vs-counterfactual diff, edit, or delete

---

## Architecture

```
AgentFlow/
├── index.html           ← script + style tags, nothing else
├── css/
│   └── styles.css       ← all visual styling
├── js/
│   ├── constants.js     ← ROLES, STATUSES, ICONS, SAFE_ID_RE
│   ├── utils.js         ← esc() for HTML escaping
│   ├── data.js          ← makeSampleData(), validateRunSchema()
│   ├── state.js         ← state, setState(), getActiveRunView()
│   ├── layout.js        ← Kahn's-algorithm DAG layout
│   ├── adapters.js      ← LangSmith / LangFuse / Weave → native
│   ├── drag.js          ← drag, getPositionsForRun(), makeEdgePath()
│   ├── render.js        ← all build*() HTML-string functions
│   ├── events.js        ← handlers, modal system, dialogs
│   └── main.js          ← boot + window.* exports for inline onclicks
├── .gitignore
├── vercel.json          ← security headers, cache rules, SPA rewrite
└── README.md
```

### Load order matters

Script tags in `index.html` are ordered by dependency. `constants` has none, `utils` none, `data` needs `constants`, `state` needs `data`, `render` needs everything above it, `main` is the boot trigger.

### State flow

```
user action → handler in events.js
           → setState({...})          (state.js)
           → render()                  (render.js)
           → buildHTML() string       → #app innerHTML
           → attachEvents()            (events.js)
```

One top-level render. No diffing. Every state change rebuilds the DOM. Acceptable because the graph is small (<500 nodes) and renders in <5ms.

### Why drag is special

Dragging does **not** go through `setState` during the motion — that would trigger a full re-render per mousemove. Instead `drag.js` mutates node wrapper `style.left`/`top` and SVG path `d` attributes directly for 60fps feel. Only on `mouseup` does it commit the final position to state and trigger one render.

---

## Development journey

This repo started as a single 1000-line `index.html` with inline `<style>` and `<script>`. Here's how it became production-ready.

### Phase 1 — File split

Extracted `<style>` into `css/styles.css` and the monolithic `<script>` into ten topic-based JS modules. Kept the global-function architecture (no ES modules, no bundler) so the site remains a pure static deploy with zero tooling.

### Phase 2 — Third-party adapters

Added `adapters.js` with format detection and three converters:

| Source | Detection signal | Shape |
|---|---|---|
| LangSmith | `run_type` field | Recursive `child_runs` tree |
| LangFuse | `observations[]` array | Flat list with `parentObservationId` |
| W&B Weave | `op_name` field | Nested `children` or flat with `parent_id` |

Each adapter infers the `role` field from the operation name (`llm` → synthesize, `retriever` → retrieve, etc.), extracts token usage from the format-specific location, and produces a validated `.agentflow.json` run.

### Phase 3 — Drag and drop

Added `drag.js`. Key design decision: the active run view calls `getPositionsForRun()` instead of `layoutNodes()` directly — stored drag positions override the auto-layout. A Reset Layout button wipes the overrides for the active run, falling back to auto-layout.

Live DOM updates during drag (no re-render); single `setState` commit on mouseup. Uses `data-node-id` / `data-edge-id` attributes so the live updater can find elements without querying state.

### Phase 4 — Deployment

Added `vercel.json` with:
- Strict security headers (CSP, X-Frame-Options, Permissions-Policy)
- Long-cache for `/js/*.js` and `/css/*.css` (immutable)
- No-cache for `index.html` (ensures fresh script tags after deploy)
- SPA rewrite rule that excludes static asset paths

### Phase 5 — Debug loop

Deploying exposed bugs that only showed as a black screen. Added a temporary `window.onerror` handler to paint errors directly on the page, since Vercel Codespace workflows make F12 inconvenient. One by one, fixed:

| Symptom | Cause | Fix |
|---|---|---|
| `ReferenceError: initDrag` | `drag.js` not committed | Added file |
| `state.runs` undefined | `makeSampleData()` missing `return` | Completed function |
| `ReferenceError: esc` | `utils.js` not committed | Added file |
| `layoutNodes` not a function | `layout.js` was a stub (74 B) | Filled in Kahn's BFS |

Each error proved the value of the global-function architecture: the stack trace pointed to exactly one file, and fixing it required no rebuild or reinstall.

### Phase 6 — Cleanup

Removed the debug `window.onerror` block. Final `index.html` is 15 lines.

---

## Running locally

```bash
# any static server works
python3 -m http.server 8000
# or
npx serve .
```

No `npm install`. No build.

---

## Deploying

Push to GitHub, then on **vercel.com/new**:

| Setting | Value |
|---|---|
| Framework Preset | **Other** |
| Root Directory | `./` |
| Build / Install / Output | *(all blank)* |

`vercel.json` handles the rest.

---

## Importing traces

| Source | How to export |
|---|---|
| **LangSmith** | Run detail → ⋯ menu → *Download as JSON* |
| **LangFuse** | Trace detail → *Export* → JSON |
| **W&B Weave** | `weave.Call.export()` or Weave UI download |
| **AgentFlow native** | Export button in the toolbar |

Import button accepts any of the above; the format is auto-detected.

---

## Keyboard shortcuts

| Key | Action |
|---|---|
| `Esc` | Close modal |
| `Delete` / `Backspace` | Delete selected node |

---

## License

MIT
