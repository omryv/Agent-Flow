# AgentFlow — Counterfactual Trace Engine

Visualise, inspect, and counterfactually analyse LLM agent execution traces.
Import native `.agentflow.json` files or raw exports from **LangSmith**,
**LangFuse**, and **W&B Weave**.

## Project layout

```
agentflow/
├── index.html
├── css/
│   └── styles.css
└── js/
    ├── constants.js   — ROLES, STATUSES, ICONS, SAFE_ID_RE
    ├── utils.js       — esc()
    ├── data.js        — makeSampleData(), validateRunSchema()
    ├── state.js       — state, setState(), getActiveRunView()
    ├── layout.js      — layoutNodes()
    ├── adapters.js    — LangSmith / LangFuse / Weave importers
    ├── drag.js        — drag-and-drop, getPositionsForRun(), makeEdgePath()
    ├── render.js      — all build*() functions
    ├── events.js      — handlers, modal system, dialogs
    └── main.js        — boot + window.* exports
```

## Running locally

No build step required — open `index.html` directly in a browser, or:

```bash
# any static server works
npx serve .
# or
python3 -m http.server 3000
```

## Deploying to Vercel

```bash
npm i -g vercel
vercel        # follow prompts — framework: Other, output: ./
```

Or connect the repo in the Vercel dashboard; it will detect the
`vercel.json` and deploy automatically on every push to `main`.

## Importing traces

| Source | How to export |
|---|---|
| **AgentFlow native** | Export button → `.agentflow.json` |
| **LangSmith** | Run detail → `···` menu → *Download as JSON* |
| **LangFuse** | Trace detail → *Export* → JSON |
| **W&B Weave** | `weave.Call.export()` or Weave UI → *Download* |

Then click **Import** in the toolbar and select the file.

## Keyboard shortcuts

| Key | Action |
|---|---|
| `Escape` | Close modal |
| `Delete` / `Backspace` | Delete selected node (when no input focused) |

## License

MIT