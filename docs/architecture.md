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
