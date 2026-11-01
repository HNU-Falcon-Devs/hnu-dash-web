# Contributing to HNU DASH Web

## Scope

Keep contributions within the Next.js frontend boundary. Do not add backend schemas, Supabase migrations, authoritative authorization logic, mobile/QR scanning functionality, or invented backend contracts. Authentication provider selection and backend integration remain deferred.

## Setup

Use Node.js 24 and run commands from the repository root:

```bash
npm ci
npm run dev
```

## Development workflow

1. Read `README.md`, `docs/architecture.md`, and `AGENTS.md`.
2. Keep changes focused and avoid speculative abstractions or dependencies.
3. Add or update meaningful tests whenever behavior changes.
4. Never commit credentials, environment files, production data, build output, or generated caches.
5. Stop for clarification when a change would materially affect architecture, security, data ownership, or user-visible scope.

Before committing or opening a pull request, run:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Review `git status` and the complete diff. Use Conventional Commit messages with clear, imperative descriptions.
