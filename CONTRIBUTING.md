# Contributing to HNU DASH

## Setup

Use Node.js 24 LTS and npm. Install the locked web dependencies from the repository root:

```bash
cd apps/web
npm ci
```

Start the local development server with `npm run dev`.

## Development workflow

1. Read `README.md`, `docs/architecture.md`, and `AGENTS.md` before making architectural changes.
2. Keep each change focused and avoid speculative abstractions or dependencies.
3. Add or update tests when behavior changes.
4. Never commit credentials, local environment files, build output, or generated caches.
5. Do not add mobile or attendance-domain implementation until a task explicitly calls for it.

## Required validation

Before committing or opening a pull request, run these commands from `apps/web`:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

All commands must pass. Review `git status` and the complete diff before committing.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/) with a clear, imperative description, for example:

```text
feat: add event creation form
fix: reject duplicate attendance submissions
docs: clarify local Supabase setup
```
