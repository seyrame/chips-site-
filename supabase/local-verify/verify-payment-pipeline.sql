-- Offline behavioral verification of migration 0010 (payment pipeline).
-- Run as superuser against a stub+seed database (vanilla Postgres via
-- Docker):
--   docker run -d --name ttb-verify -e POSTGRES_PASSWORD=verify -p 55432:5432 postgres:16
--   psql ... -f supabase/local-verify/supabase-stub.sql   (then migrations 0001..0010, then seed.sql)
--   psql ... -v ON_ERROR_STOP=1 -f supabase/local-verify/verify-payment-pipeline.sql
-- Every check runs inside ON_ERROR_STOP: a single failed assertion
-- aborts the script, so exit code 0 == all checks passed.

-- Top-level assertion helper (plpgsql ASSERT doesn't work at psql level).
create or replace function public.assert(cond boolean, msg text)
returns void language plpgsql as $a$
begin
  if not cond then raise exception 'ASSERT FAILED: %', msg; end if;
end $a$;

-- == 1. place_order v2 stamps reference + PENDING intent atomically ==
begin;
  set local role service_role;
  select public.place_order(
    p_items    := '[{"variant_id":"c0000000-0000-4000-8000-000000000001","quantity":2}]'::jsonb,
    p_customer := '{"full_name":"Ama Test","email":"ama@test.gh","phone":"0201234567","region":"Greater Accra","city":"Accra","delivery_address":"12 Test Street"}'::jsonb,
    p_region_id:= 'd0000000-0000-4000-8000-000000000001',
    p_paystack_reference := 'TTB-TEST-0001'
  ) as order1 \gset

  select assert (:'order1'::json->>'total' = '5500', 'order1 total should be 4000 subtotal + 1500 fee');
end;

do $$
declare
  o public.orders%rowtype;
  pay public.payments%rowtype;
  stock integer;
  moves integer;
begin
  select * into o from public.orders where paystack_reference = 'TTB-TEST-0001';
  assert o.total = 5500, 'total mismatch';
  assert o.payment_status = 'PENDING' and o.order_status = 'PENDING', 'order should start pending';

  select * into pay from public.payments where paystack_reference = 'TTB-TEST-0001';
  assert pay.order_id = o.id, 'payment not linked to order';
  assert pay.amount = 5500 and pay.currency = 'GHS', 'payment amount/currency wrong';
  assert pay.status = 'PENDING', 'payment intent must start PENDING';

  select stock_quantity into stock from public.product_variants where id = 'c0000000-0000-4000-8000-000000000001';
  assert stock = 43, 'stock should be decremented to 43, got ' || stock;
  select count(*) into moves from public.inventory_movements
    where variant_id = 'c0000000-0000-4000-8000-000000000001' and reason = 'ORDER_PLACED' and delta = -2;
  assert moves = 1, 'expected one audited ORDER_PLACED decrement';
end $$;

-- == 2. Happy-path settlement: webhook/callback both funnel here ==
select public.settle_payment(
  p_reference => 'TTB-TEST-0001',
  p_outcome   => 'PAID',
  p_amount    => 5500,
  p_currency  => 'GHS',
  p_channel   => 'mobile_money',
  p_gateway_response => 'Successful',
  p_paid_at   => now(),
  p_snapshot  => '{"source":"test"}'::jsonb
) as settle1 \gset
select assert (:'settle1'::json->>'payment_status' = 'PAID', 'first settle must be PAID');

do $$
declare
  r jsonb;
begin
  -- Idempotent replay collapses to a no-op.
  select public.settle_payment('TTB-TEST-0001', 'PAID', 5500, 'GHS', null, null, null, '{"source":"replay"}'::jsonb)
    into r;
  assert r->>'already_settled' = 'true' and r->>'payment_status' = 'PAID', 'replay must be idempotent';

  -- PAID is terminal: a later FAILED can never regress it.
  select public.settle_payment('TTB-TEST-0001', 'FAILED', 5500, 'GHS', null, null, null, null) into r;
  assert r->>'already_settled' = 'true', 'PAID must be terminal';

  assert (select payment_status from public.orders where paystack_reference='TTB-TEST-0001') = 'PAID',
    'order payment_status must be PAID';
  assert (select order_status from public.orders where paystack_reference='TTB-TEST-0001') = 'CONFIRMED',
    'paid order must be CONFIRMED';
  assert (select status from public.payments where paystack_reference='TTB-TEST-0001') = 'PAID',
    'payment row must be PAID';
  assert (select paid_at is not null and verified_at is not null from public.payments where paystack_reference='TTB-TEST-0001'),
    'paid_at/verified_at must be stamped';
end $$;

-- == 3. Amount mismatch NEVER marks paid -- stays PENDING w/ evidence ==
begin;
  set local role service_role;
  select public.place_order(
    p_items    := '[{"variant_id":"c0000000-0000-4000-8000-000000000004","quantity":1}]'::jsonb,
    p_customer := '{"full_name":"Kofi Test","email":"kofi@test.gh","phone":"0207776665","region":"Ashanti","city":"Kumasi","delivery_address":"9 Ridge Road"}'::jsonb,
    p_region_id:= 'd0000000-0000-4000-8000-000000000002',
    p_paystack_reference := 'TTB-TEST-0002'
  ) as order2 \gset
end;

select public.settle_payment(
  p_reference => 'TTB-TEST-0002',
  p_outcome   => 'PAID',
  p_amount    => 999,            -- attacker/tampered payload
  p_currency  => 'NGN',
  p_gateway_response => 'Successful',
  p_snapshot  => '{"source":"tampered-webhook"}'::jsonb
) as settle2 \gset
select assert (:'settle2'::json->>'mismatch' = 'true', 'mismatch flag expected');
select assert (:'settle2'::json->>'payment_status' = 'PENDING', 'mismatched payment must stay PENDING');

do $$
declare r jsonb; evidence boolean;
begin
  assert (select payment_status from public.orders where paystack_reference='TTB-TEST-0002') = 'PENDING',
    'mismatched order must remain PENDING';
  select position('AMOUNT_MISMATCH' in gateway_response) > 0 into evidence
    from public.payments where paystack_reference='TTB-TEST-0002';
  assert evidence, 'evidence must be recorded on the payment row';
  -- And the honest retry afterwards still settles correctly.
  select public.settle_payment('TTB-TEST-0002','PAID',3500,'GHS','card','Successful',now(),null) into r;
  assert r->>'payment_status' = 'PAID', 'correct retry after mismatch should settle';
end $$;

-- == 4. FAILED then late-success webhook wins ==
begin;
  set local role service_role;
  select public.place_order(
    p_items    := '[{"variant_id":"c0000000-0000-4000-8000-000000000007","quantity":3}]'::jsonb,
    p_customer := '{"full_name":"Adjoa Test","email":"adjoa@test.gh","phone":"0551239876","region":"Volta","city":"Ho","delivery_address":"5 Market Lane"}'::jsonb,
    p_region_id:= 'd0000000-0000-4000-8000-000000000006',
    p_paystack_reference := 'TTB-TEST-0003'
  ) as order3 \gset
end;

select public.settle_payment('TTB-TEST-0003','FAILED',8100,'GHS','card','Declined',null,null) as fail1 \gset
select assert (:'fail1'::json->>'payment_status' = 'FAILED', 'decline should mark FAILED');

do $$
declare r jsonb;
begin
  assert (select payment_status from public.orders where paystack_reference='TTB-TEST-0003') = 'FAILED',
    'order should read FAILED after decline';

  select public.settle_payment('TTB-TEST-0003','PAID',8100,'GHS','mobile_money','Successful',now(),'{"source":"late-webhook"}'::jsonb) into r;
  assert r->>'payment_status' = 'PAID' and not coalesce((r->>'already_settled')::bool, false),
    'late success must settle for real';

  assert (select payment_status from public.orders where paystack_reference='TTB-TEST-0003') = 'PAID',
    'late success must flip order to PAID';
  assert (select order_status from public.orders where paystack_reference='TTB-TEST-0003') = 'CONFIRMED',
    'late success must confirm the order';
end $$;

-- == 5. Unknown references are rejected loudly ==
do $$
begin
  begin
    perform public.settle_payment('TTB-DOES-NOT-EXIST','PAID',100,'GHS',null,null,null,null);
    raise exception 'should have thrown UNKNOWN_REFERENCE';
  exception when others then
    assert sqlerrm = 'UNKNOWN_REFERENCE', 'expected UNKNOWN_REFERENCE, got: ' || sqlerrm;
  end;
end $$;

-- == 6. anon/authenticated cannot touch either pipeline function ==
set role anon;
do $$
begin
  begin
    perform public.place_order('[{"variant_id":"c0000000-0000-4000-8000-000000000001","quantity":1}]'::jsonb,
      '{}'::jsonb, null, 'TTB-EVIL');
    raise exception 'anon executed place_order';
  exception when insufficient_privilege then null; end;
  begin
    perform public.settle_payment('TTB-TEST-0001','PAID',5500,'GHS',null,null,null,null);
    raise exception 'anon executed settle_payment';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- == 7. place_order rejects garbage references (defense in depth) ==
begin;
  set local role service_role;
  do $$
  begin
    begin
      perform public.place_order(
        p_items    := '[{"variant_id":"c0000000-0000-4000-8000-000000000001","quantity":1}]'::jsonb,
        p_customer := '{"full_name":"Evil Test","email":"evil@test.gh","phone":"0200000000","region":"Ashanti","city":"Kumasi","delivery_address":"somewhere"}'::jsonb,
        p_paystack_reference := 'not valid!reference~chars'
      );
      raise exception 'invalid reference accepted';
    exception when others then
      assert sqlerrm = 'INVALID_REFERENCE', 'expected INVALID_REFERENCE, got: ' || sqlerrm;
    end;
  end $$;
rollback;

select 'ALL PAYMENT PIPELINE CHECKS PASSED' as result;
