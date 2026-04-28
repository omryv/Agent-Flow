# AgentFlow

**Read-only counterfactual inspector for LLM agent execution traces.**

Import a trace exported from LangSmith, LangFuse, or W&B Weave — or a native `.agentflow.json` file. AgentFlow renders the execution as an interactive directed acyclic graph, lets you flip between the original run and any embedded counterfactual scenarios, and shows you exactly which nodes changed, how the metrics shifted, and what the final answer would have been.

Zero build step. Zero runtime dependencies. One HTML file, eight JavaScript modules, one stylesheet.



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
## Status


All known release blockers have been resolved. The application has passed static deployment validation, security-header validation, canonical redirect checks, TLS verification, and bundle secret scanning.

Verified:

- `assets/favicon.png` is present and correctly referenced via `<link rel="icon">` in `index.html`.
- The CSP directive in the `<meta http-equiv="Content-Security-Policy">` tag matches the deployed `Content-Security-Policy` HTTP header.
- SecurityHeaders reports an **A+** grade for `https://www.trace.observer/`.
- HTTPS canonicalization is working:
  - apex redirects to `https://www.trace.observer/`
  - `/js/main.js` preserves path on redirect
  - final canonical responses return `200`
- TLS certificate validation succeeds for both apex and `www` hostnames.
- Internal project/source files are not publicly exposed and return `404`.
- Static bundle secret scan found no API keys, secrets, passwords, bearer tokens, or authorization credentials. Matches are limited to non-sensitive token-count fields such as `token_usage`.
- All required security HTTP headers are present:
  - `Content-Security-Policy`
  - `Permissions-Policy`
  - `Referrer-Policy`
  - `Strict-Transport-Security`
  - `X-Content-Type-Options`
  - `X-Frame-Options`
  - `Cross-Origin-Opener-Policy`
  - `Cross-Origin-Resource-Policy`
  - `Cross-Origin-Embedder-Policy`
- All 260 unit tests pass (`npm test`).


---


*Copyright © 2026 Visigence. All rights reserved.*
*Proprietary and confidential. See `LICENSE` for terms.*
*Security disclosures: see `SECURITY.md`.*
