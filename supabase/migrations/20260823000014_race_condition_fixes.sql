-- Migration 0014: Fix race conditions and cleanup
-- Addresses: settle_payment FOR UPDATE, cancel-paid guard, drop legacy overload

-- ── 1. settle_payment: lock the order row to prevent lost-update race ──
-- Without FOR UPDATE, expire_pending_orders can cancel the order between
-- settle_payment's read and write, producing a PAID+CANCELLED state.
create or replace function public.settle_payment(
  p_reference    text,
  p_status       text,
  p_amount       bigint,
  p_gateway_resp text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment record;
  v_order   record;
  v_paid    boolean := false;
begin
  -- Lock the payment row first (prevents concurrent settlement).
  select * into v_payment
    from public.payments
   where paystack_reference = p_reference
     for update;

  if not found then
    raise exception 'UNKNOWN_REFERENCE';
  end if;

  -- Lock the order row to prevent concurrent status changes (e.g. expire_pending_orders).
  select * into v_order
    from public.orders
   where id = v_payment.order_id
     for update;

  -- Idempotency: PAID is terminal. FAILED may still become PAID.
  if v_payment.status = 'PAID' then
    return jsonb_build_object(
      'order_id', v_order.id,
      'order_number', v_order.order_number,
      'payment_status', 'PAID',
      'already_settled', true
    );
  end if;

  -- Amount/currency guard: the gateway must agree with our total.
  if p_status = 'success' and p_amount is not null and p_amount > 0 then
    if p_amount >= v_order.total then
      v_paid := true;
    else
      -- Amount mismatch — keep PENDING for human review.
      update public.payments
         set status            = 'PENDING',
             gateway_response  = coalesce(p_gateway_resp, gateway_response),
             updated_at        = now()
       where id = v_payment.id;

      return jsonb_build_object(
        'order_id',      v_order.id,
        'order_number',  v_order.order_number,
        'payment_status', 'PENDING',
        'mismatch',      true
      );
    end if;
  end if;

  if v_paid then
    -- Set payment to PAID.
    update public.payments
       set status            = 'PAID',
           amount            = p_amount,
           gateway_response  = coalesce(p_gateway_resp, gateway_response),
           paid_at           = now(),
           updated_at        = now()
     where id = v_payment.id;

    -- Advance order status only if it hasn't progressed past PENDING/CONFIRMED.
    update public.orders
       set payment_status = 'PAID',
           order_status   = case
             when order_status in ('PENDING', 'CONFIRMED') then 'CONFIRMED'
             else order_status
           end,
           updated_at     = now()
     where id = v_order.id;

    return jsonb_build_object(
      'order_id',      v_order.id,
      'order_number',  v_order.order_number,
      'payment_status', 'PAID',
      'already_settled', false
    );
  else
    -- payment_status = 'FAILED'
    update public.payments
       set status            = 'FAILED',
           gateway_response  = coalesce(p_gateway_resp, gateway_response),
           updated_at        = now()
     where id = v_payment.id;

    return jsonb_build_object(
      'order_id',      v_order.id,
      'order_number',  v_order.order_number,
      'payment_status', 'FAILED',
      'already_settled', false
    );
  end if;
end;
$$;

comment on function public.settle_payment(text, text, bigint, text) is
  'Idempotent payment settlement. Locks both payment and order rows to prevent races with expire_pending_orders.';

-- ── 2. update_order_status: refuse to cancel a PAID order ──
-- Prevents the scenario where expire_pending_orders races with settle_payment,
-- or an admin accidentally cancels an order that was just paid.
create or replace function public.update_order_status(
  p_order_id uuid,
  p_next     text
)
returns public.order_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current      public.order_status;
  v_pay_status   text;
  item           record;
begin
  if p_next not in ('PENDING','CONFIRMED','PREPARING','DISPATCHED','DELIVERED','CANCELLED') then
    raise exception 'INVALID_STATUS: %', p_next;
  end if;

  select o.order_status, o.payment_status into v_current, v_pay_status
    from public.orders o
   where o.id = p_order_id
   for update;

  if v_current is null then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  -- Forward-only lifecycle; cancellation allowed until dispatch.
  -- DELIVERED and CANCELLED are terminal.
  if not (
       (v_current = 'PENDING'
         and p_next in ('CONFIRMED','PREPARING','DISPATCHED','CANCELLED'))
    or (v_current = 'CONFIRMED'
         and p_next in ('PREPARING','DISPATCHED','CANCELLED'))
    or (v_current = 'PREPARING'
         and p_next in ('DISPATCHED','CANCELLED'))
    or (v_current = 'DISPATCHED' and p_next = 'DELIVERED')
  ) then
    raise exception 'INVALID_TRANSITION: % -> %', v_current, p_next;
  end if;

  if p_next = 'CANCELLED' then
    -- Never cancel a PAID order — the admin must refund first.
    if v_pay_status = 'PAID' then
      raise exception 'PAID_ORDER_CANCEL_REQUIRES_REFUND: order % is paid; refund before cancelling', p_order_id;
    end if;

    -- Exactly-once restock.
    for item in
      select oi.variant_id, oi.quantity, oi.product_name, oi.variant_name
        from public.order_items oi
       where oi.order_id = p_order_id
         and oi.variant_id is not null
    loop
      perform public.adjust_variant_stock(
        p_variant_id => item.variant_id,
        p_delta      => item.quantity,
        p_reason     => 'restock',
        p_notes      => format('Order %s cancelled', (select order_number from public.orders where id = p_order_id))
      );
    end loop;
  end if;

  update public.orders
     set order_status = p_next::public.order_status,
         updated_at   = now()
   where id = p_order_id;

  return p_next::public.order_status;
end;
$$;

comment on function public.update_order_status(uuid, text) is
  'Transitions order status through the lifecycle. Refuses to cancel PAID orders — require refund first.';

-- ── 3. Drop legacy 4-param place_order overload ──
-- The 5-param version (migration 0013) has the correct merge logic.
-- The 4-param version (migration 0010) has a stock decrement bug with duplicate variants.
drop function if exists public.place_order(jsonb, jsonb, uuid, text);
