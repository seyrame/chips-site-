-- Migration: Add idempotency key to place_order to prevent double-submit.
-- Creates a unique index on idempotency_key and modifies place_order to
-- accept an optional key. If a duplicate key is detected, returns the
-- existing order instead of creating a new one.
--
-- Fixes from earlier overloads:
--   - Restores _cart_lines merge for duplicate variant IDs
--   - Restores payment intent creation (INSERT INTO payments)
--   - Restores variant_name + product_id in order_items snapshot
--   - Restores max-length validation on customer fields
--   - Restores p_order_id in adjust_variant_stock calls
--   - Adds REVOKE/GRANT for the new 5-param overload

-- Store idempotency keys on orders (nullable; only set for double-submit protection).
alter table public.orders
  add column if not exists idempotency_key uuid;

-- Unique index: only one order per idempotency key. Partial index so
-- nulls (orders without a key) don't conflict.
create unique index if not exists orders_idempotency_key_unique
  on public.orders (idempotency_key)
  where idempotency_key is not null;

-- Replace place_order with the idempotency-aware version.
create or replace function public.place_order(
  p_items              jsonb,
  p_customer           jsonb,
  p_region_id          uuid default null,
  p_paystack_reference text default null,
  p_idempotency_key    uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_customer_name text;
  v_email         text;
  v_phone         text;
  v_region        text;
  v_city          text;
  v_address       text;
  v_instructions  text;

  v_item          jsonb;
  v_qty           integer;
  v_requested     integer;

  v_subtotal      bigint := 0;
  v_delivery_fee  bigint;
  v_free_at       bigint;
  v_default_fee   bigint;

  v_order_id      uuid;
  v_order_number  text;
  v_product       record;
  v_existing      record;
begin
  -- ── Idempotency short-circuit ────────────────────────────────
  if p_idempotency_key is not null then
    select id, order_number into v_existing
    from orders
    where idempotency_key = p_idempotency_key
    limit 1;

    if found then
      return jsonb_build_object(
        'order_id',     v_existing.id,
        'order_number', v_existing.order_number,
        'total',        (select total from orders where id = v_existing.id),
        'idempotent',   true
      );
    end if;
  end if;

  -- ── Validate customer payload ────────────────────────────────
  v_customer_name := nullif(trim(coalesce(p_customer->>'full_name', '')), '');
  v_email         := nullif(lower(trim(coalesce(p_customer->>'email', ''))), '');
  v_phone         := nullif(trim(coalesce(p_customer->>'phone', '')), '');
  v_region        := nullif(trim(coalesce(p_customer->>'region', '')), '');
  v_city          := nullif(trim(coalesce(p_customer->>'city', '')), '');
  v_address       := nullif(trim(coalesce(p_customer->>'delivery_address', '')), '');
  v_instructions  := nullif(trim(coalesce(p_customer->>'delivery_instructions', '')), '');

  if v_customer_name is null or length(v_customer_name) < 2 or length(v_customer_name) > 120 then
    raise exception 'INVALID_CUSTOMER_NAME';
  end if;
  if v_email is null or v_email !~ '^[^@]+@[^@]+\.[^@]+$' or length(v_email) > 200 then
    raise exception 'INVALID_EMAIL';
  end if;
  if v_phone is null or v_phone !~ '^\+?[0-9][0-9\s\-]{7,20}$' or length(v_phone) > 30 then
    raise exception 'INVALID_PHONE';
  end if;
  if v_region is null or length(v_region) < 1 or length(v_region) > 80 then
    raise exception 'INVALID_REGION';
  end if;
  if v_city is null or length(v_city) < 1 or length(v_city) > 80 then
    raise exception 'INVALID_CITY';
  end if;
  if v_address is null or length(v_address) < 5 or length(v_address) > 300 then
    raise exception 'INVALID_ADDRESS';
  end if;
  if v_instructions is not null and length(v_instructions) > 500 then
    raise exception 'INVALID_INSTRUCTIONS';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_CART';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'TOO_MANY_ITEMS';
  end if;

  -- ── Validate + merge cart items (deduplicate variant IDs) ────
  create temp table _cart_lines (
    variant_id uuid primary key,
    quantity   integer not null
  ) on commit drop;

  for v_item in select * from jsonb_array_elements(p_items) loop
    begin
      v_qty := (v_item->>'quantity')::integer;
    exception when others then
      raise exception 'INVALID_QUANTITY';
    end;
    if v_qty < 1 or v_qty > 99 then
      raise exception 'INVALID_QUANTITY';
    end if;

    begin
      insert into _cart_lines (variant_id, quantity)
      values ((v_item->>'variant_id')::uuid, v_qty)
      on conflict (variant_id) do update
        set quantity = _cart_lines.quantity + excluded.quantity;
    exception when invalid_text_representation or invalid_parameter_value then
      raise exception 'INVALID_VARIANT_ID';
    end;
  end loop;

  -- Merged quantities must still be sane (e.g. two 60-unit lines).
  if exists (select 1 from _cart_lines where quantity > 99) then
    raise exception 'INVALID_QUANTITY';
  end if;

  -- ── Price authoritatively + lock stock rows ─────────────────
  -- FOR UPDATE serializes concurrent checkouts on the same variants.
  for v_product in
    select v.id,
           v.name          as variant_name,
           v.price,
           v.stock_quantity,
           p.id            as product_id,
           p.name          as product_name,
           p.active        as product_active
    from product_variants v
    join products p on p.id = v.product_id
    where v.id in (select variant_id from _cart_lines)
    for update of v
  loop
    select quantity into v_requested from _cart_lines where variant_id = v_product.id;

    if not v_product.product_active then
      raise exception 'VARIANT_UNAVAILABLE: %', v_product.variant_name;
    end if;
    if not exists (
      select 1 from product_variants
      where id = v_product.id and active
    ) then
      raise exception 'VARIANT_UNAVAILABLE: %', v_product.variant_name;
    end if;
    if v_product.stock_quantity < v_requested then
      raise exception 'INSUFFICIENT_STOCK: %', v_product.variant_name;
    end if;

    v_subtotal := v_subtotal + (v_product.price * v_requested);
  end loop;

  if not found then
    raise exception 'NO_VALID_ITEMS';
  end if;

  -- ── Resolve delivery fee ─────────────────────────────────────
  select default_fee, free_delivery_threshold
    into v_default_fee, v_free_at
  from delivery_settings
  where id = true;

  v_delivery_fee := coalesce(v_default_fee, 0);

  if p_region_id is not null then
    perform 1 from delivery_regions
    where id = p_region_id and active and lower(region) = lower(v_region);
    if not found then
      raise exception 'INVALID_REGION_ID';
    end if;
    select fee into v_delivery_fee
    from delivery_regions where id = p_region_id;
  end if;

  if v_free_at is not null and v_subtotal >= v_free_at then
    v_delivery_fee := 0;
  end if;

  -- ── Customer upsert (by email; guests share one record) ─────
  insert into customers (email, phone, full_name)
  values (v_email, v_phone, v_customer_name)
  on conflict (lower(email::text)) where email is not null do update
    set phone = coalesce(excluded.phone, customers.phone),
        full_name = coalesce(excluded.full_name, customers.full_name);

  -- ── Order + snapshot items (+ reference when provided) ──────
  insert into orders (
    customer_name, customer_email, customer_phone,
    region, city, delivery_address, delivery_instructions,
    subtotal, delivery_fee, total,
    paystack_reference,
    idempotency_key
  ) values (
    v_customer_name, v_email, v_phone,
    v_region, v_city, v_address, v_instructions,
    v_subtotal, v_delivery_fee, v_subtotal + v_delivery_fee,
    p_paystack_reference,
    p_idempotency_key
  )
  returning id, order_number into v_order_id, v_order_number;

  -- ── Snapshot order items from merged cart ────────────────────
  insert into order_items (
    order_id, product_id, variant_id,
    product_name, variant_name, quantity, unit_price, subtotal
  )
  select
    v_order_id,
    prod.product_id,
    line.variant_id,
    prod.product_name,
    prod.variant_name,
    line.quantity,
    prod.price,
    prod.price * line.quantity
  from _cart_lines line
  join (
    select v.id, v.name as variant_name, v.price,
           p.id as product_id, p.name as product_name
    from product_variants v
    join products p on p.id = v.product_id
  ) prod on prod.id = line.variant_id;

  -- ── Payment intent (idempotency anchor for settlement) ──────
  if p_paystack_reference is not null then
    insert into payments (
      order_id, paystack_reference, amount, currency, status
    ) values (
      v_order_id,
      p_paystack_reference,
      v_subtotal + v_delivery_fee,
      'GHS',
      'PENDING'
    );
  end if;

  -- ── Audited stock decrements (ORDER_PLACED reason) ──────────
  for v_item in select * from _cart_lines loop
    perform public.adjust_variant_stock(
      p_variant_id => v_item.variant_id,
      p_delta      => -v_item.quantity,
      p_reason     => 'ORDER_PLACED',
      p_order_id   => v_order_id
    );
  end loop;

  return jsonb_build_object(
    'order_id',     v_order_id,
    'order_number', v_order_number,
    'total',        v_subtotal + v_delivery_fee
  );
end;
$$;

-- Trusted-server-only: PUBLIC loses execute by default; service_role is
-- granted back explicitly so the pipeline never depends on ambient
-- default privileges (Supabase or otherwise).
revoke execute on function public.place_order(jsonb, jsonb, uuid, text, uuid)
  from anon, authenticated, public;
grant execute on function public.place_order(jsonb, jsonb, uuid, text, uuid)
  to service_role;

comment on function public.place_order(jsonb, jsonb, uuid, text, uuid) is
  'Atomic guest checkout (idempotent): authoritative pricing, stock guard, customer upsert, order snapshot, payment intent, audited decrements. With p_idempotency_key: deduplicates concurrent double-submits. Service-role pipeline only.';
