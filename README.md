# HNU DASH

HNU DASH is a planned QR-based university event attendance management system for Holy Name University. This repository currently contains only the initial web foundation; attendance and identity features have not been implemented.

## Current scope

Development is web-first. The Next.js application is the future management and control interface for events, organizations, access control, attendance review, corrections, finalization, and student attendance viewing.

Supabase/PostgreSQL will be the authoritative backend. A Flutter scanner application is planned for a later phase, but `apps/mobile` does not exist yet and no mobile functionality is included in this foundation.

## Planned architecture

- **Next.js web application:** management and control interface.
- **Supabase/PostgreSQL:** authoritative data, authorization, validation, reconciliation, and lifecycle enforcement.
- **Future Flutter application:** offline collection of physical HNU ID scans using temporary SQLite storage, followed by synchronization to the server. It will not be authoritative.
- **Future HNU MIS integration:** production identity proof only. HNU DASH must never store or proxy MIS passwords; application authorization remains within HNU DASH/Supabase.

See [docs/architecture.md](docs/architecture.md) for the system boundaries.

## Repository structure

```text
.
├── .github/workflows/ci.yml
├── apps/
│   └── web/                 # Next.js management application
├── docs/architecture.md
├── supabase/README.md       # Backend placeholder and local-development notes
├── AGENTS.md
├── CONTRIBUTING.md
└── README.md
```

## Prerequisites

- Node.js 24 LTS
- npm 11 or a version compatible with the included lockfile

No Supabase credentials or hosted project are required for the current foundation.

## Local development

```bash
cd apps/web
npm ci
npm run dev
```

Open <http://localhost:3000>.

## Validation

Run these commands from `apps/web`:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Contribution guidance is in [CONTRIBUTING.md](CONTRIBUTING.md).

## Deferred work

Database schemas, authentication, authorization roles, organizations, event workflows, scanning, reconciliation, dashboards, clearance mode, and the Flutter mobile application are intentionally deferred to later tasks.
