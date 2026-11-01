# Web Repository Architecture

## Purpose

This repository owns only the HNU DASH Next.js frontend. Its current phase establishes reusable UI infrastructure and a responsive application shell while product workflows and backend integration remain deferred.

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

The backend repository owns the canonical integration contract, currently proposed in [backend PR #2](https://github.com/HNU-Falcon-Devs/hnu-dash-backend/pull/2). The proposal is unapproved and does not represent a deployed API. Its operation names, payloads, permissions, and transport are not final; Web must not copy the contract or independently invent replacements.

### Mobile

The separate Flutter project owns QR attendance collection and offline mobile behavior. The web application does not scan attendance.

## Authentication

Authentication provider: **TBD**.

No authentication provider or flow is selected or implemented in this foundation.
