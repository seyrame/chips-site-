-- ═══════════════════════════════════════════════════════════════
-- TT Brothers · Migration 0008 (post-review hardening)
--
-- generate_order_number() must not be RPC-callable by clients:
-- anyone with the anon key could otherwise burn the sequence and
-- skip order numbers. Order creation is pipeline-only.
-- ═══════════════════════════════════════════════════════════════

revoke execute on function public.generate_order_number()
  from anon, authenticated, public;
