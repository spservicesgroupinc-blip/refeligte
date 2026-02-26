# RFE Foam Pro — Supabase Migration Plan & Data Flow Analysis

---

## Table of Contents

1. [Current Architecture Summary](#1-current-architecture-summary)
2. [Complete Data Flow & Workflow Analysis](#2-complete-data-flow--workflow-analysis)
3. [Supabase Database Schema Design](#3-supabase-database-schema-design)
4. [Row Level Security (Multi-Tenant Isolation)](#4-row-level-security-multi-tenant-isolation)
5. [Migration Phases](#5-migration-phases)
6. [Key Architecture Decisions](#6-key-architecture-decisions)
7. [File-by-File Impact Map](#7-file-by-file-impact-map)
8. [Implementation Timeline](#8-implementation-timeline)
9. [SaaS-Ready Features](#9-saas-ready-features)

---

## 1. Current Architecture Summary

| Layer | Current | Target |
|---|---|---|
| **Auth** | Custom SHA-256 hash in Google Sheets | Supabase Auth (email/password, magic link, OAuth) |
| **Database** | Per-company Google Spreadsheets (6 tabs each) + Master Login Sheet | Supabase Postgres with RLS multi-tenancy |
| **File Storage** | Google Drive folders | Supabase Storage (PDF uploads) |
| **API** | Google Apps Script `doPost()` router | Supabase client SDK (direct DB) + Edge Functions for business logic |
| **Hosting** | Vite static build | Supabase-hosted or Vercel/Netlify (unchanged) |

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  FRONTEND (React SPA + PWA)                                        │
│                                                                     │
│  SprayFoamCalculator.tsx  ← Master Router / Orchestrator            │
│       │                                                             │
│       ├── CalculatorContext.tsx  ← Single global state (useReducer) │
│       ├── useSync.ts            ← Cloud sync (read/write)          │
│       └── useEstimates.ts       ← Business logic hooks             │
│                                                                     │
│  State Model: ONE monolithic CalculatorState object                 │
│  containing ALL data (customers, estimates, warehouse, settings)    │
└───────────────────────┬─────────────────────────────────────────────┘
                        │ POST (JSON blob)
                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│  BACKEND (Google Apps Script — Code.js)                             │
│                                                                     │
│  doPost() → Action Router                                           │
│       │                                                             │
│       ├── Auth:  LOGIN / SIGNUP / CREW_LOGIN                        │
│       ├── Sync:  SYNC_DOWN / SYNC_UP  (full state read/write)      │
│       └── Ops:   COMPLETE_JOB / MARK_JOB_PAID / SAVE_PDF / etc.   │
│                                                                     │
│  Storage: Per-company Google Spreadsheet with 6 tabs                │
│     Estimates_DB │ Customers_DB │ Settings_DB                       │
│     Inventory_DB │ Profit_Loss_DB │ Material_Log_DB                 │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Complete Data Flow & Workflow Analysis

### Two User Roles

| Role | Login Method | Access |
|------|-------------|--------|
| **Admin** | Username + Password → `handleLogin()` | Full app: Calculator, Dashboard, CRM, Warehouse, Settings, Invoice |
| **Crew** | Company username + PIN → `handleCrewLogin()` | CrewDashboard only: view assigned Work Orders, run timer, complete jobs |

---

### STAGE 1: Customer / Lead Creation

```
Entry Points:
  ├── Dashboard Quick Action → "New Customer"
  ├── Customers view → "+ Add Lead" button
  └── Calculator → Customer dropdown → "+ Create New Customer"

Data Flow:
  User fills modal form (name, address, phone, email, notes)
       │
       ▼
  Customers.tsx → onSaveCustomer(formData)
       │
       ▼
  useEstimates.saveCustomer() → dispatch({ UPDATE_DATA: { customers: [...] } })
       │
       ▼
  CalculatorState.customers[] updated in memory
       │
       ▼
  useSync auto-detects state change → debounced SYNC_UP (3s)
       │
       ▼
  Backend: handleSyncUp() → writes to Customers_DB tab
           Row: [ID, Name, Email, Phone, City, State, Status, CreatedAt, JSON_DATA]
```

**Data shape:** `CustomerProfile` → `{ id, name, address, city, state, zip, email, phone, notes, status }`

---

### STAGE 2: Estimate Creation (Calculator)

```
Entry Points:
  ├── Dashboard → "+ New Estimate" → resets calculator
  ├── Customer Detail → "Start Estimate" → pre-fills customer
  └── Dashboard → click existing estimate → loads for editing

Data Flow:
  1. Select/Create Customer (dropdown or inline)
  2. Choose Calculation Mode: Building | Walls Only | Flat Area
  3. Enter dimensions: L × W × H, roof pitch, gables, metal surface
  4. Configure foam: wall/roof settings (type, thickness, waste%)
  5. Add inventory items (from warehouse catalog)
  6. Set expenses: man-hours, labor rate, trip charge, fuel, misc

       │
       ▼
  calculateResults(appData)  ← Pure function in calculatorHelpers.ts
       │
       ▼
  Returns CalculationResults:
    { wallArea, roofArea, wallBdFt, roofBdFt,
      openCellSets, closedCellSets, openCellStrokes, closedCellStrokes,
      openCellCost, closedCellCost, inventoryCost,
      laborCost, miscExpenses, materialCost, totalCost }

  Auto-recalculates on every input change (useMemo dependency: appData)
```

**Save actions from Calculator:**
- "Save Draft" → `saveEstimate(results, 'Draft')`
- "Generate PDF" → `generateEstimatePDF()` (client-side jsPDF)
- "Mark as Sold" → navigates to Work Order Stage

---

### STAGE 3: Work Order Stage (Selling the Job)

```
Trigger: Calculator → "Mark as Sold" button → WorkOrderStage view

Data Flow:
  WorkOrderStage.tsx presents:
    1. Schedule installation date
    2. Assign crew/rig (from state.crews[])
    3. Add crew instructions / job notes
    4. Review load list (foam sets + inventory items)
    5. Review customer info + scope summary

       │ User clicks "Generate Work Order"
       ▼
  useEstimates.confirmWorkOrder(results):
    │
    ├── 1. INVENTORY CHECK
    │     Compare required foam vs warehouse stock
    │     If shortage → confirm dialog → allow negative or redirect to Material Order
    │
    ├── 2. DEDUCT INVENTORY (warehouse foam counts go down)
    │     warehouse.openCellSets -= results.openCellSets
    │     warehouse.closedCellSets -= results.closedCellSets
    │
    ├── 3. SAVE ESTIMATE with status='Work Order'
    │     saveEstimate(results, 'Work Order')
    │     → Creates/updates EstimateRecord in savedEstimates[]
    │     → Also auto-saves customer to customers[] if new
    │
    ├── 4. SYNC TO CLOUD
    │     syncUp(state, spreadsheetId) → Backend writes all tabs
    │
    ├── 5. CREATE WORK ORDER GOOGLE SHEET (backend)
    │     createWorkOrderSheet(record, folderId, spreadsheetId)
    │     → Backend: handleCreateWorkOrder() creates standalone spreadsheet
    │     → Returns URL, saved back to estimate.workOrderSheetUrl
    │
    └── 6. GENERATE PDF (client-side)
          generateWorkOrderPDF(appData, record)
          → Downloads PDF with job details for crew
```

**Status transition:** `Draft` → `Work Order`
**Side effects:** Warehouse stock deducted, Google Sheet created, PDF generated

---

### STAGE 4: Crew Dashboard (Job Execution)

```
Crew logs in with Company Username + PIN
       │
       ▼
  CrewDashboard.tsx renders
       │
       ▼
  Shows filtered work orders:
    state.savedEstimates.filter(e =>
      e.status === 'Work Order' &&
      e.executionStatus !== 'Completed' &&
      (e.assignedCrewId === session.crewId || !e.assignedCrewId)
    )

Crew selects a job → Job Detail View:

  ┌─────────────────────────────────────┐
  │  GPS Map button (Google Maps link)  │
  │  Work Order Sheet (Google Sheet)    │
  │  Customer info, materials list      │
  │  Crew instructions / notes          │
  │                                     │
  │  ┌───────────────────────────────┐  │
  │  │  TIME CLOCK                   │  │
  │  │  [Start Job] → 00:00:00      │  │
  │  │  [Pause/End Day] [Complete]   │  │
  │  └───────────────────────────────┘  │
  └─────────────────────────────────────┘

Timer Flow:
  Start → saves timestamp to localStorage (persists across refresh)
  Stop (Pause) → logs time to Work Order Google Sheet via logCrewTime()
  Stop (Complete) → opens Completion Modal

Completion Modal:
  Crew enters ACTUALS:
    ├── Actual open cell sets used
    ├── Actual closed cell sets used
    ├── Actual labor hours
    ├── Actual inventory items used
    └── Completion notes

       │ Submit
       ▼
  completeJob(estimateId, actuals, spreadsheetId)
       │
       ▼
  Backend: handleCompleteJob()
    ├── Sets estimate.executionStatus = 'Completed'
    ├── Stores actuals data on estimate
    ├── Adjusts warehouse foam counts (delta between estimated vs actual)
    ├── Adjusts inventory item quantities in Inventory_DB
    └── Creates material usage log entries in Material_Log_DB
```

**Status transition:** `executionStatus: 'Not Started'` → `'Completed'` (estimate.status stays `'Work Order'`)

---

### STAGE 5: Admin Review (Post-Completion)

```
Dashboard shows badge: "X Ready for Review"
  filter: status === 'Work Order' && executionStatus === 'Completed'

Admin clicks completed job → Calculator view loads with:
  ├── Green banner: "Job Completed by Crew"
  ├── Actual vs Estimated comparison (labor, foam, inventory)
  └── "Generate Invoice" button becomes active

The JobProgress stepper shows:
  [Estimate ✓] → [Sold ✓] → [Scheduled ✓] → [Invoice ←] → [Paid]
```

---

### STAGE 6: Invoice Generation

```
Trigger: Calculator → "Generate Invoice" → InvoiceStage view

Data Flow:
  InvoiceStage.tsx presents:
    ├── Job Costing Review (estimated vs crew actuals side-by-side)
    │     Labor hours, open cell, closed cell usage
    │     Crew completion notes
    │     [Apply Crew Actuals to Invoice] button
    │       → Overwrites invoice labor hours with actual hours
    │       → Overwrites invoice inventory with actual usage
    │
    ├── Invoice Configuration
    │     Invoice number (auto-generated or editable)
    │     Invoice date
    │     Payment terms
    │
    ├── Expense adjustments (labor, trip charge, fuel, misc)
    │
    ├── Add/remove inventory line items from warehouse
    │
    └── Price Summary (subtotals, total)

Two exit actions:
  ┌─────────────────────┐     ┌─────────────────────────────┐
  │  [Save Invoice]     │     │  [Mark as Paid]             │
  │                     │     │                             │
  │  saveEstimate(      │     │  handleSaveAndMarkPaid():   │
  │    'Invoiced')      │     │    1. saveEstimate('Invoiced')│
  │  generateDocPDF(    │     │    2. syncUp(state)          │
  │    'INVOICE')       │     │    3. handleMarkPaid(id)     │
  │  → Dashboard        │     │    → triggers P&L calculation│
  └─────────────────────┘     └─────────────────────────────┘
```

**Status transition:** `Work Order` → `Invoiced`

---

### STAGE 7: Payment & Profit/Loss

```
Trigger:
  ├── InvoiceStage → "Mark as Paid"
  └── Dashboard → invoice row → "Mark Paid" button

Data Flow:
  handleMarkPaid(estimateId)
       │
       ▼
  API: markJobPaid(estimateId, spreadsheetId)
       │
       ▼
  Backend: handleMarkJobPaid()
    │
    ├── 1. Load estimate JSON from Estimates_DB
    ├── 2. Load cost settings (per-set prices, labor rate)
    ├── 3. Calculate P&L:
    │     revenue    = estimate.totalValue
    │     chemCost   = (OC sets × OC price) + (CC sets × CC price)
    │     laborCost  = hours × rate
    │     invCost    = Σ(item.qty × item.unitCost)
    │     miscCost   = tripCharge + fuelSurcharge
    │     totalCOGS  = chemCost + laborCost + invCost + miscCost
    │     netProfit  = revenue - totalCOGS
    │     margin     = netProfit / revenue
    │
    ├── 4. Save financials snapshot on estimate
    ├── 5. Set estimate.status = 'Paid'
    ├── 6. Append row to Profit_Loss_DB tab
    └── 7. Return updated estimate to client
       │
       ▼
  Client receives updated estimate with financials
       │
       ▼
  generateDocumentPDF('RECEIPT', estimate)
  → Auto-downloads payment receipt PDF
```

**Status transition:** `Invoiced` → `Paid`
**Terminal state.** Job is complete, financials recorded.

---

### Complete Status Lifecycle

```
         ┌──────────┐
         │  Draft   │  (Calculator — unsaved or saved estimate)
         └────┬─────┘
              │ "Mark as Sold" → Work Order Stage
              ▼
         ┌──────────┐
         │Work Order│  (Inventory deducted, crew can see it)
         └────┬─────┘
              │ Crew completes job
              ▼
         ┌──────────┐
         │Work Order│  executionStatus: 'Completed'
         │(Review)  │  (Admin review badge on Dashboard)
         └────┬─────┘
              │ "Generate Invoice" → Invoice Stage
              ▼
         ┌──────────┐
         │ Invoiced │  (Invoice PDF generated, awaiting payment)
         └────┬─────┘
              │ "Mark as Paid"
              ▼
         ┌──────────┐
         │   Paid   │  (P&L calculated, receipt generated)
         └──────────┘
              │
         ┌──────────┐
         │ Archived │  (Soft-deleted, hidden from main views)
         └──────────┘
```

---

### Data Sync Model

```
┌──────────────────────────────────────────────────┐
│              CLIENT STATE MACHINE                 │
│                                                   │
│  1. Session Recovery (localStorage)               │
│  2. Cloud-first init (SYNC_DOWN)                  │
│     └── Fallback: localStorage → defaults         │
│  3. Auto-sync writes (SYNC_UP, 3s debounce)      │
│     └── Entire CalculatorState serialized & sent  │
│  4. Manual sync button available                  │
│                                                   │
│  Crew role: READ-ONLY sync (no auto SYNC_UP)     │
│  Admin role: Full read/write sync                 │
└──────────────────────────────────────────────────┘

Key limitation: SYNC_UP sends the ENTIRE state blob every time.
No granular record updates. No conflict resolution beyond
"newer status wins" merge logic for estimates.
```

---

### Inventory / Warehouse Data Flow

```
                  ┌───────────────────┐
                  │   Warehouse View  │
       ┌──────── │   (Admin only)    │ ────────┐
       │         └───────────────────┘          │
       │                                        │
  Manual adjust                          Material Order
  (foam counts,                          (purchase order
   add/remove items)                      adds stock)
       │                                        │
       ▼                                        ▼
  CalculatorState.warehouse              createPurchaseOrder()
  { openCellSets, closedCellSets,        → warehouse counts += PO quantities
    items: WarehouseItem[] }             → purchaseOrders[] updated
       │
       │ Deducted when ───────────────── confirmWorkOrder()
       │                                  warehouse.openCellSets -= job needs
       │                                  warehouse.closedCellSets -= job needs
       │
       │ Adjusted when ────────────────  handleCompleteJob() (backend)
       │                                  delta = actual - estimated
       │                                  warehouse counts adjusted by delta
       │                                  inventory item quantities adjusted
       │
       │ Returned when ───────────────── handleDeleteEstimate()
                                          warehouse += previously deducted amounts
```

---

## 3. Supabase Database Schema Design

The current app stores data across 6 spreadsheet tabs per company plus a master login sheet. This maps to **8 Postgres tables** with proper normalization and RLS.

```sql
-- ============================================
-- EXTENSION: UUIDv7 for time-ordered primary keys
-- (per schema-primary-keys best practice)
-- ============================================
create extension if not exists pg_uuidv7;

-- ============================================
-- 1. COMPANIES (replaces Master Login "Users_DB" company data)
-- ============================================
create table public.companies (
  id uuid default uuid_generate_v7() primary key,
  name text not null,
  created_at timestamptz default now() not null,
  
  -- Settings (replaces Settings_DB key-value pairs)
  profile jsonb default '{}'::jsonb not null,       -- companyName, address, phone, etc.
  costs jsonb default '{"openCell":2000,"closedCell":2600,"laborRate":85}'::jsonb not null,
  yields jsonb default '{"openCell":16000,"closedCell":4000}'::jsonb not null,
  pricing_mode text default 'level_pricing' check (pricing_mode in ('level_pricing', 'sqft_pricing')),
  sqft_rates jsonb default '{"wall":0,"roof":0}'::jsonb,
  
  -- Warehouse foam counts (replaces warehouse_counts key in Settings_DB)
  open_cell_sets integer default 0 not null,
  closed_cell_sets integer default 0 not null
);

-- ============================================
-- 2. COMPANY_MEMBERS (multi-tenant user-company mapping)
-- Replaces: column in Users_DB linking user→spreadsheet
-- ============================================
create table public.company_members (
  id uuid default uuid_generate_v7() primary key,
  company_id uuid references public.companies(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null default 'admin' check (role in ('owner', 'admin', 'crew')),
  crew_name text,           -- only for role='crew'
  crew_pin text,            -- only for role='crew'
  phone text,
  truck_info text,
  status text default 'Active' check (status in ('Active', 'Inactive')),
  created_at timestamptz default now() not null,
  
  unique(company_id, user_id)
);
-- FK index (per schema-foreign-key-indexes best practice)
create index company_members_company_id_idx on public.company_members(company_id);
create index company_members_user_id_idx on public.company_members(user_id);

-- ============================================
-- 3. CUSTOMERS (replaces Customers_DB tab)
-- ============================================
create table public.customers (
  id uuid default uuid_generate_v7() primary key,
  company_id uuid references public.companies(id) on delete cascade not null,
  name text not null,
  email text,
  phone text,
  address text,
  city text,
  state text,
  zip text,
  notes text,
  status text default 'Active' check (status in ('Active', 'Archived')),
  created_at timestamptz default now() not null
);
create index customers_company_id_idx on public.customers(company_id);

-- ============================================
-- 4. ESTIMATES (replaces Estimates_DB tab - the core business object)
-- ============================================
create table public.estimates (
  id uuid default uuid_generate_v7() primary key,
  company_id uuid references public.companies(id) on delete cascade not null,
  customer_id uuid references public.customers(id) on delete set null,
  
  -- Summary columns (for fast listing without parsing JSON)
  status text default 'Draft' check (status in ('Draft','Work Order','Invoiced','Paid','Archived')),
  total_value numeric(12,2) default 0,
  invoice_number text,
  date timestamptz default now() not null,
  scheduled_date timestamptz,
  invoice_date timestamptz,
  payment_terms text default 'Due on Receipt',
  assigned_crew_id uuid references public.company_members(id) on delete set null,
  
  -- Execution tracking
  execution_status text default 'Not Started' check (execution_status in ('Not Started','In Progress','Completed')),
  
  -- Full data blobs (complex nested objects stored as JSONB)
  customer_snapshot jsonb not null default '{}'::jsonb,    -- frozen customer info at estimate time
  inputs jsonb not null default '{}'::jsonb,               -- mode, dimensions, areas
  results jsonb not null default '{}'::jsonb,              -- calculated BdFt, costs, etc.
  materials jsonb not null default '{}'::jsonb,            -- openCellSets, closedCellSets, inventory[]
  wall_settings jsonb not null default '{}'::jsonb,
  roof_settings jsonb not null default '{}'::jsonb,
  expenses jsonb not null default '{}'::jsonb,
  actuals jsonb,                                           -- crew completion data
  financials jsonb,                                        -- P&L snapshot after payment
  
  -- File links
  pdf_url text,
  work_order_url text,
  
  notes text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
create index estimates_company_id_idx on public.estimates(company_id);
create index estimates_customer_id_idx on public.estimates(customer_id);
create index estimates_status_idx on public.estimates(company_id, status);
create index estimates_assigned_crew_idx on public.estimates(assigned_crew_id);

-- ============================================
-- 5. WAREHOUSE_ITEMS (replaces Inventory_DB tab)
-- ============================================
create table public.warehouse_items (
  id uuid default uuid_generate_v7() primary key,
  company_id uuid references public.companies(id) on delete cascade not null,
  name text not null,
  quantity numeric(10,2) default 0,
  unit text default 'Units',
  unit_cost numeric(10,2) default 0,
  min_level numeric(10,2) default 0,
  created_at timestamptz default now() not null
);
create index warehouse_items_company_id_idx on public.warehouse_items(company_id);

-- ============================================
-- 6. MATERIAL_LOGS (replaces Material_Log_DB tab)
-- ============================================
create table public.material_logs (
  id uuid default uuid_generate_v7() primary key,
  company_id uuid references public.companies(id) on delete cascade not null,
  estimate_id uuid references public.estimates(id) on delete set null,
  customer_name text,
  material_name text not null,
  quantity numeric(10,2) not null,
  unit text default 'Units',
  logged_by text,
  logged_at timestamptz default now() not null
);
create index material_logs_company_id_idx on public.material_logs(company_id);
create index material_logs_estimate_id_idx on public.material_logs(estimate_id);

-- ============================================
-- 7. PROFIT_LOSS (replaces Profit_Loss_DB tab)
-- ============================================
create table public.profit_loss (
  id uuid default uuid_generate_v7() primary key,
  company_id uuid references public.companies(id) on delete cascade not null,
  estimate_id uuid references public.estimates(id) on delete set null,
  customer_name text,
  invoice_number text,
  date_paid timestamptz default now() not null,
  revenue numeric(12,2) default 0,
  chem_cost numeric(12,2) default 0,
  labor_cost numeric(12,2) default 0,
  inventory_cost numeric(12,2) default 0,
  misc_cost numeric(12,2) default 0,
  total_cogs numeric(12,2) default 0,
  net_profit numeric(12,2) default 0,
  margin numeric(5,4) default 0
);
create index profit_loss_company_id_idx on public.profit_loss(company_id);

-- ============================================
-- 8. TRIAL_MEMBERSHIPS (replaces Trial_Memberships tab)
-- ============================================
create table public.trial_memberships (
  id uuid default uuid_generate_v7() primary key,
  name text not null,
  email text not null,
  phone text,
  created_at timestamptz default now() not null
);
```

---

## 4. Row Level Security (Multi-Tenant Isolation)

```sql
-- Helper function: get current user's company_id (cached per-query)
create or replace function public.get_my_company_id()
returns uuid
language sql
security definer
set search_path = ''
stable
as $$
  select company_id from public.company_members
  where user_id = (select auth.uid())
  limit 1;
$$;

-- ========== ENABLE RLS ON ALL TABLES ==========
alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.customers enable row level security;
alter table public.estimates enable row level security;
alter table public.warehouse_items enable row level security;
alter table public.material_logs enable row level security;
alter table public.profit_loss enable row level security;
alter table public.trial_memberships enable row level security;

-- ========== POLICIES ==========

-- Companies: members can read/update their own company
create policy "Members read own company"
  on public.companies for select to authenticated
  using (id = (select public.get_my_company_id()));

create policy "Admins update own company"
  on public.companies for update to authenticated
  using (id = (select public.get_my_company_id()));

-- Company Members: see members of same company
create policy "Members see teammates"
  on public.company_members for select to authenticated
  using (company_id = (select public.get_my_company_id()));

create policy "Admins manage members"
  on public.company_members for all to authenticated
  using (
    company_id = (select public.get_my_company_id())
    and exists (
      select 1 from public.company_members
      where user_id = (select auth.uid()) and role in ('owner', 'admin')
    )
  );

-- Customers, Estimates, Warehouse, Logs, P&L: company-scoped CRUD
create policy "Company data access"
  on public.customers for all to authenticated
  using (company_id = (select public.get_my_company_id()))
  with check (company_id = (select public.get_my_company_id()));

create policy "Company data access"
  on public.estimates for all to authenticated
  using (company_id = (select public.get_my_company_id()))
  with check (company_id = (select public.get_my_company_id()));

create policy "Company data access"
  on public.warehouse_items for all to authenticated
  using (company_id = (select public.get_my_company_id()))
  with check (company_id = (select public.get_my_company_id()));

create policy "Company data access"
  on public.material_logs for all to authenticated
  using (company_id = (select public.get_my_company_id()))
  with check (company_id = (select public.get_my_company_id()));

create policy "Company data access"
  on public.profit_loss for all to authenticated
  using (company_id = (select public.get_my_company_id()))
  with check (company_id = (select public.get_my_company_id()));

-- Trial Memberships: anyone can insert, nobody reads from client
create policy "Anyone can submit trial"
  on public.trial_memberships for insert to anon, authenticated
  with check (true);
```

---

## 5. Migration Phases

### Phase 1 — Foundation (Supabase Project Setup)

| # | Task | Details |
|---|------|---------|
| 1.1 | Create Supabase project | Dashboard → New Project, choose region closest to users |
| 1.2 | Run schema migration | Execute the SQL above in SQL Editor |
| 1.3 | Configure Auth providers | Enable Email/Password; optionally add Google OAuth |
| 1.4 | Create Storage bucket | `pdfs` bucket for estimate/invoice PDFs (public read, authenticated write) |
| 1.5 | Set up environment variables | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |

### Phase 2 — Client SDK Integration (Replace `services/api.ts`)

| # | Task | Details |
|---|------|---------|
| 2.1 | Install dependencies | `npm install @supabase/supabase-js` |
| 2.2 | Create `services/supabase.ts` | Initialize Supabase client with env vars |
| 2.3 | Create `services/auth.ts` | Replace `loginUser`, `signupUser`, `loginCrew` with `supabase.auth.signInWithPassword()`, `supabase.auth.signUp()` |
| 2.4 | Create `services/database.ts` | Replace `syncDown`/`syncUp` with granular CRUD: `supabase.from('estimates').select()`, `.insert()`, `.update()`, `.delete()` |
| 2.5 | Create `services/storage.ts` | Replace `savePdfToDrive` with `supabase.storage.from('pdfs').upload()` |
| 2.6 | Delete `constants.ts` | Remove `GOOGLE_SCRIPT_URL` |
| 2.7 | Delete `backend/Code.js` | No longer needed |

### Phase 3 — Auth & Session Refactor

| # | Task | Details |
|---|------|---------|
| 3.1 | Replace session model | Replace `UserSession` with Supabase session (`supabase.auth.getSession()`) |
| 3.2 | Update `useSync.ts` | Replace cloud-first init with Supabase `onAuthStateChange` listener + direct queries |
| 3.3 | Update `LoginPage.tsx` | Use Supabase auth methods; add "Forgot Password" flow for free |
| 3.4 | Implement crew auth | Crew login via shared PIN → lookup `company_members` where `role='crew'` and `crew_pin=input` |
| 3.5 | Auto-create company on signup | Supabase database trigger: on new auth user → insert into `companies` + `company_members` |

### Phase 4 — Data Layer Refactor (Replace Sync with Real-Time)

| # | Task | Details |
|---|------|---------|
| 4.1 | Replace bulk sync with CRUD | Instead of syncing entire state, read/write individual records |
| 4.2 | Enable Realtime | `supabase.channel('estimates').on('postgres_changes', ...)` for live updates across devices |
| 4.3 | Refactor `CalculatorContext.tsx` | Remove monolithic `CalculatorState` blob; replace with query-based data fetching per view |
| 4.4 | Add optimistic updates | Insert/update locally, then sync to Supabase with conflict handling |
| 4.5 | Offline support | Use Supabase local-first patterns + `localStorage` fallback (existing pattern can stay) |

### Phase 5 — Business Logic Edge Functions

| # | Task | Details |
|---|------|---------|
| 5.1 | `complete-job` function | Replaces `handleCompleteJob` — updates inventory atomically, logs materials |
| 5.2 | `mark-paid` function | Replaces `handleMarkJobPaid` — calculates P&L, inserts into `profit_loss` |
| 5.3 | `generate-work-order` function | Replaces `handleCreateWorkOrder` — generates Google Sheet or PDF |

### Phase 6 — Data Migration Script

| # | Task | Details |
|---|------|---------|
| 6.1 | Export from Google Sheets | Apps Script function to export all company data as JSON |
| 6.2 | Import script | Node.js script using Supabase admin client to insert all records |
| 6.3 | User migration | Send password reset emails (cannot migrate hashed passwords) |

---

## 6. Key Architecture Decisions

### 6.1 Data Model: JSONB Hybrid Approach

The current app stores entire estimate objects as JSON blobs in spreadsheet cells. Rather than fully normalizing every nested field (which would create 15+ tables and require rewriting all frontend components), the plan uses a **hybrid approach**:

- **Indexed/queryable columns** for fields used in filters, sorting, dashboards: `status`, `total_value`, `date`, `customer_id`
- **JSONB columns** for complex nested objects that are always read/written as a unit: `inputs`, `results`, `materials`, `wall_settings`, `expenses`, `actuals`, `financials`

This matches Supabase best practices for avoiding over-normalization while keeping queries fast.

### 6.2 Multi-Tenancy via `company_id` + RLS

Every data table has a `company_id` foreign key. The `get_my_company_id()` helper function (wrapped in `SELECT` per the RLS performance best practice) ensures all queries are automatically scoped to the user's company. This replaces the current model where each company has a separate Google Spreadsheet.

### 6.3 Auth: Supabase Auth Replaces Custom Hash

- Admin login → `supabase.auth.signInWithPassword()`
- Crew login → Custom lookup: find company by username, verify PIN against `company_members`, then sign in with a service-role generated JWT or a shared crew account
- Signup → `supabase.auth.signUp()` + database trigger creates company

---

## 7. File-by-File Impact Map

| File | Action | Details |
|------|--------|---------|
| `backend/Code.js` | **DELETE** | All logic moves to Supabase RLS + Edge Functions |
| `constants.ts` | **REPLACE** | Remove GAS URL, add Supabase env vars |
| `services/api.ts` | **REPLACE** | Split into `supabase.ts`, `auth.ts`, `database.ts`, `storage.ts` |
| `hooks/useSync.ts` | **REWRITE** | Replace bulk sync with Supabase auth listener + per-table queries |
| `context/CalculatorContext.tsx` | **REFACTOR** | Session management via Supabase; data loading per-view |
| `types.ts` | **UPDATE** | Update `UserSession` to match Supabase session; add Supabase table types |
| `components/LoginPage.tsx` | **UPDATE** | Use Supabase auth methods |
| `components/Settings.tsx` | **UPDATE** | Save to `companies` table instead of sync blob |
| `components/Warehouse.tsx` | **UPDATE** | CRUD on `warehouse_items` table |
| `components/Customers.tsx` | **UPDATE** | CRUD on `customers` table |
| `components/Dashboard.tsx` | **UPDATE** | Query `estimates` + `profit_loss` tables |
| `components/CrewDashboard.tsx` | **UPDATE** | Replace `completeJob` API call with Supabase Edge Function |
| `components/InvoiceStage.tsx` | **UPDATE** | Replace `markJobPaid` API call with Supabase Edge Function |
| `components/WorkOrderStage.tsx` | **UPDATE** | Replace `createWorkOrderSheet` with Supabase Edge Function |
| All other components | **MINOR** | Replace `dispatch({type:'UPDATE_DATA'})` with Supabase mutations |

---

## 8. Implementation Timeline

```
Week 1:  Phase 1 (Supabase setup) + Phase 2 (client SDK + new service files)
Week 2:  Phase 3 (auth refactor) + Phase 4.1-4.2 (CRUD + realtime)
Week 3:  Phase 4.3-4.5 (context refactor + offline) + Phase 5 (edge functions)
Week 4:  Phase 6 (data migration) + testing + cutover
```

---

## 9. SaaS-Ready Features

By moving to Supabase, these become trivial to add:

- **Stripe subscription billing** — Edge Function webhook + `subscriptions` table
- **Multi-user per company** — Already built into the `company_members` model
- **Password reset / Magic link** — Supabase Auth built-in
- **Real-time collaboration** — Supabase Realtime channels
- **File storage with CDN** — Supabase Storage for PDFs/logos
- **Analytics dashboard** — Direct SQL queries on `profit_loss` + `estimates`
- **API rate limiting** — Supabase built-in per-project
