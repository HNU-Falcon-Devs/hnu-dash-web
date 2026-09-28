# HNU DASH — Web Application Specification & Architecture

This document outlines the architecture, data models, multi-tenant role system, navigation structure, and UI workflows for the **HNU DASH Web Application** (`apps/web`).

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

### Contextual Workspaces

#### A. Universal Student Portal
* **Upcoming Events Calendar:** 
  - Dynamic monthly/weekly/agenda calendar aggregating events across all organizations the student belongs to.
  - Automatically filters based on the student's degree course and `target_year_levels`.
* **Personal Attendance & Clearance:**
  - Complete history of attended vs. missed events.
  - Check-in/check-out timestamps (`time_in`, `time_out`) and statuses (`present`, `late`, `excused`).
  - Itemized missed-scan penalties and overall semester clearance compliance.

#### B. Organization Workspace (Activated by selecting an org under "Your Organizations:")
The view adapts based on the user's role in the selected organization:

1. **When User is an `Admin` in the Organization:**
   * **Event Management:** 
     - Create and edit events.
     - Configure early call-time windows for officers (`officer_in_start/end`, `officer_out_start/end`) and regular attendee windows (`attendance_in_start/end`, `attendance_out_start/end`).
     - Set missed-scan fine rates for students vs. officers.
     - Define audience scope (all members or target year levels).
   * **Scanner Delegation (`event_assigned_scanners`):** 
     - Select eligible officers from the roster and grant them scanner privileges for specific events.
     - Revoke or reassign scanner duty.
   * **Attendance Review & Finalization:**
     - Audit live sync transactions.
     - Perform manual status overrides (e.g., mark as `excused` with notes).
     - Finalize event rosters to generate official records.
   * **Member Roster:** View and manage members enrolled under the organization.

2. **When User is an `Officer` in the Organization:**
   * **Assigned Scanner Duty:** View events where the officer has been delegated scanner authority.
   * **Officer Call Times:** Detailed agenda displaying mandatory call times, egress windows, and higher officer fine requirements.
   * **Scanner Launchpad:** Web fallback scanner (camera/barcode input) accessible only if assigned in `event_assigned_scanners`.

3. **When User is a `Student` (Member) in the Organization:**
   * **Organization Feed:** Org-specific announcements and event notices.
   * **Club Compliance:** Attendance records and fine status specifically attributable to this organization.

#### C. Adviser / Global Admin Workspace (`profiles.role === 'admin'`)
* Overview of all campus organizations.
* Ability to create organizations and assign/appoint student organization admins.
* University-wide attendance auditing and clearance reporting.

---

## 5. Technical Implementation Details

### Technology Stack
- **Framework:** Next.js 16 (App Router with Turbopack)
- **UI Library:** React 19
- **Language:** TypeScript 5 (Strict Mode)
- **Styling:** Tailwind CSS v4 & PostCSS
- **Testing:** Vitest, React Testing Library, and JSDOM
- **Linting:** ESLint 9 (Flat Config)
- **Backend / Database:** Supabase / PostgreSQL (Row Level Security enforced)

### Proposed Route Map (`apps/web/src/app`)

```text
apps/web/src/app/
├── layout.tsx                              # Root layout with providers
├── globals.css                             # Tailwind v4 theme and styling
│
├── (student)/                              # Universal Student Space
│   ├── portal/
│   │   ├── page.tsx                        # Student dashboard & clearance status
│   │   ├── calendar/page.tsx               # Unified multi-org upcoming calendar
│   │   └── attendance/page.tsx             # Attendance history (attended/missed/fines)
│
├── (management)/                           # Tenant-Scoped Workspaces
│   └── orgs/
│       └── [orgId]/
│           ├── layout.tsx                  # Org shell with sidebar & active org context
│           ├── page.tsx                    # Org overview / dashboard
│           ├── events/
│           │   ├── page.tsx                # Event list & management table
│           │   ├── new/page.tsx            # Event creation (windows, fines, year levels)
│           │   └── [eventId]/
│           │       ├── page.tsx            # Event details & live attendance feed
│           │       ├── scanners/page.tsx   # Officer scanner duty assignment
│           │       └── review/page.tsx     # Attendance reconciliation & finalization
│           └── members/page.tsx            # Organization roster
│
├── (adviser)/                              # Global Adviser Tools
│   └── adviser/
│       └── organizations/page.tsx          # Manage orgs & appoint student admins
│
└── scanner/
    └── [eventId]/page.tsx                  # Web scanner (verifies event_assigned_scanners)
```

### Permission Strategy (`useOrgPermissions`)
Instead of scattered inline string comparisons, components leverage a typed capability hook:

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

## 6. Development & Verification Workflow

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
