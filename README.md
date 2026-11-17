# HNU DASH Web

HNU DASH is a planned event attendance system for Holy Name University, starting with a pilot for approximately 600 BSIT students. It aims to make organizing events, collecting attendance, and checking records easier for both organizers and students.

## How HNU DASH will work

1. Organization leaders prepare events and assign attendance staff through the Web app.
2. Assigned staff use the separate Mobile app to scan student IDs, including when offline.
3. The Backend checks uploaded scans and produces official attendance results.
4. Authorized organizers review records and corrections, while students view their own attendance.

**Status:** Event management and development-only online scan capture are implemented across the three repositories. Offline synchronization, official attendance calculation, and student self-view remain planned.

## What this app is for

Web will provide the screens for administrators, organization leaders, attendance staff with review access, and students. It will not scan IDs or independently decide attendance.

- [HNU DASH Backend](https://github.com/HNU-Falcon-Devs/hnu-dash-backend) manages the trusted records, permissions, and attendance results.
- [HNU DASH Mobile](https://github.com/HNU-Falcon-Devs/hnu-dash-mobile) implements synthetic-data online QR capture; offline collection/sync is future work.

## Current status

**Implemented in Web:** Supabase SSR authentication with a Google OAuth entry point; organization listing/creation and administrator-only membership management; DRAFT event management; checkpoints; synthetic CSV validation, preview and confirmed atomic import; frozen-roster management; event-specific Staff assignment/revocation and confirmed DRAFT → OPEN activation. All privileged operations depend on Backend identity, authorization and RLS, not frontend role claims. UUID-based membership assignment is development-only and requires operator identity verification.

**Backend status:** Read-only checks on 2026-11-17 found the M2.1 Staff/activation and M2.3 online scan-ingestion migrations and expected RPC signatures in hosted `hnu-dash-dev`. Earlier warnings that these migrations might be missing are outdated. This does not establish hosted integration or production readiness.

**M2.6 independent QA:** Isolated synthetic Web–Backend testing exercised real Web Server Actions for organization/event/checkpoint creation, roster freeze, Staff assignment, activation, membership creation/role/status changes, CSV import confirmation, and repeated-activation error handling. Backend authorization, scope, scan receipts, revocation, concurrency and replay checks also passed. **Part B is conditionally accepted for the tested online scope**, not full application or pilot acceptance. The actual browser CSV file picker and preview remain unverified ([Web #16](https://github.com/HNU-Falcon-Devs/hnu-dash-web/issues/16)); Google OAuth through the real provider also remains unverified ([Web #17](https://github.com/HNU-Falcon-Devs/hnu-dash-web/issues/17)). The actual Flutter app has not completed independent Mobile–Backend device QA ([Mobile #7](https://github.com/HNU-Falcon-Devs/hnu-dash-mobile/issues/7)).

Read the [canonical M2.6 QA status](https://github.com/HNU-Falcon-Devs/hnu-dash-backend/blob/main/docs/qa/m2-6-integration-status.md) for covered boundaries and remaining acceptance checks (the new report is introduced by a separate Backend documentation PR). Web does not scan IDs or determine official attendance. Offline sync, finalized attendance and student self-view are not implemented.

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
