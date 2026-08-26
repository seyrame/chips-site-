-- ═══════════════════════════════════════════════════════════════
-- TT Brothers · Migration 0006
-- Profiles, role helpers, and Row Level Security everywhere.
--
-- MODEL
--   anon                → read ACTIVE catalog only. Zero writes.
--   STAFF               → + read business data (orders, payments…)
--   ADMIN / OWNER       → + manage catalog & orders
--   service_role        → server-side only; bypasses RLS for the
--                         validated checkout/payment pipeline.
--
-- profiles.role IS NULL ⇒ ordinary authenticated user (e.g. future
-- customer accounts): NO staff privileges. Privilege comes only
-- from an explicit OWNER/ADMIN/STAFF role set at invite time.
-- ═══════════════════════════════════════════════════════════════

-- ── Profiles ────────────────────────────────────────────────────
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  role       public.user_role,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.profiles.role is
  'NULL = unprivileged user. OWNER/ADMIN manage everything; STAFF is read-only.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-profile on signup: only privileged when the INVITE carries a
-- role in its metadata. Open signups stay harmless.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  -- SECURITY: Never read roles from signup metadata. Roles are
  -- assigned exclusively by existing admins through server-side
  -- operations. Reading raw_user_meta_data allowed any anonymous
  -- visitor to escalate to OWNER by calling signUp({ data: { role: 'OWNER' } }).
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Role helpers ────────────────────────────────────────────────
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role is not null
  );
$$;

create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('OWNER', 'ADMIN')
  );
$$;

comment on function public.is_staff() is 'True for any authenticated user holding a staff role.';
comment on function public.is_manager() is 'True for OWNER/ADMIN — full management rights.';

-- ── Enable RLS on every table ───────────────────────────────────
alter table public.categories          enable row level security;
alter table public.products            enable row level security;
alter table public.product_variants    enable row level security;
alter table public.product_images      enable row level security;
alter table public.customers           enable row level security;
alter table public.orders              enable row level security;
alter table public.order_items         enable row level security;
alter table public.payments            enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.delivery_regions    enable row level security;
alter table public.delivery_settings   enable row level security;
alter table public.app_settings        enable row level security;
alter table public.profiles            enable row level security;

-- ═══════════════════════════════════════════════════════════════
-- PUBLIC CATALOG READS (anon + authenticated)
-- ═══════════════════════════════════════════════════════════════

create policy "Public reads active categories"
  on public.categories for select
  using (active);

create policy "Public reads active products"
  on public.products for select
  using (active);

create policy "Public reads variants of active products"
  on public.product_variants for select
  using (
    active
    and exists (
      select 1 from public.products p
      where p.id = product_id and p.active
    )
  );

create policy "Public reads images of active products"
  on public.product_images for select
  using (
    exists (
      select 1 from public.products p
      where p.id = product_id and p.active
    )
  );

create policy "Public reads active delivery regions"
  on public.delivery_regions for select
  using (active);

create policy "Public reads app settings under public.*"
  on public.app_settings for select
  using (key like 'public.%');

-- ═══════════════════════════════════════════════════════════════
-- STAFF READS (business data)
-- Orders/items/payments/customers/movements have NO anon policies —
-- guests track orders exclusively through server route handlers.
-- ═══════════════════════════════════════════════════════════════

create policy "Staff reads orders"           on public.orders            for select using ((select public.is_staff()));
create policy "Staff reads order items"      on public.order_items       for select using ((select public.is_staff()));
create policy "Staff reads payments"         on public.payments          for select using ((select public.is_staff()));
create policy "Staff reads customers"        on public.customers         for select using ((select public.is_staff()));
create policy "Staff reads movements"        on public.inventory_movements for select using ((select public.is_staff()));
create policy "Staff reads delivery settings" on public.delivery_settings for select using ((select public.is_staff()));
create policy "Staff reads all settings"     on public.app_settings      for select using ((select public.is_staff()));
create policy "Staff reads inactive catalog" on public.categories        for select using ((select public.is_staff()));
create policy "Staff reads inactive products" on public.products         for select using ((select public.is_staff()));
create policy "Staff reads inactive variants" on public.product_variants for select using ((select public.is_staff()));

-- ═══════════════════════════════════════════════════════════════
-- MANAGER WRITES
-- ═══════════════════════════════════════════════════════════════

-- Catalog management
create policy "Managers create categories"       on public.categories       for insert with check ((select public.is_manager()));
create policy "Managers update categories"       on public.categories       for update using ((select public.is_manager()));
create policy "Managers delete categories"       on public.categories       for delete using ((select public.is_manager()));
create policy "Managers create products"         on public.products         for insert with check ((select public.is_manager()));
create policy "Managers update products"         on public.products         for update using ((select public.is_manager()));
create policy "Managers delete products"         on public.products         for delete using ((select public.is_manager()));
create policy "Managers create variants"         on public.product_variants for insert with check ((select public.is_manager()));
create policy "Managers update variants"         on public.product_variants for update using ((select public.is_manager()));
create policy "Managers delete variants"         on public.product_variants for delete using ((select public.is_manager()));
create policy "Managers create images"           on public.product_images   for insert with check ((select public.is_manager()));
create policy "Managers update images"           on public.product_images   for update using ((select public.is_manager()));
create policy "Managers delete images"           on public.product_images   for delete using ((select public.is_manager()));
create policy "Managers manage delivery regions" on public.delivery_regions for all using ((select public.is_manager())) with check ((select public.is_manager()));
create policy "Managers update delivery settings" on public.delivery_settings for update using ((select public.is_manager()));
create policy "Managers write settings"          on public.app_settings     for all using ((select public.is_manager())) with check ((select public.is_manager()));

-- Order fulfilment (status updates from the dashboard). Creation of
-- orders stays service-role-only: there are intentionally NO insert
-- policies on orders/order_items/payments/inventory_movements for any
-- client identity. Stock adjustments likewise flow through server
-- routes → service role → adjust_variant_stock(), keeping every
-- movement a truthful consequence of a real stock change.
create policy "Managers update orders"    on public.orders    for update using ((select public.is_manager()));

-- ── Profile visibility & role administration ────────────────────
create policy "Users read own profile" on public.profiles for select
  using (id = (select auth.uid()) or (select public.is_staff()));
-- Only OWNER may change roles — prevents admin self-promotion.
create policy "Owner updates roles" on public.profiles for update
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid()) and me.role = 'OWNER'
    )
  );

-- ═══════════════════════════════════════════════════════════════
-- LOCK DOWN SENSITIVE FUNCTIONS
-- Inventory mutation is pipeline-only (service role).
-- ═══════════════════════════════════════════════════════════════
revoke execute on function public.adjust_variant_stock(uuid, integer, public.inventory_reason, uuid, text, uuid)
  from anon, authenticated, public;

-- Hardening: block direct table writes through PostgREST defaults
-- even if a policy were ever misconfigured (defense in depth).
revoke insert, update, delete on all tables in schema public from anon;
