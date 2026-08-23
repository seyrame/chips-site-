-- ═══════════════════════════════════════════════════════════════
-- TT Brothers · Migration 0009
-- Atomic guest checkout pipeline.
--
-- place_order() takes the cart payload + delivery details and does
-- EVERYTHING in one transaction: authoritative pricing from the DB
-- (never the client), stock validation, customer upsert, order +
-- item snapshots, audited stock decrements. Any failure rolls back
-- the whole call — no ghost orders, no oversold variants.
--
-- Called ONLY by the trusted server pipeline (service role), like
-- adjust_variant_stock() before it.
-- ═══════════════════════════════════════════════════════════════

create or replace function public.place_order(
  p_items     jsonb,
  p_customer  jsonb,
  p_region_id uuid default null
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

  v_variant_ids   uuid[];
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
begin
  -- ── Validate customer payload ────────────────────────────────
  v_customer_name := nullif(trim(coalesce(p_customer->>'full_name', '')), '');
  v_email         := nullif(lower(trim(coalesce(p_customer->>'email', ''))), '');
  v_phone         := nullif(trim(coalesce(p_customer->>'phone', '')), '');
  v_region        := nullif(trim(coalesce(p_customer->>'region', '')), '');
  v_city          := nullif(trim(coalesce(p_customer->>'city', '')), '');
  v_address       := nullif(trim(coalesce(p_customer->>'delivery_address', '')), '');
  v_instructions  := nullif(trim(coalesce(p_customer->>'delivery_instructions', '')), '');

  if v_customer_name is null or char_length(v_customer_name) > 120 then
    raise exception 'INVALID_CUSTOMER_NAME';
  end if;
  if v_email is null or char_length(v_email) > 200
     or v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'INVALID_EMAIL';
  end if;
  if v_phone is null or char_length(v_phone) > 30
     or v_phone !~ '^\+?[0-9][0-9\s\-]{7,20}$' then
    raise exception 'INVALID_PHONE';
  end if;
  if v_region is null or char_length(v_region) > 80 then
    raise exception 'INVALID_REGION';
  end if;
  if v_city is null or char_length(v_city) > 80 then
    raise exception 'INVALID_CITY';
  end if;
  if v_address is null or char_length(v_address) > 300 then
    raise exception 'INVALID_ADDRESS';
  end if;
  v_instructions := left(coalesce(v_instructions, ''), 500);

  -- ── Validate + merge cart items ─────────────────────────────
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_CART';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'TOO_MANY_ITEMS';
  end if;

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
    -- Note: inactive variants simply won't be purchasable through the
    -- storefront, but a stale client could still send one.
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

  -- ── Delivery fee resolution ─────────────────────────────────
  -- Region match (must be active) else shop default; free threshold waives.
  select default_fee, free_delivery_threshold
    into v_default_fee, v_free_at
  from delivery_settings
  where id = true;

  if p_region_id is not null then
    perform 1 from delivery_regions
    where id = p_region_id and active and lower(region) = lower(v_region);
    if not found then
      raise exception 'INVALID_REGION_ID';
    end if;
    select fee into v_delivery_fee
    from delivery_regions where id = p_region_id;
  else
    v_delivery_fee := coalesce(v_default_fee, 0);
  end if;

  if v_free_at is not null and v_subtotal >= v_free_at then
    v_delivery_fee := 0;
  end if;

  -- ── Customer upsert (by email; guests share one record) ─────
  insert into customers (email, phone, full_name)
  values (v_email, v_phone, v_customer_name)
  on conflict (lower(email::text)) where email is not null do update
    set phone = coalesce(excluded.phone, customers.phone),
        full_name = coalesce(customers.full_name, excluded.full_name);

  -- ── Order + snapshot items ──────────────────────────────────
  insert into orders (
    customer_name, customer_email, customer_phone,
    region, city, delivery_address, delivery_instructions,
    subtotal, delivery_fee, total
  ) values (
    v_customer_name, v_email, v_phone,
    v_region, v_city, v_address, v_instructions,
    v_subtotal, v_delivery_fee, v_subtotal + v_delivery_fee
  )
  returning id, order_number into v_order_id, v_order_number;

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

  -- ── Audited stock decrements (ORDER_PLACED reason) ──────────
  for v_item in select * from jsonb_array_elements(p_items) loop
    perform public.adjust_variant_stock(
      p_variant_id => (v_item->>'variant_id')::uuid,
      p_delta      => -(v_item->>'quantity')::integer,
      p_reason     => 'ORDER_PLACED',
      p_order_id   => v_order_id
    );
  end loop;

  return jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'subtotal', v_subtotal,
    'delivery_fee', v_delivery_fee,
    'total', v_subtotal + v_delivery_fee
  );
end;
$$;

-- Trusted-server-only, mirroring adjust_variant_stock().
revoke execute on function public.place_order(jsonb, jsonb, uuid)
  from anon, authenticated, public;

comment on function public.place_order(jsonb, jsonb, uuid) is
  'Atomic guest checkout: authoritative pricing, stock guard, customer upsert, order snapshot, audited decrements. Service-role pipeline only.';
