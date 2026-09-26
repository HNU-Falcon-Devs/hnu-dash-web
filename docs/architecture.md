# Architecture

## Purpose and status

HNU DASH is planned as a QR-based university event attendance system. This repository currently establishes infrastructure and project boundaries only. It does not yet implement the attendance domain, authentication, or production integrations.

## System boundaries

### Next.js web application

`apps/web` is the management and control interface. It is expected eventually to support event management, organizations, roles and permissions, attendance-staff assignment, attendance review and corrections, event finalization, and student attendance viewing.

The web client must not be treated as an authorization or data-integrity boundary. Security-sensitive decisions belong in the authoritative backend.

### Supabase/PostgreSQL backend

Supabase/PostgreSQL is the source of truth. It will eventually own authorization, role and permission enforcement, organization scope, attendance reconciliation, duplicate validation, event lifecycle enforcement, and authoritative attendance records.

No database schema or hosted-project dependency is introduced in this foundation. Backend design will be added when its domain requirements are defined.

### Future Flutter application

A Flutter mobile application is planned but is not part of the current repository. It is expected to download assigned events and frozen rosters, scan physical HNU IDs, operate offline, keep scans temporarily in SQLite, and synchronize them to the server.

The mobile application will never be authoritative. Offline data remains provisional until the backend validates and reconciles it.

### Future HNU MIS integration

The official HNU MIS is intended to prove user identity in production. HNU DASH must not store or proxy MIS passwords. Identity proof through MIS and application authorization within HNU DASH/Supabase are separate responsibilities.

## Data authority

```text
HNU MIS (identity proof)
          |
          v
Next.js web / future Flutter mobile
          |
          v
Supabase/PostgreSQL (authorization and authoritative records)
```

Clients may collect input and present state, but only the backend may make authoritative decisions about access, event state, duplicates, reconciliation, and final attendance.

## Intentionally deferred

- Database schemas and migrations
- Authentication flows and MIS integration
- Roles, permissions, and organization management
- Event and attendance workflows
- Scanning, offline storage, synchronization, and reconciliation
- Student dashboards and clearance mode
- Production or sample domain data
- Flutter project initialization
