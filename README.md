# TT Brothers — E-Commerce Platform

Premium Ghanaian DTC food brand. Next.js 16 (App Router, Turbopack) · TypeScript · Tailwind CSS v4 · Supabase · Paystack.

## Project Structure

```
app/
  (storefront)/     Customer-facing routes
  admin/            Owner dashboard (protected)
  api/              Route handlers (checkout, Paystack, webhooks)
components/         UI primitives + storefront/admin components
lib/                Env config, Supabase clients, business config
services/           Database access & business logic
types/              Domain types mirroring the database schema
hooks/ utils/      Client hooks and pure helpers
supabase/
  migrations/       Ordered SQL migrations (single source of truth)
  seed.sql          Development seed data (placeholder values)
  local-verify/     Vanilla-Postgres stubs for offline verification
```

## Database

All money is stored as **integer pesewas** (GHS minor units; `GH₵35.00` = `3500`) — matching the Paystack API format exactly. Never use floats for money.

### Applying the schema to a Supabase project

Run each file in `supabase/migrations/` **in filename order** via Dashboard → SQL Editor, then run `supabase/seed.sql` for development data. With the Supabase CLI: `supabase link` then `supabase db push`.

Migrations create: categories, products, variants (price + stock at variant level), images, customers, orders, order_items, payments, inventory_movements (audit trail), delivery regions/settings, app settings, profiles — plus RLS policies on every table and the atomic `adjust_variant_stock()` function that prevents overselling at the database level.

### Roles & access model

| Identity | Access |
|---|---|
| anon | Read active catalog only. Zero writes anywhere. |
| STAFF | + read business data |
| OWNER / ADMIN | + manage catalog, orders |
| service_role | Server pipeline only (checkout, payment verification) |

Admin accounts are created by inviting users in Supabase Auth with `role: OWNER` (or ADMIN/STAFF) in their `raw_user_meta_data`. A profile without a role has no privileges.

## Payments (Paystack)

Checkout is a single trusted server pipeline:

1. `placeOrderAction` generates the payment reference **server-side** and passes it to `place_order()`, which stamps `orders.paystack_reference` and inserts the PENDING `payments` row in the same transaction as the order itself.
2. The action initializes a Paystack hosted-checkout session (GHS, amount already in pesewas) and redirects the customer to Paystack.
3. Truth arrives through two independent doors, both funnelling into the idempotent, service-role-only `settle_payment()` RPC:
   - **Webhook** — `POST /api/webhooks/paystack`. Verifies `x-paystack-signature` (HMAC-SHA512 of the raw body, timing-safe compare) before touching anything. Register this URL in the Paystack dashboard.
   - **Callback** — `/checkout/paystack/callback` re-verifies via `GET /transaction/verify/:reference` and never trusts the query string for status decisions.

Settlement rules: `PAID` is terminal; `FAILED → PAID` is allowed (a late success wins); an amount/currency mismatch with our stored total is **never** marked paid — it stays `PENDING` with the evidence recorded for review. Paid orders flip to `payment_status: PAID`, `order_status: CONFIRMED`.

## Environment Variables

Copy `.env.example` → `.env.local` and fill in real values. Never commit `.env.local`.
