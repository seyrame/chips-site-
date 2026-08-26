-- Migration: Add expired order cleanup function
-- Run this as a one-time migration. To activate, schedule with pg_cron:
--   select cron.schedule('expire-pending-orders', '*/10 * * * *', 'select expire_pending_orders()');

create or replace function public.expire_pending_orders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_order record;
begin
  -- Find PENDING orders older than 30 minutes with no payment settlement.
  for v_order in
    select o.id, o.order_number
    from orders o
    where o.order_status = 'PENDING'
      and o.payment_status = 'PENDING'
      and o.created_at < now() - interval '30 minutes'
  loop
    -- Cancel the order (restocks via update_order_status trigger).
    perform update_order_status(v_order.id, 'CANCELLED');
    v_count := v_count + 1;

    raise notice 'Expired pending order % (%)', v_order.order_number, v_order.id;
  end loop;

  return v_count;
end;
$$;

comment on function public.expire_pending_orders() is
  'Cancels PENDING orders older than 30 minutes with no payment. Restocks inventory. Schedule via pg_cron.';

-- Trusted-server-only: schedule via pg_cron or service_role, never exposed to clients.
revoke execute on function public.expire_pending_orders()
  from anon, authenticated, public;
grant execute on function public.expire_pending_orders()
  to service_role;
