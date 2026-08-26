-- Offline behavioral verification of migration 0011 (fulfilment).
-- Run as superuser against a stub+seed database (vanilla Postgres via
-- Docker) after migrations 0001..0011 and seed.sql. Every check runs
-- inside ON_ERROR_STOP: exit code 0 == all checks passed.

create or replace function public.assert(cond boolean, msg text)
returns void language plpgsql as $a$
begin
  if not cond then raise exception 'ASSERT FAILED: %', msg; end if;
end $a$;

-- Helper: expect a specific SQL error substring from an RPC call.
create or replace function public.expect_error(sql_to_run text, needle text)
returns void language plpgsql as $e$
begin
  execute sql_to_run;
  raise exception 'ASSERT FAILED: expected error containing "%" but statement succeeded', needle;
exception when others then
  if position(needle in SQLERRM) = 0 then
    raise exception 'ASSERT FAILED: expected "%" got "%"', needle, SQLERRM;
  end if;
end $e$;

-- == 1. Happy-path lifecycle PENDING → CONFIRMED → PREPARING → DISPATCHED → DELIVERED ==
begin;
  set local role service_role;
  select public.place_order(
    p_items    := '[{"variant_id":"c0000000-0000-4000-8000-000000000004","quantity":3}]'::jsonb,
    p_customer := '{"full_name":"Ama Flow","email":"ama@flow.gh","phone":"0201112223","region":"Greater Accra","city":"Accra","delivery_address":"1 Flow Lane"}'::jsonb,
    p_region_id:= 'd0000000-0000-4000-8000-000000000001',
    p_paystack_reference := 'TTB-FULFIL-0001'
  ) as o \gset
  select public.settle_payment('TTB-FULFIL-0001','PAID',(:'o'::json->>'total')::bigint,'GHS','card',null,now(),'{}'::jsonb) as s \gset
end;

do $$
declare
  oid uuid := (select id from public.orders where paystack_reference='TTB-FULFIL-0001');
  st public.order_status;
begin
  select public.update_order_status(oid, 'CONFIRMED')  into st; assert st = 'CONFIRMED';
  select public.update_order_status(oid, 'PREPARING')  into st; assert st = 'PREPARING';
  select public.update_order_status(oid, 'DISPATCHED') into st; assert st = 'DISPATCHED';
  select public.update_order_status(oid, 'DELIVERED')  into st; assert st = 'DELIVERED';
  assert (select order_status from public.orders where id=oid) = 'DELIVERED';
  -- Terminal states reject everything, including backwards moves.
  perform public.expect_error(format('select public.update_order_status(%L, ''CONFIRMED'')', oid), 'INVALID_TRANSITION');
  perform public.expect_error(format('select public.update_order_status(%L, ''CANCELLED'')', oid), 'INVALID_TRANSITION');
  -- Stock must be untouched by the forward flow.
  assert (select stock_quantity from public.product_variants where id='c0000000-0000-4000-8000-000000000004') = 27,
    'forward flow must not restock';
end $$;

-- == 2. Invalid jumps are rejected before any side effect ==
begin;
  set local role service_role;
  select public.place_order(
    p_items    := '[{"variant_id":"c0000000-0000-4000-8000-000000000005","quantity":1}]'::jsonb,
    p_customer := '{"full_name":"Kofi Jump","email":"kofi@jump.gh","phone":"0204445556","region":"Ashanti","city":"Kumasi","delivery_address":"2 Jump Road"}'::jsonb,
    p_region_id:= 'd0000000-0000-4000-8000-000000000002',
    p_paystack_reference := 'TTB-FULFIL-0002'
  ) as o \gset
end;

do $$
declare
  oid uuid := (select id from public.orders where paystack_reference='TTB-FULFIL-0002');
begin
  -- DELIVERED straight from PENDING is not allowed…
  perform public.expect_error(format('select public.update_order_status(%L, ''DELIVERED'')', oid), 'INVALID_TRANSITION');
  -- …and the failed attempt must not have moved the order or stock.
  assert (select order_status from public.orders where id=oid) = 'PENDING';
  assert (select stock_quantity from public.product_variants where id='c0000000-0000-4000-8000-000000000005') = 24;
  -- Unknown order / unknown status shapes.
  perform public.expect_error(format('select public.update_order_status(%L, ''PREPARING'')', gen_random_uuid()), 'ORDER_NOT_FOUND');
  perform public.expect_error(format('select public.update_order_status(%L, ''WARP_SPEED'')', oid), 'INVALID_STATUS');
end $$;

-- == 3. Cancellation restocks exactly once, even with inactive variants ==
begin;
  set local role service_role;
  update public.product_variants set active = false where id = 'c0000000-0000-4000-8000-000000000006';
  select public.place_order(
    p_items    := '[{"variant_id":"c0000000-0000-4000-8000-000000000006","quantity":2},{"variant_id":"c0000000-0000-4000-8000-000000000004","quantity":1}]'::jsonb,
    p_customer := '{"full_name":"Adjoa Cancel","email":"adjoa@cancel.gh","phone":"0209998887","region":"Western","city":"Takoradi","delivery_address":"3 Cancel Close"}'::jsonb,
    p_region_id:= 'd0000000-0000-4000-8000-000000000003',
    p_paystack_reference := 'TTB-FULFIL-0003'
  ) as o \gset
end;

do $$
declare
  oid uuid := (select id from public.orders where paystack_reference='TTB-FULFIL-0003');
  moves integer;
begin
  -- Variant ...006 is inactive now; cancellation must still succeed.
  perform public.update_order_status(oid, 'CANCELLED');

  assert (select order_status from public.orders where id=oid) = 'CANCELLED';
  -- Active variant restocked: 30 - 1(step1? no—step1 used ...004 qty3) => seed 45? compute:
  --   ...004: seed 30, order FULFIL-0001 took 3 → 27, this order took 1 → 26, cancel +1 → 27.
  assert (select stock_quantity from public.product_variants where id='c0000000-0000-4000-8000-000000000004') = 27,
    'active variant must be restocked to 27';
  -- Inactive variant is SKIPPED (stays decremented at 10).
  assert (select stock_quantity from public.product_variants where id='c0000000-0000-4000-8000-000000000006') = 10,
    'inactive variant should be skipped, staying at 10';

  -- Exactly one audited restock movement per restockable item.
  select count(*) into moves from public.inventory_movements
   where order_id = oid and reason = 'ORDER_CANCELLED_RESTOCK' and variant_id = 'c0000000-0000-4000-8000-000000000004';
  assert moves = 1, 'expected exactly one restock movement for the active variant';

  -- Double-cancel is impossible.
  perform public.expect_error(format('select public.update_order_status(%L, ''CANCELLED'')', oid), 'INVALID_TRANSITION');
  select count(*) into moves from public.inventory_movements
   where order_id = oid and reason = 'ORDER_CANCELLED_RESTOCK';
  assert moves = 1, 'double-cancel would double-restock';
end $$;

-- == 4. mark_order_refunded: PAID → REFUNDED once, guarded ==
do $$
declare
  oid uuid := (select id from public.orders where paystack_reference='TTB-FULFIL-0001');
  r boolean;
  pstatus public.payment_status;
  meta jsonb;
begin
  -- Order 1 was settled PAID in step 1.
  r := public.mark_order_refunded(oid, '{"refund_id":42}'::jsonb);
  assert r, 'mark_order_refunded should return true';

  assert (select payment_status from public.orders where id=oid) = 'REFUNDED';
  select status, metadata into pstatus, meta from public.payments where paystack_reference='TTB-FULFIL-0001';
  assert pstatus = 'REFUNDED', 'payment row must be REFUNDED';
  assert meta->>'refund_id' = '42', 'snapshot merged into payment metadata';
  assert meta ? 'refunded_at', 'refunded_at stamped';
end $$;

do $$
begin
  -- Second refund attempt finds no PAID row left.
  perform public.expect_error(
    format('select public.mark_order_refunded(%L)', (select id from public.orders where paystack_reference='TTB-FULFIL-0001')),
    'ORDER_NOT_PAID');
  -- Unknown order.
  perform public.expect_error(format('select public.mark_order_refunded(%L)', gen_random_uuid()), 'ORDER_NOT_PAID');
end $$;

-- == 5. Privileges: anon/authenticated can NEVER reach the pipeline ==
begin;
  set local role anon;
  perform public.expect_error(
    'select public.update_order_status(''00000000-0000-4000-8000-00000000dead''::uuid, ''CONFIRMED'')',
    'permission denied');
  perform public.expect_error(
    'select public.mark_order_refunded(''00000000-0000-4000-8000-00000000dead''::uuid)',
    'permission denied');
end;

reset role;
do $$
begin
  raise notice 'ALL FULFILMENT CHECKS PASSED';
end $$;
