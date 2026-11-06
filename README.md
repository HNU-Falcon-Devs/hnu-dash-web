# HNU DASH Web

HNU DASH is a planned event attendance system for Holy Name University, starting with a pilot for approximately 600 BSIT students. It aims to make organizing events, collecting attendance, and checking records easier for both organizers and students.

## How HNU DASH will work

1. Organization leaders prepare events and assign attendance staff through the Web app.
2. Assigned staff use the separate Mobile app to scan student IDs, including when offline.
3. The Backend checks uploaded scans and produces official attendance results.
4. Authorized organizers review records and corrections, while students view their own attendance.

**These are planned workflows, not features currently available.**

## What this app is for

Web will provide the screens for administrators, organization leaders, attendance staff with review access, and students. It will not scan IDs or independently decide attendance.

- [HNU DASH Backend](https://github.com/HNU-Falcon-Devs/hnu-dash-backend) manages the trusted records, permissions, and attendance results.
- [HNU DASH Mobile](https://github.com/HNU-Falcon-Devs/hnu-dash-mobile) handles on-site scanning and offline collection.

## Current status

**Google OAuth authentication foundation is implemented, pending hosted-provider configuration and live verification.** The responsive shell, themes, tests, and build checks remain. Event management and attendance workflows are not implemented. Backend Milestone 1 is the approved integration baseline.

## Developer setup

Requires Node.js 24 and npm compatible with the committed lockfile. Run from the repository root:

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

Authentication requires public Supabase project configuration in a local ignored `.env.local` file. See [Google OAuth setup](docs/authentication.md). No service-role keys or Google client secrets belong in browser variables.
