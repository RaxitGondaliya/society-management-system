# 🏢 SocietySphere - Complete System Architecture & Implementation Plan

A comprehensive, production-grade implementation blueprint for a multi-tenant Society Management System. Designed with an **API-first approach** in **Node.js (TypeScript) + PostgreSQL** to power both the initial responsive **Web Application (React / Next.js)** and the subsequent **Cross-Platform Mobile Application (Flutter / Dart)** seamlessly.

## 📑 Table of Contents
1. [High-Level Architecture & Tech Stack](#1-high-level-architecture--tech-stack)
2. [Multi-Tenant & Security Access Flow](#2-multi-tenant--security-access-flow)
3. [Database Relational Schema (PostgreSQL)](#3-database-relational-schema-postgresql)
4. [Project Folder Structure](#4-project-folder-structure)
5. [Complete Functional Modules (Modules 1 - 12)](#5-complete-functional-modules)
   * [Module 1: Authentication, Multi-Tenant Setup, Directory & Ownership Transfer](#module-1-authentication-multi-tenant-setup-directory--ownership-transfer)
   * [Module 2: Maintenance & Automated Financial Billing](#module-2-maintenance--automated-financial-billing)
   * [Module 3: Event Management, RSVP & Expense Accounting](#module-3-event-management-rsvp--expense-accounting)
   * [Module 4: Facility & Amenity Booking System](#module-4-facility--amenity-booking-system)
   * [Module 5: Visitor & Gatekeeper Security Management (Single App Guard Mode)](#module-5-visitor--gatekeeper-security-management-single-app-guard-mode)
   * [Module 6: Digital Notice Board & Timed Secret Polls](#module-6-digital-notice-board--timed-secret-polls)
   * [Module 7: Complaints & Helpdesk Ticket System](#module-7-complaints--helpdesk-ticket-system)
   * [Module 8: Parking Space Management & Allocation](#module-8-parking-space-management--allocation)
   * [Module 9: Daily Domestic Help & Staff Directory](#module-9-daily-domestic-help--staff-directory)
   * [Module 10: Emergency Contacts & Quick Dial Directory](#module-10-emergency-contacts--quick-dial-directory)
   * [Module 11: Society Financial Analytics & Transparency Reports](#module-11-society-financial-analytics--transparency-reports)
   * [Module 12: Society Staff Payroll & Expense Auto-Sync](#module-12-society-staff-payroll--expense-auto-sync)
6. [Core Technical Logic & Household Concurrency Rules](#6-core-technical-logic--household-concurrency-rules)
7. [Web-to-Flutter Mobile Transition & Offline Synchronization Roadmap](#7-web-to-flutter-mobile-transition--offline-synchronization-roadmap)
8. [Verification & Test Plan](#8-verification--test-plan)

---

## 1. High-Level Architecture & Tech Stack

* **Backend API:** Node.js (TypeScript) + Express.js / NestJS (RESTful + Socket.io)
* **Database & ORM:** PostgreSQL + Prisma ORM (Strict relational integrity & migrations)
* **Web Portal (Phase 1):** React.js / Next.js (Tailwind CSS, TanStack Query, Lucide Icons)
* **Mobile App (Phase 2):** **Flutter (Dart)** (Android & iOS with shared native services)
* **Realtime Engine:** WebSockets / Socket.io (Instant gate approvals, live polling countdowns)
* **Cloud Storage:** AWS S3 / Supabase Storage (Expense bills, circulars, visitor camera snaps)

```
+-----------------------------------------------------------------------------------+
|                                  Client Tier                                      |
|    [ Responsive Web Portal (React / Next.js) ]  |   [ Mobile App (Flutter / Dart) ]|
+-----------------------------------------------------------------------------------+
                                          |
                               (HTTPS / REST / WSS)
                                          v
+-----------------------------------------------------------------------------------+
|                             API Gateway & Middleware                              |
|   - Multi-Tenant Scoping (`society_id` Header / Subdomain resolver)               |
|   - Dual Auth (Phone/Email OTP Verification & JWT Access + HTTP-only Refresh)      |
|   - Role-Based Access Control (Super Admin, Sub-Admin/Rep, Resident, Guard)      |
|   - Household-Level Transaction Concurrency & Row-Locking                         |
+-----------------------------------------------------------------------------------+
                                          v
+-----------------------------------------------------------------------------------+
|                             Backend Application Tier                              |
|   - Runtime: Node.js (TypeScript) with NestJS or Express.js                       |
|   - ORM: Prisma ORM (Type-Safe Database Queries & Migrations)                    |
|   - Sockets: Socket.io (Gate Approvals, Live Alerts, Instant Vote Tallying)       |
|   - Job Scheduler: BullMQ / Agenda (Automated Overdue Reminders, Cut-off Clocks)  |
|   - Media Storage: AWS S3 / Supabase Storage (Bills, Visitor Photos, Notices)     |
+-----------------------------------------------------------------------------------+
                                          v
+-----------------------------------------------------------------------------------+
|                         PostgreSQL Relational Database                            |
|   - Multi-Tenant Isolation with Tenant Key Constraints                            |
|   - Row-Level Locking (`SELECT FOR UPDATE`) for Preventing Double Payments/Votes   |
|   - Immutable Audit Logs & Historic Snapshots for Real Estate Handover            |
+-----------------------------------------------------------------------------------+
```

---

## 2. Multi-Tenant & Security Access Flow

### Strict Deactivation & Instant Revocation Policy (House Sale & Tenant Move-Out)
1. **Immediate Revocation (Zero-Trust):**
   * When an occupant sells the house or a tenant moves out, the Super Admin triggers **"Change Ownership / Deactivate Occupant"**.
   * The user's JWT tokens are blacklisted immediately in Redis/DB; active sessions expire instantly across all devices (Web & Flutter).
   * The user loses **all access** to society dashboards, notices, directory, gate alerts, and billing history.
2. **Historical Integrity:**
   * The past financial ledger (maintenance receipts, event contributions) remains permanently archived and linked to the `Unit_ID` and historical audit logs. The new owner cannot be held responsible for old dues, and old users cannot view future society details.
3. **Master Directory Visibility:**
   * Super Admin and verified residents can view the **All-Society Directory**: Structured hierarchically as `Wing/Section -> Unit Number -> Primary Resident -> Linked Family Members`.

---

## 3. Database Relational Schema (PostgreSQL)

```sql
-- Multi-Tenant Society Root
CREATE TABLE societies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(30) UNIQUE NOT NULL, -- e.g., 'SHIV-7890'
    property_type VARCHAR(50) NOT NULL, -- 'FLAT', 'ROW_HOUSE', 'VILLA'
    address TEXT NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    bank_account_no VARCHAR(50),
    bank_ifsc VARCHAR(20),
    bank_beneficiary_name VARCHAR(150),
    upi_id VARCHAR(100),
    subscription_plan VARCHAR(50) DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Wings, Towers or Sections
CREATE TABLE sections_wings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id UUID REFERENCES societies(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL, -- 'Wing A', 'Tower 2', 'Section B'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Units / Flats / Houses
CREATE TABLE units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id UUID REFERENCES societies(id) ON DELETE CASCADE,
    section_wing_id UUID REFERENCES sections_wings(id) ON DELETE CASCADE,
    unit_number VARCHAR(50) NOT NULL, -- '1001', '1002', 'Villa-12'
    floor_number INT,
    occupancy_status VARCHAR(30) DEFAULT 'VACANT', -- 'OCCUPIED_OWNER', 'OCCUPIED_TENANT', 'VACANT'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_unit_per_wing UNIQUE (section_wing_id, unit_number)
);

-- User Profiles (Single login across multiple roles)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    role VARCHAR(30) NOT NULL, -- 'SUPER_ADMIN', 'SUB_ADMIN', 'RESIDENT', 'GUARD'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Household Unit Members (Mapping Users to a Flat)
CREATE TABLE unit_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    member_type VARCHAR(30) NOT NULL, -- 'OWNER', 'TENANT'
    is_primary_head BOOLEAN DEFAULT FALSE,
    approval_status VARCHAR(30) DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED', 'DEACTIVATED'
    deactivated_at TIMESTAMP WITH TIME ZONE,
    deactivation_reason VARCHAR(100), -- 'SOLD_PROPERTY', 'TENANT_MOVE_OUT'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Family Members & Dependents (For headcount, meal RSVP, and directory)
CREATE TABLE family_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
    full_name VARCHAR(150) NOT NULL,
    age INT,
    relation VARCHAR(50) NOT NULL, -- 'Wife', 'Son', 'Mother'
    phone VARCHAR(20),
    is_emergency_contact BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Maintenance Ledger (Sequential, Previews, Cash Verification)
CREATE TABLE maintenance_bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id UUID REFERENCES societies(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
    number_of_months INT NOT NULL,
    months_covered JSONB NOT NULL, -- e.g. ["2026-02", "2026-03", "2026-04"]
    amount_per_month NUMERIC(10, 2) NOT NULL,
    total_amount NUMERIC(10, 2) NOT NULL,
    payment_mode VARCHAR(30) NOT NULL, -- 'UPI_INTENT', 'UPI_QR', 'CASH', 'BANK_TRANSFER'
    status VARCHAR(30) DEFAULT 'PENDING', -- 'PAID', 'PENDING_VERIFICATION'
    paid_by_user_id UUID REFERENCES users(id),
    cash_collector_id UUID REFERENCES users(id),
    utr_reference VARCHAR(100),
    receipt_no VARCHAR(100) UNIQUE,
    paid_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Events & RSVPs
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id UUID REFERENCES societies(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    charging_model VARCHAR(50) NOT NULL, -- 'FLAT_PER_HOUSE', 'PER_HEAD'
    amount_rate NUMERIC(10, 2) NOT NULL,
    rsvp_cutoff_timestamp TIMESTAMP WITH TIME ZONE,
    status VARCHAR(30) DEFAULT 'ONGOING', -- 'ONGOING', 'COMPLETED'
    is_public_breakdown BOOLEAN DEFAULT TRUE,
    surplus_amount NUMERIC(10, 2) DEFAULT 0.00,
    created_by UUID REFERENCES users(id)
);

CREATE TABLE event_rsvps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
    submitted_by_user_id UUID REFERENCES users(id),
    attending_members_count INT NOT NULL,
    out_members JSONB DEFAULT '[]',
    guest_count INT DEFAULT 0,
    total_amount NUMERIC(10, 2) NOT NULL,
    payment_status VARCHAR(30) DEFAULT 'PENDING',
    payment_mode VARCHAR(30),
    cash_collector_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_event_unit_rsvp UNIQUE (event_id, unit_id)
);

CREATE TABLE event_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    bill_attachment_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Amenity Booking
CREATE TABLE amenities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id UUID REFERENCES societies(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    booking_type VARCHAR(50) NOT NULL, -- 'FULL_DAY', 'TIME_SLOT'
    charge_type VARCHAR(20) NOT NULL, -- 'FREE', 'PAID'
    rental_fee NUMERIC(10, 2) DEFAULT 0.00,
    caution_deposit NUMERIC(10, 2) DEFAULT 0.00,
    cancellation_cutoff_days INT DEFAULT 2
);

CREATE TABLE amenity_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    amenity_id UUID REFERENCES amenities(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
    booked_by_user_id UUID REFERENCES users(id),
    booking_date DATE NOT NULL,
    slot_details VARCHAR(100), -- 'FULL_DAY', '06:00-10:00'
    rental_amount NUMERIC(10, 2),
    caution_deposit NUMERIC(10, 2),
    total_paid NUMERIC(10, 2),
    payment_mode VARCHAR(30),
    status VARCHAR(30) DEFAULT 'CONFIRMED', -- 'CONFIRMED', 'CANCELLED', 'COMPLETED'
    deposit_refund_status VARCHAR(30) DEFAULT 'PENDING', -- 'REFUNDED', 'FORFEITED', 'NA'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_slot_booking UNIQUE (amenity_id, booking_date, slot_details)
);

-- Visitor & Gate Management
CREATE TABLE visitors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id UUID REFERENCES societies(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
    guard_user_id UUID REFERENCES users(id),
    category VARCHAR(50) NOT NULL, -- 'GUEST', 'DELIVERY', 'CAB'
    visitor_name VARCHAR(150),
    phone VARCHAR(20),
    vehicle_number VARCHAR(50),
    photo_url TEXT,
    pre_approved_passcode VARCHAR(10),
    status VARCHAR(30) DEFAULT 'PENDING_APPROVAL', -- 'PENDING_APPROVAL', 'APPROVED', 'DENIED', 'LEAVE_AT_GATE'
    entry_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    exit_time TIMESTAMP WITH TIME ZONE,
    overstay_alert_triggered BOOLEAN DEFAULT FALSE
);

-- Notice Board & Secret Polls
CREATE TABLE notices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id UUID REFERENCES societies(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'NORMAL', -- 'NORMAL', 'URGENT'
    target_audience VARCHAR(50) DEFAULT 'ALL', -- 'ALL', 'OWNERS_ONLY', 'TENANTS_ONLY', 'SECTION_SPECIFIC'
    section_wing_id UUID REFERENCES sections_wings(id),
    attachment_url TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notice_acknowledgements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notice_id UUID REFERENCES notices(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    acknowledged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_unit_notice_ack UNIQUE (notice_id, unit_id)
);

CREATE TABLE polls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id UUID REFERENCES societies(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    poll_privacy_type VARCHAR(30) NOT NULL, -- 'ANONYMOUS_SECRET_BALLOT', 'PUBLIC_TRANSPARENT'
    eligibility VARCHAR(30) DEFAULT 'OWNERS_ONLY', -- 'ALL_RESIDENTS', 'OWNERS_ONLY'
    cutoff_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE poll_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID REFERENCES polls(id) ON DELETE CASCADE,
    option_text VARCHAR(255) NOT NULL,
    vote_count INT DEFAULT 0
);

CREATE TABLE poll_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID REFERENCES polls(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
    poll_option_id UUID REFERENCES poll_options(id) ON DELETE CASCADE,
    voted_by_user_id UUID REFERENCES users(id), -- Blank/Nullified for ANONYMOUS polls
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_unit_poll_vote UNIQUE (poll_id, unit_id)
);

-- Complaints / Helpdesk
CREATE TABLE complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id UUID REFERENCES societies(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES units(id),
    raised_by_user_id UUID REFERENCES users(id),
    scope VARCHAR(30) NOT NULL, -- 'PERSONAL_UNIT', 'COMMON_AREA'
    category VARCHAR(100) NOT NULL, -- 'PLUMBING', 'ELECTRICAL', 'LIFT', 'CLEANING', 'SECURITY'
    title VARCHAR(255) NOT NULL,
    description TEXT,
    photo_url TEXT,
    status VARCHAR(30) DEFAULT 'OPEN', -- 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'
    assigned_staff_id UUID REFERENCES users(id),
    resolution_proof_url TEXT,
    rating INT CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Parking Management
CREATE TABLE parking_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id UUID REFERENCES societies(id) ON DELETE CASCADE,
    slot_label VARCHAR(50) NOT NULL, -- 'P-101', 'Basement 1 - Slot 4'
    vehicle_type VARCHAR(20) NOT NULL, -- '2_WHEELER', '4_WHEELER'
    zone_location VARCHAR(100),
    assigned_unit_id UUID REFERENCES units(id),
    vehicle_number VARCHAR(50),
    is_vacant BOOLEAN DEFAULT TRUE,
    CONSTRAINT unique_society_slot UNIQUE (society_id, slot_label)
);

-- Domestic Staff & Helpers
CREATE TABLE daily_helpers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id UUID REFERENCES societies(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES units(id), -- NULL if common society staff
    full_name VARCHAR(150) NOT NULL,
    phone VARCHAR(20),
    work_category VARCHAR(100) NOT NULL, -- 'COOK', 'MAID', 'CAR_CLEANER', 'GARDENER'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Society Staff Payroll & General Expenses
CREATE TABLE society_staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id UUID REFERENCES societies(id) ON DELETE CASCADE,
    full_name VARCHAR(150) NOT NULL,
    role VARCHAR(100) NOT NULL, -- 'SECURITY_GUARD', 'SWEEPER', 'ELECTRICIAN'
    monthly_salary NUMERIC(10, 2) NOT NULL,
    bank_account_no VARCHAR(50),
    upi_id VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE payroll_disbursements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id UUID REFERENCES societies(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES society_staff(id) ON DELETE CASCADE,
    disbursed_month VARCHAR(20) NOT NULL, -- '2026-03'
    amount NUMERIC(10, 2) NOT NULL,
    payment_mode VARCHAR(30) NOT NULL, -- 'ONLINE_BANK', 'UPI', 'CASH'
    transaction_ref VARCHAR(100),
    disbursed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE general_society_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id UUID REFERENCES societies(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL, -- 'ELECTRICITY_BILL', 'LIFT_AMC', 'GARDEN_MAINTENANCE'
    title VARCHAR(200) NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    bill_attachment_url TEXT,
    expense_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Emergency Contacts Directory
CREATE TABLE emergency_directory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id UUID REFERENCES societies(id) ON DELETE CASCADE,
    service_title VARCHAR(150) NOT NULL, -- 'Police Control', 'Fire Brigade', 'Society Electrician'
    contact_person VARCHAR(150),
    phone_number VARCHAR(30) NOT NULL,
    category VARCHAR(50) NOT NULL -- 'EMERGENCY_SERVICES', 'LOCAL_VENDORS', 'COMMITTEE'
);
```

---

## 4. Project Folder Structure

```
society-management-system/
├── apps/
│   ├── web/                          # Responsive Web Portal (React / Next.js)
│   │   ├── src/
│   │   │   ├── app/                  # App Router Pages
│   │   │   │   ├── (auth)/           # Login, Register Society, Join Society
│   │   │   │   ├── admin/            # Super Admin & Sub-Admin Dashboards
│   │   │   │   ├── resident/         # Resident Portal (Maintenance, RSVPs, Polls)
│   │   │   │   └── guard/            # Guard Mode (3 Big Buttons, Fast Scan)
│   │   │   ├── components/           # Reusable UI Components (Tailwind)
│   │   │   ├── hooks/                # TanStack Query & Socket Hooks
│   │   │   └── lib/                  # Web API Client & Token Management
│   ├── mobile_flutter/               # Cross-Platform Mobile Application (Flutter / Dart)
│   │   ├── lib/
│   │   │   ├── core/                 # API Client, Dio Interceptors, Local Secure Storage
│   │   │   ├── features/             # Feature-first Modular Structure
│   │   │   │   ├── auth/             # Login, OTP verification
│   │   │   │   ├── maintenance/      # Smart Sequential Month Selector & QR Payment
│   │   │   │   ├── events/           # RSVP, Headcount & Surplus Roll-over
│   │   │   │   ├── guard/            # Guard Mode (Fast Camera Scan, Big Buttons)
│   │   │   │   └── polls/            # Secret Ballot & Auto-Cutoff Countdown
│   │   │   ├── shared/               # Custom Widgets, Themes, Dialogs
│   │   │   └── main.dart             # Flutter Entrypoint
│   └── api/                          # Node.js Backend Server (NestJS / Express)
│       ├── src/
│       │   ├── modules/
│       │   │   ├── auth/             # OTP, JWT, Session Management
│       │   │   ├── societies/        # Tenancy Onboarding, Wing/Floor Generation
│       │   │   ├── maintenance/      # Sequential Calculation, UPI/Cash Handlers
│       │   │   ├── events/           # Cut-off Schedulers, Surplus Rollovers
│       │   │   ├── amenities/        # Double-booking locks, Deposit logic
│       │   │   ├── guard/            # Visitor workflows, 3-way alerts, Overstay
│       │   │   ├── polls/            # Secret Ballot Cryptography, Auto-closing
│       │   │   ├── complaints/       # Common Area Issue Merging
│       │   │   ├── parking/          # Allotment maps & vacancy directories
│       │   │   ├── payroll/          # Staff salary ledger & accounting sync
│       │   │   └── analytics/        # Periodic Audit Reports (1/6/12 Month)
│       │   ├── middleware/           # TenantScoper, RoleGuards, AuditLogger
│       │   ├── prisma/               # Database Schema, Migrations, Seeders
│       │   └── index.ts              # Server Entrypoint
└── packages/                         # Shared Code across Web and Mobile
    ├── types/                        # Shared TypeScript Data Interfaces
    └── validators/                   # Zod Validation Schemas
```

---

## 5. Complete Functional Modules

### Module 1: Authentication, Multi-Tenant Setup, Directory & Ownership Transfer
* **Two Front-Door Routes:**
  1. `Register New Society` (Super Admin): Captures Name, GPS Pin, Property Type (Flats vs. Row Houses/Villas).
     * Flats: Custom Wings, Floor Count, Flats per Floor. Generates sequential series (e.g., 1001-1004, 2001-2004) with manual overrides.
     * Row Houses/Villas: Custom Section splitting (Section A, Section B) and direct house numbering.
     * Generates a **Unique Society Code** (e.g., `SHIV-7890`).
  2. `Join My Society` (Residents): OTP verification, Society Code input, Unit selection, Member Type (Owner vs. Tenant), Full Name, Age, and Family Member additions.
* **Mandatory Admin Approval Gate:**
  * New resident registrations are held in a `PENDING` queue. Admin verifies family details and approves or rejects before any access is granted.
* **Master User & Household Directory:**
  * Full hierarchical view available to Admin: `Section/Wing -> Unit -> Primary Owner/Tenant -> Linked Family Members & Ages`.
* **Instant Ownership Transfer & Deactivation (Move-Out & Property Sale):**
  * When an occupant leaves or sells the property:
    * Admin clicks **"Deactivate / Ownership Transfer"**.
    * User account status becomes `DEACTIVATED`.
    * **All active JWT sessions and tokens are invalidated immediately**. The ex-occupant cannot open or view any society details or notices.
    * Historical bills and receipts remain permanently preserved on the `Unit_ID` for future auditing.

### Module 2: Maintenance & Automated Financial Billing
* **Setup & Configurations:**
  * Admin sets base monthly/annual maintenance rate and payment details (UPI ID, Bank A/C, IFSC). Configurable during onboarding or later under Settings.
  * Automated reminder engine sends notifications after the due date (e.g., 15th of every month).
* **Smart Sequential Month Selector (UI/UX):**
  * Eliminates manual checkboxes. The resident simply selects the **Number of Months** to pay (e.g., 1 Month, 3 Months, 6 Months, 12 Months).
  * **Instant Preview:** The system displays the calculation and exact chronological months covered (e.g., *Current Due: February 2026. Selected 3 Months -> Feb 2026, Mar 2026, Apr 2026 = ₹6,000*).
* **Dual Payment Channels:**
  1. **Online / UPI:** Dynamic QR code display (for scanning from another device) or direct UPI App Intent (GPay, PhonePe, Paytm).
  2. **Two-Way Cash Workflow:**
     * **Path A (Resident Initiated):** Resident pays cash, selects authorized collector's name from dropdown. Collector receives an alert and clicks **"Accept & Confirm"**.
     * **Path B (Admin Direct Entry):** Admin directly searches a unit, selects months, and clicks **"Mark as Paid (Cash)"**.
* **Cash-In-Hand Sub-Admin Ledger:**
  * Super Admin dashboard displays how much cash is held by each representative (e.g., *Wing A Rep: ₹18,000 | Section B Rep: ₹24,000*).

### Module 3: Event Management, RSVP & Expense Accounting
* **Event Creation:**
  * Title, description, Single-Day or Multi-Day Date Range (e.g., 9-day Navratri).
  * **Charging Models:** Flat charge per house or Per-Head / Per-Person charge (e.g., ₹150/head dinner).
* **Smart Family RSVP with Opt-Out & Guest Counting:**
  * Automatically lists all registered family members.
  * Resident toggles absent members to **"Out"** (e.g., 1 member out of town -> 3 attended).
  * **"Add Guest (+)"** button allows adding visiting relatives.
  * Real-time calculation preview updates before final payment.
* **RSVP Cut-off Time:**
  * Admin defines a strict deadline. Once passed, resident headcount locks automatically for precise catering orders.
* **Two-Tab Transparency & Surplus Transfer:**
  * **Tab 1: Collection Ledger:** Live list of units that paid (Read-Only for residents, toggleable privacy).
  * **Tab 2: Expense Sheet:** Admin logs expenses with vendor bill photo attachments.
  * System computes: $\text{Balance} = \text{Total Collected} - \text{Total Expenses}$.
  * **Surplus Rollover:** Single-click transfer of excess balance into the Society Maintenance Reserve Fund.
  * Admin clicks **"Mark as Completed"** to archive the event into history.

### Module 4: Facility & Amenity Booking System
* **Amenity Catalog:**
  * Predefined assets (Clubhouse, Swimming Pool, Common Plot, Garden, Terrace, Gym) + custom additions.
  * **Booking Options:** Full-Day booking (Party plots, Halls) or Time-Slot booking (Pool, Gym, Terrace).
  * **Pricing & Security Deposit:** Rental fee + refundable **Caution Deposit** (for damages).
* **Resident Flow & Calendar Locking:**
  * Multi-amenity selection with identical or separate dates.
  * **Zero Double-Booking:** Slots lock in real-time. Booked dates appear in red/disabled state for other members.
  * Transparent public society booking schedule.
* **Cancellation & Refund Policy:**
  * Configurable cut-off window (e.g., cancel before 48 hours for refund/credit).

### Module 5: Visitor & Gatekeeper Security Management (Single App Guard Mode)
* **Zero Extra Apps (Role-Based Interface):**
  * Security guard logs in using phone + OTP on the standard app; system detects the role and presents a clean **Guard Desk Dashboard**.
* **3 Big Buttons Entry Flow:**
  * Large touch targets: `1. Guest/Visitor`, `2. Delivery`, `3. Cab/Taxi`.
  * Captures Unit number, Visitor Name, Phone, Vehicle number, and an instant camera photo snapshot.
* **3-Way Resident Instant Approval:**
  * Real-time notification with visitor photo rings on household devices with three options:
    1. ✅ **Approve (Allow entry)**
    2. ❌ **Deny (Reject entry)**
    3. 📦 **Leave at Gate (Delivery package drop)**
* **Pre-Approved Guest Pass:**
  * Resident creates a 6-digit OTP passcode for incoming guests for direct gate clearance without phone calls.
* **Overstay Alerts & Emergency Calling:**
  * Automatic timer highlights visitors/cabs staying longer than 30-45 minutes.
  * One-tap direct intercom phone call to resident if app notifications fail.

### Module 6: Digital Notice Board & Timed Secret Polls
* **Notice Board:**
  * Title, description, PDF/image attachment, Urgent/Normal flags, audience scoping (All, Owners Only, Specific Wing).
  * Read Acknowledgement (`"I have read"` tracker for admin transparency). Clean broadcast with no messy comment threads.
* **Timed Secret Ballot Voting (Democracy Engine):**
  * **One Flat = One Vote:** First member of the household to cast a vote locks the ballot for the unit.
  * **Poll Privacy Types:**
    1. **Anonymous / Secret Ballot:** For elections (Secretary/Chairman). Database stores vote counts without tying unit IDs to choices. Zero live results visible to Super Admin or residents during active polling.
    2. **Public / Transparent Poll:** Used for general decisions (e.g., building paint color).
  * **Automated Cut-off:** Polling closes at the exact deadline, revealing the winning option and percentage bar charts simultaneously to everyone.

### Module 7: Complaints & Helpdesk Ticket System
* **Ticket Raising:**
  * Scopes: Personal Flat Issue vs. Common Area Issue (Elevator, Water Motor, Street Light).
  * Photo attachment proof, category selection, and auto-generated Ticket ID (e.g., `#TKT-2041`).
* **Duplicate Issue Prevention (Common Area Merging):**
  * If a common issue is already open (e.g., Lift Breakdown in Wing A), the system alerts members: *"A ticket for this issue is already in progress,"* preventing 30 identical complaints.
* **Resolution Proof & Feedback:**
  * Admin/Technician uploads a photo of the completed repair before marking **Resolved**.
  * Resident confirms closure and leaves a 1-5 star rating.

### Module 8: Parking Space Management & Allocation
* **Inventory Setup:**
  * Numbered slots (e.g., `P-101`, `B1-Car-05`), tagged by 2-Wheeler / 4-Wheeler and zones (Ground, Basement 1, Open).
* **Meeting Allocation & Vacancy Directory:**
  * Admin assigns slots to units based on annual general meetings or draw systems.
  * **Public Directory:** Shows allocated slots, vehicle plate numbers, and **Vacant Slots** for members seeking extra space.
  * **Wrong Parking Alert:** Resident sends a photo alert to Security and car owner if someone encroaches on their assigned spot.

### Module 9: Daily Domestic Help & Staff Directory
* **Household Service Mapping:**
  * Residents register their maids, cooks, nannies, or drivers with name, phone, and role.
  * Residents can remove/deactivate helpers when their service terminates.
* **Society-Level Helpers:**
  * Admin registers common cleaners, security personnel, and gardeners.
  * Comprehensive searchable directory for quick reference during investigations or emergencies.

### Module 10: Emergency Contacts & Quick Dial Directory
* **One-Tap Calling:**
  * Curated directory containing: Police Control Room, Fire Station, Nearest Hospital / Ambulance, Security Gate Intercom, Society President / Secretary, Lift Breakdown Technician, and Society Electrician/Plumber.
  * Tapping a contact automatically opens the phone's native phone dialer with the number pre-filled.

### Module 11: Society Financial Analytics & Transparency Reports
* **Interactive Income vs. Expense Charts:**
  * Visual breakdown of Maintenance Collections + Event Fees vs. Operational Expenses (Electricity, Maintenance AMC, Staff Payroll).
* **Periodic Filtering:**
  * Read-Only view for all residents with filters:
    * **1 Month** (Monthly review)
    * **6 Months** (Half-yearly audit)
    * **12 Months** (Annual General Meeting balance sheet)
* **One-Click Export:** Downloadable annual audit PDF summary for AGMs.

### Module 12: Society Staff Payroll & Expense Auto-Sync
* **Staff Register & Salary Scheduling:**
  * Monthly fixed salary configuration for guards, sweepers, and technicians.
* **Direct Disbursement:**
  * Admin marks payouts via **Bank Transfer**, **UPI**, or **Cash**, attaching transaction references or payment vouchers.
* **Instant Ledger Synchronization:**
  * Payouts immediately reflect in Module 11's expense analytics under the "Staff Salaries" category, keeping accounts 100% up to date.

---

## 6. Core Technical Logic & Household Concurrency Rules

### 1. The "One Unit = One State" Rule (Household Concurrency)
* Multiple family members have app access under the same unit.
* To prevent duplicate maintenance payments, double meal registrations, or repeated voting, operations use **PostgreSQL Transactions with Row-Level Locking**:

```typescript
// Example: Safe Household Voting Transaction
await prisma.$transaction(async (tx) => {
  // 1. Lock the unit row for update
  const lockedUnit = await tx.units.findUnique({
    where: { id: unitId },
    select: { id: true },
  });

  // 2. Check if a vote was already cast by any family member
  const existingVote = await tx.poll_votes.findUnique({
    where: { poll_id_unit_id: { poll_id: pollId, unit_id: unitId } },
  });

  if (existingVote) {
    throw new Error("A vote has already been submitted for your household.");
  }

  // 3. Cast the vote and lock state
  return await tx.poll_votes.create({
    data: {
      poll_id: pollId,
      unit_id: unitId,
      poll_option_id: optionId,
      voted_by_user_id: isAnonymous ? null : userId,
    },
  });
});
```

### 2. Multi-Tenant Scoping Middleware
* Every incoming HTTP/Socket request is scoped to the tenant:
  * Header: `X-Society-ID: <UUID>` or parsed from the user's verified JWT claim.
  * Database queries automatically inject `WHERE society_id = :societyId` to guarantee absolute data isolation.

---

## 7. Web-to-Flutter Mobile Transition & Offline Synchronization Roadmap

### Phase 1: Web Application (Validation & Core Stability)
* Build the system as a responsive Web Application using **React / Next.js** with Tailwind CSS.
* Perfect all edge cases: Admin approval workflows, payment receipts, event expense calculators, secret ballot deadlines, and tenant deactivation.
* Verify PostgreSQL relations and lock down stable REST API endpoints.

### Phase 2: Mobile App Transition (Flutter / Dart)
* **API Compatibility:**
  * The Node.js REST API is fully platform-agnostic. Flutter connects via `Dio` / `Http` client without any backend changes.
  * Dart data models (`freezed` or `json_serializable`) are mapped directly to the API JSON response contracts.
* **Flutter Native Capabilities:**
  * **Camera & Fast QR Code Scanning:** `mobile_scanner` package for instant visitor gate check-ins.
  * **High-Priority VoIP / Ringing Push Alerts:** Firebase Cloud Messaging (FCM) + `flutter_local_notifications` with full-screen intent for visitor approval popups.
  * **One-Tap Phone Calls:** `url_launcher` package for direct emergency dialing.
* **Offline-First Guard Mode in Flutter:**
  * For underground gates with poor connectivity, Flutter stores visitor logs in local **Hive / Isar / SQLite** databases.
  * Background worker (`workmanager`) syncs pending entries to PostgreSQL as soon as internet connection resumes.

---

## 8. Verification & Test Plan

1. **Onboarding & Approval Check:**
   * Register a multi-wing society -> join as resident -> verify that resident is locked until admin approval.
2. **Move-out / Deactivation Test:**
   * Deactivate an owner/tenant -> ensure their active token is blacklisted immediately and all society access is cut off across Web & Flutter.
3. **Sequential Maintenance Billing Test:**
   * Select 3 months -> confirm calculated months match the exact sequence -> verify Cash vs. UPI flows.
4. **Timed Secret Poll Test:**
   * Submit a vote from one family phone -> verify second family phone shows "Vote already cast" -> verify results remain hidden until the cut-off time.
5. **Guard Mode Workflow:**
   * Submit visitor entry -> confirm resident receives real-time approval alert with photo -> verify instant status update on the guard's screen.