-- ============================================================
-- RFE Foam Pro — Supabase Initial Schema Migration
-- Multi-tenant SaaS for spray foam contractors
-- ============================================================
-- Best practices applied:
--   - UUIDv7 for time-ordered PKs (schema-primary-keys)
--   - FK indexes on every foreign key (schema-foreign-key-indexes)
--   - RLS with (select auth.uid()) pattern (security-rls-performance)
--   - Composite indexes for common query patterns (query-composite-indexes)
--   - CHECK constraints for domain validation (schema-constraints)
--   - JSONB for complex nested objects read/written as a unit
-- ============================================================

-- 1. Extension: UUIDv7 for time-ordered primary keys
create extension if not exists pg_uuidv7;

-- ============================================================
-- TABLES
-- ============================================================

-- 1. COMPANIES — one row per tenant
create table public.companies (
  id uuid default uuid_generate_v7() primary key,
  name text not null,
  created_at timestamptz default now() not null,

  -- Company profile (branding for PDFs)
  profile jsonb default '{}'::jsonb not null,

  -- Pricing & yield settings
  costs jsonb default '{"openCell":2000,"closedCell":2600,"laborRate":85}'::jsonb not null,
  yields jsonb default '{"openCell":16000,"closedCell":4000}'::jsonb not null,
  pricing_mode text default 'level_pricing' not null
    check (pricing_mode in ('level_pricing', 'sqft_pricing')),
  sqft_rates jsonb default '{"wall":0,"roof":0}'::jsonb not null,

  -- Warehouse foam stock (global counts per company)
  open_cell_sets numeric(10,2) default 0 not null,
  closed_cell_sets numeric(10,2) default 0 not null
);

-- 2. COMPANY_MEMBERS — multi-tenant user ↔ company mapping
create table public.company_members (
  id uuid default uuid_generate_v7() primary key,
  company_id uuid references public.companies(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null default 'admin'
    check (role in ('owner', 'admin', 'crew')),
  crew_name text,
  crew_pin text,
  lead_name text,
  phone text,
  truck_info text,
  status text default 'Active' not null
    check (status in ('Active', 'Inactive')),
  created_at timestamptz default now() not null,

  unique(company_id, user_id)
);
create index company_members_company_id_idx on public.company_members(company_id);
create index company_members_user_id_idx on public.company_members(user_id);

-- 3. CUSTOMERS — per-company CRM
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
  status text default 'Active' not null
    check (status in ('Active', 'Archived')),
  created_at timestamptz default now() not null
);
create index customers_company_id_idx on public.customers(company_id);
create index customers_company_status_idx on public.customers(company_id, status);

-- 4. ESTIMATES — the core business object
create table public.estimates (
  id uuid default uuid_generate_v7() primary key,
  company_id uuid references public.companies(id) on delete cascade not null,
  customer_id uuid references public.customers(id) on delete set null,

  -- Queryable summary columns (fast listing without parsing JSON)
  status text default 'Draft' not null
    check (status in ('Draft', 'Work Order', 'Invoiced', 'Paid', 'Archived')),
  execution_status text default 'Not Started' not null
    check (execution_status in ('Not Started', 'In Progress', 'Completed')),
  total_value numeric(12,2) default 0 not null,
  invoice_number text,
  date timestamptz default now() not null,
  scheduled_date timestamptz,
  invoice_date timestamptz,
  payment_terms text default 'Due on Receipt',
  assigned_crew_id uuid references public.company_members(id) on delete set null,
  notes text,

  -- Full data blobs (read/written as a unit)
  customer_snapshot jsonb not null default '{}'::jsonb,
  inputs jsonb not null default '{}'::jsonb,
  results jsonb not null default '{}'::jsonb,
  materials jsonb not null default '{}'::jsonb,
  wall_settings jsonb not null default '{}'::jsonb,
  roof_settings jsonb not null default '{}'::jsonb,
  expenses jsonb not null default '{}'::jsonb,
  actuals jsonb,
  financials jsonb,

  -- Pricing snapshot
  pricing_mode text,
  sqft_rates jsonb,

  -- File links
  pdf_url text,
  work_order_url text,

  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
create index estimates_company_id_idx on public.estimates(company_id);
create index estimates_customer_id_idx on public.estimates(customer_id);
create index estimates_company_status_idx on public.estimates(company_id, status);
create index estimates_assigned_crew_idx on public.estimates(assigned_crew_id);
-- Partial index: quickly find jobs ready for crew
create index estimates_active_work_orders_idx
  on public.estimates(company_id, assigned_crew_id)
  where status = 'Work Order' and execution_status != 'Completed';

-- 5. WAREHOUSE_ITEMS — per-company inventory catalog
create table public.warehouse_items (
  id uuid default uuid_generate_v7() primary key,
  company_id uuid references public.companies(id) on delete cascade not null,
  name text not null,
  quantity numeric(10,2) default 0 not null,
  unit text default 'Units' not null,
  unit_cost numeric(10,2) default 0 not null,
  min_level numeric(10,2) default 0 not null,
  created_at timestamptz default now() not null
);
create index warehouse_items_company_id_idx on public.warehouse_items(company_id);

-- 6. MATERIAL_LOGS — per-job material usage ledger
create table public.material_logs (
  id uuid default uuid_generate_v7() primary key,
  company_id uuid references public.companies(id) on delete cascade not null,
  estimate_id uuid references public.estimates(id) on delete set null,
  customer_name text,
  material_name text not null,
  quantity numeric(10,2) not null,
  unit text default 'Units' not null,
  logged_by text,
  logged_at timestamptz default now() not null
);
create index material_logs_company_id_idx on public.material_logs(company_id);
create index material_logs_estimate_id_idx on public.material_logs(estimate_id);

-- 7. PROFIT_LOSS — payment records for financial reporting
create table public.profit_loss (
  id uuid default uuid_generate_v7() primary key,
  company_id uuid references public.companies(id) on delete cascade not null,
  estimate_id uuid references public.estimates(id) on delete set null,
  customer_name text,
  invoice_number text,
  date_paid timestamptz default now() not null,
  revenue numeric(12,2) default 0 not null,
  chem_cost numeric(12,2) default 0 not null,
  labor_cost numeric(12,2) default 0 not null,
  inventory_cost numeric(12,2) default 0 not null,
  misc_cost numeric(12,2) default 0 not null,
  total_cogs numeric(12,2) default 0 not null,
  net_profit numeric(12,2) default 0 not null,
  margin numeric(5,4) default 0 not null
);
create index profit_loss_company_id_idx on public.profit_loss(company_id);
create index profit_loss_estimate_id_idx on public.profit_loss(estimate_id);

-- 8. PURCHASE_ORDERS — material ordering history
create table public.purchase_orders (
  id uuid default uuid_generate_v7() primary key,
  company_id uuid references public.companies(id) on delete cascade not null,
  date timestamptz default now() not null,
  vendor_name text not null default '',
  status text default 'Ordered' not null
    check (status in ('Ordered', 'Received')),
  items jsonb not null default '[]'::jsonb,
  total_cost numeric(12,2) default 0 not null,
  notes text,
  created_at timestamptz default now() not null
);
create index purchase_orders_company_id_idx on public.purchase_orders(company_id);

-- 9. TRIAL_MEMBERSHIPS — public lead capture
create table public.trial_memberships (
  id uuid default uuid_generate_v7() primary key,
  name text not null,
  email text not null,
  phone text,
  created_at timestamptz default now() not null
);

-- ============================================================
-- AUTO-UPDATE TRIGGER: estimates.updated_at
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger estimates_updated_at
  before update on public.estimates
  for each row execute function public.handle_updated_at();

-- ============================================================
-- AUTO-CREATE COMPANY ON SIGNUP TRIGGER
-- When a new auth user signs up, auto-create company + membership
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_company_id uuid;
  company_name text;
begin
  company_name := coalesce(
    new.raw_user_meta_data ->> 'company_name',
    split_part(new.email, '@', 1)
  );

  insert into public.companies (name, profile)
  values (
    company_name,
    jsonb_build_object('companyName', company_name)
  )
  returning id into new_company_id;

  insert into public.company_members (company_id, user_id, role)
  values (new_company_id, new.id, 'admin');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- RLS HELPER: get current user's company_id (cached per query)
-- Uses (select ...) pattern per security-rls-performance best practice
-- ============================================================
create or replace function public.get_my_company_id()
returns uuid
language sql
security definer
set search_path = ''
stable
as $$
  select company_id
  from public.company_members
  where user_id = (select auth.uid())
  limit 1;
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all tables
alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.customers enable row level security;
alter table public.estimates enable row level security;
alter table public.warehouse_items enable row level security;
alter table public.material_logs enable row level security;
alter table public.profit_loss enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.trial_memberships enable row level security;

-- === COMPANIES ===
create policy "companies_select"
  on public.companies for select to authenticated
  using (id = (select public.get_my_company_id()));

create policy "companies_update"
  on public.companies for update to authenticated
  using (id = (select public.get_my_company_id()))
  with check (id = (select public.get_my_company_id()));

-- === COMPANY_MEMBERS ===
-- All members can see their teammates
create policy "members_select"
  on public.company_members for select to authenticated
  using (company_id = (select public.get_my_company_id()));

-- Only admins/owners can manage crew members
create policy "members_insert"
  on public.company_members for insert to authenticated
  with check (
    company_id = (select public.get_my_company_id())
    and exists (
      select 1 from public.company_members
      where user_id = (select auth.uid())
        and role in ('owner', 'admin')
    )
  );

create policy "members_update"
  on public.company_members for update to authenticated
  using (
    company_id = (select public.get_my_company_id())
    and exists (
      select 1 from public.company_members
      where user_id = (select auth.uid())
        and role in ('owner', 'admin')
    )
  )
  with check (company_id = (select public.get_my_company_id()));

create policy "members_delete"
  on public.company_members for delete to authenticated
  using (
    company_id = (select public.get_my_company_id())
    and exists (
      select 1 from public.company_members
      where user_id = (select auth.uid())
        and role in ('owner', 'admin')
    )
  );

-- === CUSTOMERS ===
create policy "customers_all"
  on public.customers for all to authenticated
  using (company_id = (select public.get_my_company_id()))
  with check (company_id = (select public.get_my_company_id()));

-- === ESTIMATES ===
create policy "estimates_all"
  on public.estimates for all to authenticated
  using (company_id = (select public.get_my_company_id()))
  with check (company_id = (select public.get_my_company_id()));

-- === WAREHOUSE_ITEMS ===
create policy "warehouse_items_all"
  on public.warehouse_items for all to authenticated
  using (company_id = (select public.get_my_company_id()))
  with check (company_id = (select public.get_my_company_id()));

-- === MATERIAL_LOGS ===
create policy "material_logs_all"
  on public.material_logs for all to authenticated
  using (company_id = (select public.get_my_company_id()))
  with check (company_id = (select public.get_my_company_id()));

-- === PROFIT_LOSS ===
create policy "profit_loss_all"
  on public.profit_loss for all to authenticated
  using (company_id = (select public.get_my_company_id()))
  with check (company_id = (select public.get_my_company_id()));

-- === PURCHASE_ORDERS ===
create policy "purchase_orders_all"
  on public.purchase_orders for all to authenticated
  using (company_id = (select public.get_my_company_id()))
  with check (company_id = (select public.get_my_company_id()));

-- === TRIAL_MEMBERSHIPS ===
create policy "trial_insert"
  on public.trial_memberships for insert to anon, authenticated
  with check (true);

-- ============================================================
-- STORAGE: PDF bucket
-- ============================================================
insert into storage.buckets (id, name, public)
values ('pdfs', 'pdfs', true)
on conflict (id) do nothing;

create policy "Authenticated users upload PDFs"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'pdfs');

create policy "Public PDF read"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'pdfs');
