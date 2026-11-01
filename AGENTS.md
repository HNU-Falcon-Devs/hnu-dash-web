# HNU DASH Web Agent Guidelines

- This repository is frontend-only. Read existing documentation and code before editing and preserve documented boundaries.
- Keep changes scoped to the request. Do not silently broaden requirements or invent backend contracts.
- Do not add Supabase migrations, PostgreSQL schemas, backend services, Edge Functions, or authoritative data and authorization logic here.
- Do not implement Flutter, offline collection, or QR scanning functionality here; mobile is maintained separately.
- The authentication provider is TBD. Do not choose or implement one without explicit direction.
- Never commit credentials, local environment files, production data, or secrets.
- Avoid speculative abstractions, unnecessary dependencies, and premature domain implementation.
- Preserve strict TypeScript and existing lint standards; do not weaken validation to make checks pass.
- Add or update meaningful tests whenever behavior changes.
- Before completion, run `npm ci`, lint, typecheck, tests, and the production build from the repository root.
- Use Conventional Commit messages.
- Stop and ask for clarification when a requirement would materially change architecture, security, data ownership, or user-visible scope.
