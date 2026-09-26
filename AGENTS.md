# HNU DASH Agent Guidelines

- Read the existing documentation and code before editing; preserve documented architectural boundaries.
- Keep changes scoped to the request. Do not silently broaden requirements.
- The project is web-first until explicitly instructed otherwise. Do not create Flutter code or `apps/mobile` yet.
- Supabase/PostgreSQL is authoritative. Mobile and web clients are not sources of truth.
- Client-side authorization is not a security boundary; enforce authorization in the backend.
- HNU MIS may prove identity in production, but never store or proxy MIS passwords.
- Never commit credentials, local environment files, production data, or secrets.
- Avoid speculative abstractions, unnecessary dependencies, and premature domain implementation.
- Preserve strict TypeScript settings. Do not weaken compiler or lint rules to make checks pass.
- Add or update meaningful tests whenever behavior changes.
- Before completion, run lint, typecheck, tests, and the production build from `apps/web`.
- Use Conventional Commit messages.
- Stop and ask for clarification when a requirement would materially change architecture, security, data ownership, or user-visible behavior.
