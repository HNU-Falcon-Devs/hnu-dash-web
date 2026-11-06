# Dependency security review — 2026-11-07

This review covers the Web Google OAuth foundation feature branch only.
No authentication code or Backend authorization policies were modified as
part of the dependency remediation.

## Changes

- Pinned `next` and `eslint-config-next` to `16.4.5`, matching the
  published Next.js security-fix release.
- Updated the lockfile with non-force npm remediation. Notable fixes:
  `sharp` `0.35.4 → 0.35.5` and `source-map-js` `1.2.1 → 1.2.2`.
  The lockfile also refreshes compatible transitive and development-tooling
  packages within their existing declared ranges.
- No Next.js 15 downgrade, `npm audit fix --force`, or unrelated
  application-code changes.

## Validation and residual findings

GitHub Actions ran under Node.js 24 using the updated lockfile:

| Check | Result |
| --- | --- |
| `npm ci` | Passed |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm test` | Passed — 35 tests, 13 files |
| `npm run build` | Passed |
| `npm audit --omit=dev` | **0 vulnerabilities** |
| `npm audit` | **8 moderate, 0 high, 0 critical** |

The eight remaining advisories are all in development-only
`eslint-config-next` / `typescript-eslint` / `@typescript-eslint/*`
dependencies and `minimatch`. The `minimatch` issue concerns denial of
service via glob-pattern amplification in tooling. npm's suggested
`fixAvailable` is `eslint-config-next@15.5.29`, a major downgrade
incompatible with the approved Next.js 16 direction.

Do not use `npm audit fix --force` or override incompatible transitive
versions merely to suppress the audit count. Track an upstream compatible
ESLint/TypeScript-ESLint fix and rerun both audits when it is released.
The development-tooling findings are not production dependencies according
to the `--omit=dev` audit, but still warrant review in CI and local builds.

[Executed audit and verification workflow](https://github.com/HNU-Falcon-Devs/hnu-dash-web/actions/runs/42253415268).
