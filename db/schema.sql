-- Koravo analytics schema (PostgreSQL / Neon / Supabase compatible)
-- Purpose: scalable F&B analytics with fact + dimension modeling.

create extension if not exists "pgcrypto";

create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'Asia/Kolkata',
  currency_code char(3) not null default 'INR',
  created_at timestamptz not null default now()
);

create table if not exists dim_location (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  code text not null,
  name text not null,
  region text,
  created_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create table if not exists dim_channel (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  code text not null,
  name text not null,
  unique (tenant_id, code)
);

create table if not exists dim_product (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  sku text not null,
  name text not null,
  category text,
  subcategory text,
  is_active boolean not null default true,
  unique (tenant_id, sku)
);

create table if not exists fact_sales (
  id bigserial primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  location_id uuid references dim_location(id),
  channel_id uuid references dim_channel(id),
  product_id uuid references dim_product(id),
  business_date date not null,
  order_id text not null,
  quantity numeric(14, 3) not null default 0,
  gross_revenue numeric(14, 2) not null default 0,
  discount_amount numeric(14, 2) not null default 0,
  net_revenue numeric(14, 2) not null default 0,
  cogs_amount numeric(14, 2) not null default 0,
  labor_amount numeric(14, 2) not null default 0,
  waste_amount numeric(14, 2) not null default 0,
  payment_delay_days int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_fact_sales_tenant_date on fact_sales (tenant_id, business_date desc);
create index if not exists idx_fact_sales_tenant_product_date on fact_sales (tenant_id, product_id, business_date desc);
create index if not exists idx_fact_sales_tenant_location_date on fact_sales (tenant_id, location_id, business_date desc);

create table if not exists fact_inventory_daily (
  id bigserial primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  location_id uuid references dim_location(id),
  product_id uuid references dim_product(id),
  business_date date not null,
  opening_qty numeric(14, 3) not null default 0,
  closing_qty numeric(14, 3) not null default 0,
  damaged_qty numeric(14, 3) not null default 0,
  purchase_value numeric(14, 2) not null default 0,
  stock_value numeric(14, 2) not null default 0,
  created_at timestamptz not null default now(),
  unique (tenant_id, location_id, product_id, business_date)
);

create table if not exists analytics_kpi_daily (
  id bigserial primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  location_id uuid references dim_location(id),
  business_date date not null,
  food_cost_pct numeric(8, 3),
  labor_cost_pct numeric(8, 3),
  prime_cost_pct numeric(8, 3),
  avg_check numeric(14, 2),
  table_turns numeric(8, 3),
  repeat_rate_pct numeric(8, 3),
  created_at timestamptz not null default now(),
  unique (tenant_id, location_id, business_date)
);

create table if not exists audit_events (
  id bigserial primary key,
  request_id text not null,
  session_id text not null,
  route text not null,
  model text not null,
  prompt_chars int not null default 0,
  response_chars int not null default 0,
  status text not null check (status in ('ok', 'error')),
  error_code text,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_events_created_at on audit_events (created_at desc);
create index if not exists idx_audit_events_session on audit_events (session_id, created_at desc);

-- Optional partitioning for very high volume:
-- alter table fact_sales partition by range (business_date);
