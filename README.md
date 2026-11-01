# HNU DASH Web

This repository contains the Next.js frontend for HNU DASH. It is currently in a UI foundation phase: the responsive application shell, theme system, design tokens, reusable UI primitives, and frontend validation are established without simulating production behavior.

## Repository boundary

- **Web (this repository):** Next.js management and student-facing user interfaces.
- **Backend (separate repository):** the authoritative Supabase/PostgreSQL implementation and future API contract.
- **Mobile (separate repository):** the Flutter application responsible for QR attendance collection.

QR scanning does not occur in the web application. Backend integration and domain workflows are deferred. The authentication provider is **TBD**.

## Requirements

- Node.js 24
- npm compatible with the committed lockfile

## Development

Run all commands from the repository root:

```bash
npm ci
npm run dev
```

Open <http://localhost:3000>.

## Validation

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

No backend credentials or hosted services are required for this frontend foundation.
