-- ═══════════════════════════════════════════════════════════════
-- TT Brothers · Migration 0003
-- Commerce: customers (guest-friendly), orders, order_items,
-- payments (idempotency anchor for Paystack).
--
-- MONEY CONVENTION: BIGINT pesewas throughout.
-- ═══════════════════════════════════════════════════════════════

-- ── Customers ───────────────────────────────────────────────────
-- V1 checkout is guest-first; a customer row is upserted by the
-- server on each order (matched by email). user_id stays null until
-- customer accounts exist, then links purchase history to the login.
create table public.customers (
  id           uuid primary key default gen_random_uuid(),
  email        citext,
  phone        text,
  full_name    text,
  user_id      uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint customers_email_or_phone check (email is not null or phone is not null)
);

comment on table public.customers is
  'Guest-derived customer records; one per unique email/phone. Links to auth.users later.';
create unique index customers_email_key on public.customers (lower(email::text))
  where email is not null;
create index customers_user_idx on public.customers (user_id);

create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

-- ── Orders ──────────────────────────────────────────────────────
create table public.orders (
  id                    uuid primary key default gen_random_uuid(),
  order_number          text not null unique
                          default public.generate_order_number(),
  customer_id           uuid references public.customers (id) on delete set null,

  -- Delivery snapshot (denormalized on purpose — never mutates later)
  customer_name         text not null,
  customer_email        text not null,
  customer_phone        text not null,
  region                text not null,
  city                  text not null,
  delivery_address      text not null,
  delivery_instructions text,

  -- Money in pesewas; total is DB-guaranteed consistent
  subtotal              bigint not null default 0 check (subtotal >= 0),
  delivery_fee          bigint not null default 0 check (delivery_fee >= 0),
  total                 bigint not null check (total >= 0),
  currency              text not null default 'GHS' check (currency = 'GHS'),
  constraint orders_total_math check (total = subtotal + delivery_fee),

  payment_status        public.payment_status not null default 'PENDING',
  order_status          public.order_status not null default 'PENDING',
  paystack_reference    text unique,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on column public.orders.total is 'subtotal + delivery_fee, in pesewas.';
comment on column public.orders.paystack_reference is
  'Reference we generate server-side before initializing Paystack.';
create index orders_payment_status_idx on public.orders (payment_status);
create index orders_order_status_idx on public.orders (order_status);
create index orders_created_idx on public.orders (created_at desc);
create index orders_customer_idx on public.orders (customer_id);

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- ── Order items ─────────────────────────────────────────────────
-- Snapshot semantics: names/prices frozen at purchase time so later
-- catalog edits never rewrite history.
create table public.order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders (id) on delete cascade,
  product_id   uuid references public.products (id) on delete set null,
  variant_id   uuid references public.product_variants (id) on delete set null,
  product_name text not null,
  variant_name text not null,
  quantity     integer not null check (quantity > 0),
  unit_price   bigint not null check (unit_price >= 0),
  subtotal     bigint not null check (subtotal >= 0),
  constraint order_item_subtotal_math check (subtotal = unit_price * quantity)
);

create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);
create index order_items_variant_idx on public.order_items (variant_id);

-- ── Payments ────────────────────────────────────────────────────
-- One row per Paystack transaction attempt; paystack_reference is
-- globally unique → webhook/callback replays hit ON CONFLICT and
-- cannot double-apply. Verification snapshots are stored verbatim.
create table public.payments (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null references public.orders (id) on delete cascade,
  paystack_reference text not null unique,
  amount             bigint not null check (amount >= 0),
  currency           text not null default 'GHS' check (currency = 'GHS'),
  channel            text,
  gateway_response   text,
  status             public.payment_status not null default 'PENDING',
  paid_at            timestamptz,
  verified_at        timestamptz,
  metadata           jsonb,
  created_at         timestamptz not null default now()
);

comment on table public.payments is
  'Server-verified Paystack transactions. The unique reference makes processing idempotent.';
create index payments_order_idx on public.payments (order_id);
create index payments_status_idx on public.payments (status);
