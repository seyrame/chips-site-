-- ═══════════════════════════════════════════════════════════════
-- TT Brothers · Migration 0011
-- Fulfilment tooling:
--   · update_order_status()   — guarded lifecycle transitions with
--                               atomic restock on cancellation.
--   · mark_order_refunded()   — flips the PAID payment + order to
--                               REFUNDED after a successful Paystack
--                               refund API call.
--
-- Both run as SECURITY DEFINER and are executable ONLY by the
-- service role (server actions), mirroring the payment pipeline.
-- ═══════════════════════════════════════════════════════════════

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
  v_current public.order_status;
  item      record;
begin
  if p_next not in ('PENDING','CONFIRMED','PREPARING','DISPATCHED','DELIVERED','CANCELLED') then
    raise exception 'INVALID_STATUS: %', p_next;
  end if;

  select o.order_status into v_current
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
    -- Exactly-once restock: the transition guard above guarantees we
    -- can only get here from a non-CANCELLED state while holding the
    -- row lock. Inactive/deleted variants are skipped rather than
    -- blocking the cancellation (their inventory is untracked).
    for item in
      select oi.variant_id, oi.quantity, oi.product_name, oi.variant_name
        from public.order_items oi
       where oi.order_id = p_order_id
         and oi.variant_id is not null
    loop
      begin
        perform public.adjust_variant_stock(
          p_variant_id => item.variant_id,
          p_delta      => item.quantity,
          p_reason     => 'ORDER_CANCELLED_RESTOCK',
          p_order_id   => p_order_id,
          p_note       => format('Restock: %s (%s) cancelled', item.product_name, item.variant_name)
        );
      exception
        when others then
          -- INSUFFICIENT_OR_INACTIVE_VARIANT etc: never block a
          -- cancellation on an untrackable variant.
          null;
      end;
    end loop;
  end if;

  update public.orders
     set order_status = p_next::public.order_status
   where id = p_order_id;

  return p_next::public.order_status;
end;
$$;

comment on function public.update_order_status(uuid, text) is
  'Validated fulfilment transitions; atomically restocks items when an order is cancelled.';

create or replace function public.mark_order_refunded(
  p_order_id uuid,
  p_snapshot jsonb default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  -- Idempotency guard: no PAID attempt left → nothing to refund.
  update public.payments
     set status     = 'REFUNDED',
         metadata   = coalesce(metadata, '{}'::jsonb)
                      || jsonb_build_object('refunded_at', now())
                      || coalesce(p_snapshot, '{}'::jsonb)
   where payments.order_id = p_order_id
     and payments.status = 'PAID';
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'ORDER_NOT_PAID';
  end if;

  update public.orders
     set payment_status = 'REFUNDED'
   where orders.id = p_order_id;

  return true;
end;
$$;

comment on function public.mark_order_refunded(uuid, jsonb) is
  'Marks the PAID payment(s) of an order REFUNDED. Call only after Paystack accepted the refund.';

-- ── Privileges ──────────────────────────────────────────────────
revoke all on function public.update_order_status(uuid, text)
  from public, anon, authenticated;
revoke all on function public.mark_order_refunded(uuid, jsonb)
  from public, anon, authenticated;

grant execute on function public.update_order_status(uuid, text) to service_role;
grant execute on function public.mark_order_refunded(uuid, jsonb) to service_role;
