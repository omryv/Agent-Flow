
# AgentFlow

[![Live](https://img.shields.io/badge/live-visigence.app-00e5ff?style=flat)](https://visigence.app)
[![Security Headers: A+](https://img.shields.io/badge/Security%20Headers-A%2B-brightgreen?style=flat)](https://securityheaders.com/?q=agentflow.garden&followRedirects=on)
[![Tests](https://img.shields.io/badge/tests-260%20passing-brightgreen?style=flat)](https://github.com/VisigenceStudio/Agent-Flow/actions/workflows/test.yml)


A read-only counterfactual inspector for LLM agent execution traces.

Imports from LangSmith, LangFuse, W&B Weave, or native `.agentflow.json` files.
Renders agent execution as an interactive DAG. Toggle between the original run
and embedded counterfactual scenarios to see exactly which nodes changed, how
metrics shifted, and what the final answer would have been — entirely offline,
zero backend, nothing sent over the network.

---

## What It Does

Load a trace → see the full decision graph → ask "what if this node had succeeded?"
→ watch the counterfactual materialize in place alongside a live diff of every
affected node and the final output delta.

- 7 platform adapters (LangSmith, LangFuse, W&B Weave + 4 native variants)
- Interactive DAG with counterfactual overlay
- Metrics bar: total time, tokens, node count, success rate — with deltas
- Detail panel: per-node inspection, content, status, duration
- All computation runs in the browser. API keys parsed locally, never transmitted.

---

## Architecture

Strict dependency hierarchy. Each module may only reference names introduced
by files above it in the chain. No circular dependencies.

```text
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

---

## Security

All headers enforced at the edge via `vercel.json`. No server-side runtime.

| Header | Value |
|---|---|
| `Content-Security-Policy` | `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `Cross-Origin-Embedder-Policy` | `require-corp` |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Cross-Origin-Resource-Policy` | `same-origin` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `no-referrer` |
| `X-Content-Type-Options` | `nosniff` |
| `Permissions-Policy` | all APIs denied |

SecurityHeaders grade: **A+ (135/100)**

---

## Release Status

| Check | Status |
|---|---|
| Static deployment validation | ✅ |
| Security-header validation | ✅ |
| Canonical redirect checks | ✅ |
| TLS certificate (apex + www) | ✅ |
| Bundle secret scan | ✅ Clean |
| Internal source files return 404 | ✅ |
| CSP meta matches deployed HTTP header | ✅ |

---

## Test Suite

260 unit tests covering adapter functions, trace ingestion, layout calculations,
state transitions, and schema validation.

```bash
npm test
# ✓ 260 tests passing
```

---

## Stack

- Vanilla JS — no framework, no bundler, no build step
- Single `public/` directory served as static files
- Deployed on Vercel with hardened headers
- Favicon: SVG, no PNG assets in repository

---

<p align="center">
  <sub>
    Copyright © 2026 <b>Omry Damari — Visigence Studio</b>. All rights reserved.<br>
    Proprietary and confidential. See <a href="./LICENSE">LICENSE</a> for terms.<br>
    Security disclosures: <a href="./SECURITY.md">SECURITY.md</a>
  </sub>
</p>
EOF

git add README.md
git commit -m "docs: rewrite README, remove image refs, update to v1.2.0 state"
git push
