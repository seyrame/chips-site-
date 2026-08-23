-- ═══════════════════════════════════════════════════════════════
-- TT Brothers · Migration 0001
-- Extensions, domain enums, shared utility functions, sequences.
-- ═══════════════════════════════════════════════════════════════

-- pg_trgm powers product search (Phase 5: name/description fuzzy match)
create extension if not exists pg_trgm;
-- Case-insensitive customer emails
create extension if not exists citext;

-- ── Domain enums ────────────────────────────────────────────────
-- Admin roles. V1 uses OWNER/ADMIN; STAFF exists so future staff
-- accounts get read-only access without another migration.
create type public.user_role as enum ('OWNER', 'ADMIN', 'STAFF');

-- Payment lifecycle. Deliberately separate from order_status:
-- an order can be PAID and PREPARING at the same time.
create type public.payment_status as enum ('PENDING', 'PAID', 'FAILED', 'REFUNDED');

-- Fulfilment lifecycle shown to the customer as a timeline.
create type public.order_status as enum (
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'DISPATCHED',
  'DELIVERED',
  'CANCELLED'
);

-- Audit reasons for inventory movements (see migration 0004).
create type public.inventory_reason as enum (
  'INITIAL_STOCK',
  'ORDER_PLACED',          -- reserved/decremented at checkout verification
  'ORDER_CANCELLED_RESTOCK',
  'ADMIN_ADJUSTMENT'
);

-- ── updated_at maintenance ──────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── Order numbers ───────────────────────────────────────────────
-- Human-readable, non-sequential-looking enough for a small shop,
-- never exposes DB ids. Sequence starts at 1000 → TT-1000…
create sequence public.order_number_seq start 1000;

create or replace function public.generate_order_number()
returns text
language sql
volatile
as $$
  select 'TT-' || nextval('public.order_number_seq')::text;
$$;

comment on function public.generate_order_number() is
  'Generates the next public order number, e.g. TT-1024.';
