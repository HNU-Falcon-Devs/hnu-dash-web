# Web Repository Architecture

## Purpose

This repository owns only the HNU DASH Next.js frontend. The responsive shell now includes a Google OAuth authentication foundation; product management workflows remain deferred.

## Boundaries

```text
HNU DASH Web  -> consumes a future backend contract
HNU Backend  -> separate authoritative Supabase/PostgreSQL project
HNU Mobile   -> separate Flutter attendance-collection project
```

### Web

Web owns frontend pages, reusable components, responsive layout, theme and design tokens, and frontend tests and build configuration. UI navigation may reserve space for future areas, but must not simulate authority, persistence, reconciliation, or production data.

### Backend

The separate backend project will own PostgreSQL schemas, migrations, row-level security, authorization, validation, mutation logic, synchronization, reconciliation, and authoritative records. This repository must not invent that contract.

The backend repository owns the approved [Milestone 1 Web integration contract](https://github.com/HNU-Falcon-Devs/hnu-dash-backend/blob/main/docs/integration/milestone-1-web.md). A separate PR #2 proposal remains unapproved and must not be treated as deployed. Web must not independently invent operations or authorization rules.

### Mobile

The separate Flutter project owns QR attendance collection and offline mobile behavior. The web application does not scan attendance.

## Authentication

**Approved:** Google OAuth for verified `@hnu.edu.ph` Workspace accounts through Supabase Auth, with Backend enforcement via `restrict_hnu_signup`, `hnu_verified_user`, and RLS. HNU MIS is independent. Roles/permissions and student-ID binding are Backend-controlled; no signup self-privilege or student-ID claims. See [authentication setup](authentication.md).


## M4.4 organizer offline reconciliation (synthetic only)

The existing Operations route consumes the pinned [M4.1](https://github.com/HNU-Falcon-Devs/hnu-dash-backend/blob/7475aa4e64be57f36399bbaa2166a00700f0abb5/docs/integration/milestone-4-part-1-offline-evidence.md) and [M4.2](https://github.com/HNU-Falcon-Devs/hnu-dash-backend/blob/7475aa4e64be57f36399bbaa2166a00700f0abb5/docs/integration/milestone-4-part-2-offline-reconciliation.md) contracts. Online-only remains the default. DRAFT opt-in is irreversible; no upload before approved Mobile preparation or after the server cutoff. Known preparations are not devices or proof of completeness. The manager explicitly seals, accounts for losses, adjudicates individual claims with exact reasons, confirms reconciliation and separately finalizes. Manager reads and writes use the verified cookie-bound session, organization association, live authorization and bounded RPC pages; no direct claim tables. Reload after unconfirmed writes; identical immutable requests are replay-safe at Backend, conflicting decisions are not. No hosted migration or institutional authorization is implied. Combined acceptance is deferred to M4.5.
