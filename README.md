# HNU DASH Web

HNU DASH is a planned event attendance system for Holy Name University, starting with a pilot for approximately 600 BSIT students. It aims to make organizing events, collecting attendance, and checking records easier for both organizers and students.

## How HNU DASH will work

1. Organization leaders prepare events and assign attendance staff through the Web app.
2. Assigned staff use the separate Mobile app to scan student IDs, including when offline.
3. The Backend checks uploaded scans and produces official attendance results.
4. Authorized organizers review records and corrections, while students view their own attendance.

**Status (2026-11-26):** Synthetic event management, online collection, prototype finalization and offline capture/reconciliation are implemented across the three repositories. Web M4.4 is merged and [post-merge CI](https://github.com/HNU-Falcon-Devs/hnu-dash-web/actions/runs/45547176906) passed 360 tests. Combined offline browser/RPC/database QA ([Backend #19](https://github.com/HNU-Falcon-Devs/hnu-dash-backend/issues/19)), physical-device QA, institutional approval, official attendance and student self-view remain separate gates.

## What this app is for

Web will provide the screens for administrators, organization leaders, attendance staff with review access, and students. It will not scan IDs or independently decide attendance.

- [HNU DASH Backend](https://github.com/HNU-Falcon-Devs/hnu-dash-backend) manages the trusted records, permissions, and attendance results.
- [HNU DASH Mobile](https://github.com/HNU-Falcon-Devs/hnu-dash-mobile) implements synthetic online and offline QR capture, encrypted queued evidence, explicit upload and Staff preparation completion. The current offline device workflow has not been physically accepted.

## Current status

**Implemented in Web:** Supabase SSR authentication with a Google OAuth entry point; organization listing/creation and administrator-only membership management; DRAFT event management; checkpoints; synthetic CSV validation, preview and confirmed atomic import; frozen-roster management; event-specific Staff assignment/revocation and confirmed DRAFT → OPEN activation. All privileged operations depend on Backend identity, authorization and RLS, not frontend role claims. UUID-based membership assignment is development-only and requires operator identity verification.

**Backend status:** Read-only checks on 2026-11-17 found the M2.1 Staff/activation and M2.3 online scan-ingestion migrations and expected RPC signatures in hosted `hnu-dash-dev`. Earlier warnings that these migrations might be missing are outdated. This does not establish hosted integration or production readiness.

**Historical bounded QA:** M2.6 Part B validated actual synthetic Web Server Actions and Backend authorization. [Mobile #7](https://github.com/HNU-Falcon-Devs/hnu-dash-mobile/issues/7#issuecomment-7110814051) subsequently accepted bounded synthetic online Android integration on its recorded revision; [Web #24](https://github.com/HNU-Falcon-Devs/hnu-dash-web/issues/24#issuecomment-7135489451) accepted the online browser/RPC lifecycle. The actual CSV picker/preview remains open ([Web #16](https://github.com/HNU-Falcon-Devs/hnu-dash-web/issues/16)); real Google OAuth has an owner-observed HNU happy path but remaining provider/negative-path acceptance ([Web #17](https://github.com/HNU-Falcon-Devs/hnu-dash-web/issues/17)). Device security gaps remain [Mobile #13](https://github.com/HNU-Falcon-Devs/hnu-dash-mobile/issues/13). None of these historical results establish current offline integration or pilot readiness.

Read the [historical M2.6 QA status](https://github.com/HNU-Falcon-Devs/hnu-dash-backend/blob/main/docs/qa/m2-6-integration-status.md) and linked issue adjudications for boundaries. Web does not scan IDs or determine official attendance. The organizer Operations route consumes Backend-owned synthetic finalization and offline reconciliation contracts; see [Web architecture](docs/architecture.md). [Backend #19](https://github.com/HNU-Falcon-Devs/hnu-dash-backend/issues/19) tracks new offline integration evidence; no real data, hosted deployment or institutional acceptance is implied.

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
