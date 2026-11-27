# Web Repository Architecture

## Purpose

This repository owns only the HNU DASH Next.js frontend. The frontend implements synthetic development workflows for Google OAuth, organization and membership management, events and checkpoints, roster import and freezing, Staff assignment, activation, organizer coverage, prototype finalization and offline reconciliation. Official attendance publication and student self-view remain deferred pending approved Backend contracts.

## Boundaries

```text
HNU DASH Web  -> consumes approved Backend contracts
HNU Backend  -> separate authoritative Supabase/PostgreSQL project
HNU Mobile   -> separate Flutter attendance-collection project
```

### Web

Web owns frontend pages, reusable components, responsive layout, theme and design tokens, and frontend tests and build configuration. UI navigation may reserve space for future areas, but must not simulate authority, persistence, reconciliation, or production data.

### Backend

The separate backend project owns PostgreSQL schemas, migrations, row-level security, authorization, validation, mutation logic, synchronization, reconciliation, and authoritative records. This repository must not invent that contract.

The backend repository owns the approved [Milestone 1 Web integration contract](https://github.com/HNU-Falcon-Devs/hnu-dash-backend/blob/main/docs/integration/milestone-1-web.md). Historical Backend PR #2 was closed and superseded; it is not an implementation or deployment contract. See the [canonical integration contracts](https://github.com/HNU-Falcon-Devs/hnu-dash-backend/tree/main/docs/integration) for subsequent milestones. Web must not independently invent operations or authorization rules.

### Mobile

The separate Flutter project owns QR attendance collection and offline mobile behavior. The web application does not scan attendance.

## Authentication

**Approved:** Google OAuth for verified `@hnu.edu.ph` Workspace accounts through Supabase Auth, with Backend enforcement via `restrict_hnu_signup`, `hnu_verified_user`, and RLS. HNU MIS is independent. Roles/permissions and student-ID binding are Backend-controlled; no signup self-privilege or student-ID claims. See [authentication setup](authentication.md).


## M4.4 organizer offline reconciliation (synthetic only)

The existing Operations route consumes the pinned [M4.1](https://github.com/HNU-Falcon-Devs/hnu-dash-backend/blob/7475aa4e64be57f36399bbaa2166a00700f0abb5/docs/integration/milestone-4-part-1-offline-evidence.md) and [M4.2](https://github.com/HNU-Falcon-Devs/hnu-dash-backend/blob/7475aa4e64be57f36399bbaa2166a00700f0abb5/docs/integration/milestone-4-part-2-offline-reconciliation.md) contracts. Online-only remains the default. DRAFT opt-in is irreversible; no upload before approved Mobile preparation or after the server cutoff. Known preparations are not devices or proof of completeness. The manager explicitly seals, accounts for losses, adjudicates individual claims with exact reasons, confirms reconciliation and separately finalizes. Manager reads and writes use the verified cookie-bound session, organization association, live authorization and bounded RPC pages; no direct claim tables. Reload after unconfirmed writes; identical immutable requests are replay-safe at Backend, conflicting decisions are not. No hosted migration or institutional authorization is implied. [M4.5A acceptance](https://github.com/HNU-Falcon-Devs/hnu-dash-backend/issues/19#issuecomment-7180150336) establishes bounded synthetic Web–authenticated Staff RPC–PostgreSQL integration across separate live pre-cutoff and historical post-cutoff fixtures. Physical offline Android QA remains outstanding ([Mobile #13](https://github.com/HNU-Falcon-Devs/hnu-dash-mobile/issues/13)); CSV browser acceptance passed [bounded synthetic integration](https://github.com/HNU-Falcon-Devs/hnu-dash-web/issues/16#issuecomment-7197146159) (Web #16 closed 2026-11-27); remaining real OAuth acceptance is tracked in [Web #17](https://github.com/HNU-Falcon-Devs/hnu-dash-web/issues/17).

## Verified membership onboarding (synthetic only)

Membership management consumes the [pinned Backend contract](https://github.com/HNU-Falcon-Devs/hnu-dash-backend/blob/07055c9ef6bdc531990b0ca403c061ee8aae27c6/docs/integration/verified-membership-onboarding.md). Administrators review exact organization/email/role before preparing a signed intent. Unknown assignment outcomes retain the exact intent only in component memory; retry is deliberate and uses the original payload. Lost or expired intents require authorized reconciliation before new confirmation. Historical receipts are not current entitlements. Membership edits use decimal-string revisions and explicit confirmation; refresh and review after conflict/unknown outcomes, never auto-retry with a newer revision. No legacy direct membership writes, directory or client authority. Coordinated Backend/Web integration and owner cutover approval are required; production identity, retention, secret/restore and side-channel gates remain open.
