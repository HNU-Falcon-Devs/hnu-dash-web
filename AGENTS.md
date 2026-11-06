# HNU DASH Web Agent Guidelines

- WhiteTree Orchestrator owns cross-repository architectural decisions. Web Maintainer coordinates frontend scope, assignments, and reviews. Codex implements only authorized changes in this repository; the human owner gives final PR merge approval.
- Inspect the repository identity, current branch, worktree, and existing changes before editing. Preserve unrelated work.
- This repository is frontend-only. Read existing documentation and code before editing and preserve documented boundaries.
- Keep changes scoped to the request. Do not silently broaden requirements or invent backend contracts.
- Do not add Supabase migrations, PostgreSQL schemas, backend services, Edge Functions, or authoritative data and authorization logic here.
- Do not implement Flutter, offline collection, or QR scanning functionality here; mobile is maintained separately.
- Google OAuth for verified @hnu.edu.ph Google Workspace accounts is approved by the WhiteTree Orchestrator. Use Supabase Auth sessions and the Backend's authoritative identity/permission controls; do not implement an alternate provider or independent authorization.
- Never commit credentials, local environment files, production data, or secrets.
- Avoid speculative abstractions, unnecessary dependencies, and premature domain implementation.
- Preserve strict TypeScript and existing lint standards; do not weaken validation to make checks pass.
- Add or update meaningful tests whenever behavior changes.
- Before completion, run `npm ci`, lint, typecheck, tests, and the production build from the repository root.
- Inspect the full diff independently and report which validation actually ran and its result.
- Use Conventional Commits with logical separation. Keep PRs to coherent milestones, preserve meaningful commit history where appropriate, and observe the established 50-commit ceiling without padding commit counts or defaulting to squash.
- Route every change to protected `main` through a PR. Preserve mandatory CI, review protections, and sole CODEOWNER `Syris-EkzD`; never merge PRs, push directly to `main`, or change governance without authorization.
- Escalate decisions affecting architecture, security, authorization, data ownership, cross-repository contracts, or user-visible scope.
