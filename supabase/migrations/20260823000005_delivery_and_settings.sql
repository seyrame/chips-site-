-- ═══════════════════════════════════════════════════════════════
-- TT Brothers · Migration 0005
-- Delivery configuration + app settings. Fees and thresholds are
-- DATA, never hard-coded in the application.
--
-- MONEY CONVENTION: BIGINT pesewas.
-- ═══════════════════════════════════════════════════════════════

-- Region-level fees. City rows may be added later for finer control:
-- the checkout resolver picks city match first, then region, then default.
create table public.delivery_regions (
  id         uuid primary key default gen_random_uuid(),
  region     text not null,
  fee        bigint not null check (fee >= 0),
  active     boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.delivery_regions.fee is 'Delivery fee in pesewas for this region.';
create unique index delivery_regions_region_key on public.delivery_regions (lower(region));

create trigger delivery_regions_set_updated_at
  before update on public.delivery_regions
  for each row execute function public.set_updated_at();

-- Singleton row of shop-wide delivery rules.
create table public.delivery_settings (
  id                            boolean primary key default true check (id = true),
  default_fee                   bigint not null default 0 check (default_fee >= 0),
  free_delivery_threshold       bigint check (free_delivery_threshold is null or free_delivery_threshold > 0),
  updated_at                    timestamptz not null default now()
);

comment on table public.delivery_settings is
  'Singleton: exactly one row. default_fee applies when no region matches; free_delivery_threshold (pesewas) waives fees at/above it.';
create trigger delivery_settings_set_updated_at
  before update on public.delivery_settings
  for each row execute function public.set_updated_at();

-- Ensure the singleton exists from day one.
insert into public.delivery_settings (id, default_fee)
values (true, 0)
on conflict (id) do nothing;

-- ── App settings ────────────────────────────────────────────────
-- Key/value store for business config (WhatsApp number, support
-- message, etc.). Keys prefixed 'public.' are readable by anyone;
-- everything else is admin-only (enforced by RLS in migration 0006).
create table public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

create trigger app_settings_set_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();
