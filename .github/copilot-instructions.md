# Copilot CI Gate Instructions

Use these CI gates as the canonical quality policy for this repository.
For any code change discussion, include which gate(s) are impacted and what evidence is needed to pass.

## Required CI Gates (Primary)

- ENG-01 Production Build: `npm run build` must exit 0.
- ENG-08 Playwright E2E: critical journeys across Chromium, Firefox, WebKit.
- ENG-09 Internal Links: zero internal 404s in link crawl.
- ENG-10 Lighthouse CI: Perf >= 85, A11y >= 95, Best Practices >= 90.
- ENG-14 Security Audit: zero high/critical vulnerabilities in CI gate.

## Planned / Supplemental Gates

- ENG-03 MDX + Import Integrity.
- A11Y-CHECK Accessibility Smoke.
- DEPENDABOT dependency update automation.
- ENG-12 i18n Build Verification placeholder (activate when non-English locales are enabled).

## Copilot Response Requirements

When proposing or reviewing changes:

1. Identify impacted gates by ID.
2. State likely pass/fail risk for each impacted gate.
3. Provide concrete commands/tests to validate locally.
4. Flag missing CI workflow files under `.github/workflows/` when relevant.
5. If a gate cannot be validated locally, explicitly mark it as CI-only.

## Branch Protection Alignment

Treat required checks as merge blockers until green.
If a required gate is missing or not wired in GitHub Actions, call it out as a release-readiness gap.
