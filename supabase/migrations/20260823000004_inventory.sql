-- ═══════════════════════════════════════════════════════════════
-- TT Brothers · Migration 0004
-- Inventory: audit trail + the ONLY sanctioned way to mutate stock.
--
-- adjust_variant_stock() performs a single guarded UPDATE; Postgres
-- row-level locking serializes concurrent buyers, so overselling is
-- impossible at the database level — not just in app code.
-- ═══════════════════════════════════════════════════════════════

create table public.inventory_movements (
  id         uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  delta      integer not null check (delta <> 0),
  reason     public.inventory_reason not null,
  order_id   uuid references public.orders (id) on delete set null,
  note       text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index movements_variant_idx on public.inventory_movements (variant_id, created_at desc);
create index movements_order_idx on public.inventory_movements (order_id);

create or replace function public.adjust_variant_stock(
  p_variant_id uuid,
  p_delta      integer,
  p_reason     public.inventory_reason,
  p_order_id   uuid default null,
  p_note       text default null,
  p_actor      uuid default null
)
returns integer -- resulting stock_quantity
language plpgsql
volatile
as $$
declare
  v_new_stock integer;
begin
  if p_delta = 0 then
    raise exception 'Stock delta cannot be zero';
  end if;

  update public.product_variants
     set stock_quantity = stock_quantity + p_delta
   where id = p_variant_id
     and active
     and stock_quantity + p_delta >= 0
  returning stock_quantity into v_new_stock;

  if v_new_stock is null then
    raise exception 'INSUFFICIENT_OR_INACTIVE_VARIANT: %', p_variant_id;
  end if;

  insert into public.inventory_movements (variant_id, delta, reason, order_id, note, created_by)
  values (p_variant_id, p_delta, p_reason, p_order_id, p_note, p_actor);

  return v_new_stock;
end;
$$;

comment on function public.adjust_variant_stock(uuid, integer, public.inventory_reason, uuid, text, uuid) is
  'Atomically applies a stock delta. Fails when it would drive stock below zero.
   Concurrent calls serialize on the variant row → no overselling. Always audited.';
