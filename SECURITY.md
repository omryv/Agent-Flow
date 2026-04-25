# Security Policy

## Supported Versions

Only the latest commit on the `main` branch is actively supported.

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

To report a security vulnerability responsibly:

1. **GitHub Security Advisories (preferred):** Use the
   [Report a vulnerability](../../security/advisories/new) button on this
   repository's Security tab. GitHub will create a private advisory visible
   only to you and the maintainers.

2. **Email:** Send a description of the vulnerability to
   **security@visigence.com**. Encrypt sensitive details with our PGP key
   (available on request).

### What to include

- A description of the vulnerability and its potential impact.
- Step-by-step reproduction instructions (or a minimal proof-of-concept).
- The affected file(s) and line numbers if known.
- Your suggested fix or mitigation (optional but appreciated).

### Response timeline

| Action | Target |
|---|---|
| Acknowledgement | Within 2 business days |
| Initial assessment | Within 5 business days |
| Patch / remediation plan | Within 30 days for critical/high severity |

We will credit researchers who responsibly disclose valid vulnerabilities in
the release notes unless anonymity is requested.

## Out of Scope

- Vulnerabilities in dependencies (report upstream; we will update our
  dependency if a fix is available).
- Issues that require physical access to a user's device.
- Social engineering attacks.
- Rate limiting or denial-of-service against the static file host (report to
  the hosting provider).
