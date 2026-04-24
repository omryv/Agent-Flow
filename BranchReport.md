Changes on this branch sec/ui/ux:


Security hardened

CSP: script-src 'self' — no more unsafe-inline for scripts. All inline handlers gone.
Added X-Content-Type-Options, Referrer-Policy, robots, CSP tightened across all directives.
Event delegation replaces every onclick/onchange attribute.
esc() now covers /, `, = too.
Global error boundary + window.onerror + unhandled rejection catcher.
All user input length-clamped before entering state.
File import validates extension + size before read, catches read errors.
Destructive ops confirmed; node-positions cleaned when deleting nodes.
rel="noopener" on download anchor.
Modal uses role="dialog" aria-modal="true"; interactive elements have role/tabindex.

Server-side reminders (I can't set via meta):

Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Content-Security-Policy as a response header (stronger than meta)
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()

Still veriyfing
Need to load the app and confirm:

No console CSP violations.
Click a run in sidebar → selects.
Click a node → detail panel updates.
Drag node header → node moves, edges follow, position persists across re-renders.
Reset Layout → positions clear.
New Run / Add Node / Edit Node / Delete Node / Delete Run → all work, all validate.
Import a .json → format detected badge appears; import completes.
Export → file downloads.
New Scenario → CF created; toggle from Counterfactuals tab; scenario dropdown works.
Esc closes modal; Delete removes selected node; outside click on backdrop closes modal.
