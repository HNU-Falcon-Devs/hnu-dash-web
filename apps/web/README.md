# HNU DASH — Web Application Specification & Architecture

This document outlines the architecture, data models, multi-tenant role system, navigation structure, UI workflows, and DRY directory structure for the **HNU DASH Web Application** (`apps/web`).

---

## 1. Overview & Core Mission

The HNU DASH web application serves as the centralized management, administrative, and student portal for university event attendance at Holy Name University. 

While field attendance scanning is primarily conducted via mobile devices with offline caching capabilities (`apps/mobile`), the **web application is the central command hub** responsible for:
- Event scheduling, lifecycle control, and audience targeting
- Scanner duty assignment and gatekeeper delegation
- Multi-tenant organization administration
- Attendance record review, corrections, and official finalization
- Student event discovery, unified calendar, personal attendance tracking, and clearance compliance

---

## 2. Multi-Tenant Relational Data Architecture

The web application interfaces with an authoritative PostgreSQL/Supabase backend as documented in `supabase/Attendance_System_Database_Documentation.docx`.

### Core Data Models

| Entity | Table | Key Fields & Constraints | Description |
| :--- | :--- | :--- | :--- |
| **User Profile** | `profiles` | `id` (PK, Auth UID), `student_id` (Unique, Scannable), `first_name`, `last_name`, `course`, `year_level`, `role` (`global_system_role`) | Master user identity. All standard users are university students. The global `admin` role is reserved for Faculty Advisers / Superadmins. |
| **Organization (Tenant)** | `organizations` | `id` (PK), `name`, `code` (Unique), `description` | Department councils, academic clubs, and co-curricular organizations (e.g., CCS Council, SYCOMP, Glee Club). |
| **Membership & RBAC** | `organization_members` | `id` (PK), `organization_id`, `user_id`, `role` (`tenant_member_role`: `student`, `officer`, `admin`) | Scopes user roles strictly within an organization. Enforces `UNIQUE(organization_id, user_id)`. |
| **Event** | `events` | `id` (PK), `organization_id`, `title`, `description`, `location`, `event_start`, `event_end`, `attendance_in_start/end`, `attendance_out_start/end`, `officer_in_start/end`, `officer_out_start/end`, `fine_per_missed_scan_student`, `fine_per_missed_scan_officer`, `target_year_levels` (`INT[]`) | Event schedules, dual attendance windows (student vs. officer call times), target audiences, and missed-scan penalty fines. |
| **Scanner Delegation** | `event_assigned_scanners` | `id` (PK), `event_id`, `user_id`, `assigned_at` | Explicit delegation mapping. **An officer cannot perform attendance scanning unless actively assigned to this table for that specific event.** Enforces `UNIQUE(event_id, user_id)`. |
| **Attendance Log** | `attendance_logs` | `id` (PK), `event_id`, `student_id`, `scanned_by`, `type` (`time_in`, `time_out`), `status` (`present`, `late`, `excused`), `scanned_at`, `synced_at` | Immutable, point-in-time scanning transactions. Enforces `UNIQUE(event_id, student_id, type)`. |

### Crucial Architectural Rules
1. **Adviser vs. Student Admin:**
   - `profiles.role = 'admin'` represents the **Faculty Adviser / Superadmin**.
   - Advisers oversee the platform and designate which student is the `admin` of each individual organization (`organization_members.role = 'admin'`).
2. **Multi-Membership & Independent Attendance:**
   - A single student can be a member of multiple organizations simultaneously.
   - If two different organizations require attendance for a student on the same date/event, **the student must be scanned independently by each respective organization**. Attendance is strictly tied to `events.organization_id`.
3. **Backend Authority:**
   - Client-side checks are strictly for UI rendering and navigation guidance.
   - Supabase Row Level Security (RLS) policies enforce authorization at the database level.

---

## 3. Dual-Identity & Role Management

A user holds a dual identity within the system:
1. **Universal Student Identity:** Every user has their own student profile, belongs to degree courses, attends university events, incurs fines for missed mandatory events, and requires attendance clearance.
2. **Organization-Scoped Context:** A single user can have different roles across different organizations:
   - **Admin** in the *College of Computer Studies Council*
   - **Officer** in the *Society of Young Computer Professionals (SYCOMP)*
   - **Member / Student** in the *University Glee Club*

---

## 4. UI Layout & Navigation Architecture

To provide an intuitive experience without confusing the user's personal student responsibilities with their administrative duties, the web application uses a **sidebar layout with persistent context switching**.

### Sidebar Layout Structure

```text
┌─────────────────────────────────────────────────────────────┐
│ 🏛️ HNU DASH                                                │
├─────────────────────────────────────────────────────────────┤
│ 👤 STUDENT PORTAL                                           │
│   📅 Upcoming Calendar       (Aggregated across all orgs)   │
│   📋 My Attendance & Dues    (Attended vs. Missed, Fines)   │
│                                                             │
│ YOUR ORGANIZATIONS:                                         │
│   🏢 CCS Student Council     [Admin]      <-- Active Org    │
│   👥 SYCOMP                  [Officer]                      │
│   🎭 University Glee Club    [Member]                       │
│                                                             │
│ ⚙️ ADVISER CONTROLS (Visible only if profiles.role === admin)│
│   🛡️ Manage Organizations & Appoint Admins                  │
├─────────────────────────────────────────────────────────────┤
│ 👤 Juan Dela Cruz | BSIT - 3rd Year                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. DRY File Structure & Modular Architecture

To uphold the **DRY (Don't Repeat Yourself)** principle, ensure high reusability, and prevent code bloat, code is organized into strict functional layers under `apps/web/src`:

```text
apps/web/src/
├── app/                                    # Next.js App Router routes & pages
│   ├── (student)/                          # Universal student portal pages
│   │   ├── portal/
│   │   │   ├── page.tsx                    # Overview & compliance summary
│   │   │   ├── calendar/page.tsx           # Multi-org upcoming events calendar
│   │   │   └── attendance/page.tsx         # Attended vs. missed history & dues
│   ├── (management)/                       # Organization-scoped workspaces
│   │   └── orgs/
│   │       └── [orgId]/
│   │           ├── layout.tsx              # Tenant shell with persistent sidebar
│   │           ├── page.tsx                # Organization dashboard
│   │           ├── events/
│   │           │   ├── page.tsx            # Event list & management table
│   │           │   ├── new/page.tsx        # Event creation (call times, fines)
│   │           │   └── [eventId]/
│   │           │       ├── page.tsx        # Event details & live stream
│   │           │       ├── scanners/       # Officer scanner duty assignment
│   │           │       └── review/         # Attendance review & finalization
│   │           └── members/page.tsx        # Organization roster & roles
│   ├── (adviser)/                          # Adviser / Superadmin administration
│   │   └── adviser/
│   │       └── organizations/page.tsx      # Org management & admin appointment
│   ├── scanner/
│   │   └── [eventId]/page.tsx              # Web fallback scanner
│   ├── layout.tsx                          # Root layout & providers
│   └── globals.css                         # Tailwind CSS v4 styling & variables
│
├── components/                             # Reusable UI component library
│   ├── ui/                                 # Low-level primitive design system components
│   │   ├── button.tsx                      # Buttons with variants (primary, secondary, danger)
│   │   ├── input.tsx                       # Text, search, number, and time inputs
│   │   ├── badge.tsx                       # Status chips (Present, Late, Excused, Admin, Officer)
│   │   ├── card.tsx                        # Container cards with consistent shadows & borders
│   │   ├── modal.tsx                       # Accessible modal dialogs and overlays
│   │   ├── table.tsx                       # Responsive, styled data tables with pagination
│   │   ├── dropdown.tsx                    # Dropdowns and select menus
│   │   └── skeleton.tsx                    # Loading placeholder skeletons
│   ├── layout/                             # Application shell & navigation components
│   │   ├── sidebar.tsx                     # Main navigation sidebar
│   │   ├── your-organizations-list.tsx     # "Your Organizations:" list with role badges
│   │   ├── header.tsx                      # Top bar with user profile & quick actions
│   │   └── breadcrumbs.tsx                 # Dynamic hierarchical page navigation
│   ├── portal/                             # Student-facing domain components
│   │   ├── event-calendar.tsx              # Interactive calendar (month/week/agenda)
│   │   ├── attendance-history-table.tsx    # Table of attended vs. missed events
│   │   ├── clearance-gauge.tsx             # Attendance compliance & fine summary card
│   │   └── upcoming-event-card.tsx         # Event preview card with time countdown
│   └── orgs/                               # Organization management domain components
│       ├── event-table.tsx                 # Management table with filter & lifecycle states
│       ├── event-form.tsx                  # Event creation/edit form (call times & fines)
│       ├── scanner-assignment-modal.tsx    # Modal to delegate scanner officers
│       └── attendance-review-table.tsx     # Real-time scan auditing & manual override
│
├── lib/                                    # Core type definitions & constants
│   ├── definitions.ts                      # Strict TypeScript interfaces, enums, & types
│   └── constants.ts                        # System constants (year levels, courses, scan types)
│
├── utils/                                  # Pure, reusable utility functions
│   ├── formatters.ts                       # Date, time window, PHP currency, and student ID formatters
│   ├── validators.ts                       # Event window validation & input sanitation
│   └── cn.ts                               # ClassName concatenation and merging utility
│
├── supabase/                               # Supabase data access layer
│   ├── client.ts                           # Client-side Supabase browser client
│   ├── server.ts                           # Server-side Supabase client for SSR & Server Actions
│   ├── data/                               # READ operations (Queries / Fetchers)
│   │   ├── events.ts                       # fetchEventsByOrg, fetchUpcomingEventsForStudent
│   │   ├── organizations.ts                # fetchUserOrganizations, fetchOrgDetails
│   │   ├── attendance.ts                   # fetchStudentAttendanceLogs, fetchEventAuditLogs
│   │   ├── members.ts                      # fetchOrgMembers, fetchEligibleScanners
│   │   └── profile.ts                      # fetchUserProfileWithMemberships
│   └── actions/                            # WRITE operations (Server Actions / Mutations)
│       ├── event-actions.ts                # createEvent, updateEvent, finalizeEvent
│       ├── scanner-actions.ts              # assignScannerDuty, revokeScannerDuty
│       ├── attendance-actions.ts           # recordAttendanceScan, overrideAttendanceStatus
│       └── member-actions.ts               # updateMemberRole, enrollMember
│
├── hooks/                                  # Custom reusable React hooks
│   ├── use-org-permissions.ts              # Resolves capabilities (canManage, canScan, etc.)
│   ├── use-active-org.ts                   # Retrieves currently selected organization context
│   └── use-calendar.ts                     # Month/week pagination & date calculations
│
└── context/                                # React Context Providers
    ├── org-context.tsx                     # Active organization provider & switcher state
    └── auth-context.tsx                    # User identity & multi-tenant memberships provider
```

---

## 6. Layer Responsibilities & DRY Rules

### 1. `lib/definitions.ts` (Single Source of Types)
All database entity models, join queries, DTOs, and view models are defined here once and exported across the app. Components and server actions must import from `@/lib/definitions` rather than redefining inline types.

### 2. `utils/` (Pure Reusable Logic)
- **`formatters.ts`:**
  - Date & time window ranges: formats `event_start` and `attendance_in_start/end` into human-readable strings (e.g., `8:00 AM – 9:00 AM`).
  - Currency: formats fines into Philippine Peso (e.g., `₱50.00`).
  - Student IDs: formats IDs cleanly (e.g., `21-1234-567`).
- **`validators.ts`:**
  - Validates that `attendance_in_start < attendance_in_end <= event_start`, and officer call times precede attendee windows.

### 3. `supabase/data/` vs. `supabase/actions/` (Separation of Read & Write)
- **`data/` (Queries):** Contains all data fetching functions (cached or server-side). They only read from the database and return typed definitions.
- **`actions/` (Mutations):** Contains Next.js Server Actions for modifying data (`POST`, `PUT`, `DELETE`). They handle authorization verification, execute transactions, and trigger revalidation (`revalidatePath`).

### 4. `components/ui/` vs. Domain Components
- Primitive components in `components/ui/` are generic and uncoupled from business logic (e.g., `<Button>`, `<Modal>`, `<Table>`).
- Domain components in `components/portal/` or `components/orgs/` compose these primitives to display business entities.

### 5. `hooks/use-org-permissions.ts`
Centralizes capability checks so that components never perform fragile string comparisons:

```typescript
export interface OrgPermissions {
  canManageEvents: boolean;
  canAssignScanners: boolean;
  canReviewAttendance: boolean;
  canFinalizeEvent: boolean;
  canScanEvent: (eventId: string) => boolean;
}
```

---

## 7. Development & Verification Workflow

From `apps/web`:

```bash
# Start local development server
npm run dev

# Code quality checks
npm run lint
npm run typecheck
npm test

# Production build validation
npm run build
```
