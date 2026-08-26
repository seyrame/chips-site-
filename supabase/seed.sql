-- ================================================================
-- TT Brothers - Development Seed Data
-- ----------------------------------------------------------------
-- WARNING: ALL PRICES, FEES AND STOCK NUMBERS ARE PLACEHOLDERS.
-- Real business values are entered later by the owner via the
-- admin dashboard. Nothing here is a real commercial term.
--
-- Runs automatically after migrations with `supabase db reset`,
-- or manually in the SQL editor. Safe to re-run (idempotent).
-- ================================================================

-- ── Category ────────────────────────────────────────────────────
insert into public.categories (id, name, slug, description, sort_order)
values (
  'a0000000-0000-4000-8000-000000000001',
  'Plantain Chips',
  'plantain-chips',
  'Hand-cut, small-batch plantain chips fried golden and finished with care.',
  0
)
on conflict do nothing;

-- ── Products ────────────────────────────────────────────────────
insert into public.products (id, category_id, name, slug, short_description, description, active, featured)
values
  ('b0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001',
   'TT Original', 'tt-original',
   'The classic crunch. Lightly salted, golden-fried.',
   'Our signature plantain chips. Hand-selected plantains, sliced thin, fried in small batches and finished with a whisper of salt. Loud crunch, honest flavour.',
   true, true),
  ('b0000000-0000-4000-8000-000000000002',
   'a0000000-0000-4000-8000-000000000001',
   'TT Spicy', 'tt-spicy',
   'For the heat seekers. Fiery, fragrant, addictive.',
   'The TT Brothers crunch with proper Ghanaian heat. A chilli-and-spice dusting that builds slowly and keeps you reaching back into the pack.',
   true, true),
  ('b0000000-0000-4000-8000-000000000003',
   'a0000000-0000-4000-8000-000000000001',
   'TT Sweet', 'tt-sweet',
   'Ripe plantain, caramelised edges. Gently sweet.',
   'Made from fully ripened plantain for a deeper, naturally sweet crunch with caramelised edges. No added sugar needed.',
   true, false)
on conflict do nothing;

-- Ingredients intentionally NULL - never invent product facts.
-- The owner fills these in from the admin dashboard.

-- ── Variants ────────────────────────────────────────────────────
-- PLACEHOLDER PRICING (pesewas): Small GHc20 / Medium GHc35 / Large GHc50
-- Stock mirrors the spec demo: Original includes LOW STOCK (8)
-- and OUT OF STOCK (0) cases.
insert into public.product_variants (id, product_id, name, price, stock_quantity, low_stock_threshold, sku, sort_order, active)
values
  ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'Small',  2000, 45, 10, 'TT-ORIG-S', 0, true),
  ('c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'Medium', 3500,  8, 10, 'TT-ORIG-M', 1, true),
  ('c0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', 'Large',  5000,  0, 10, 'TT-ORIG-L', 2, true),

  ('c0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000002', 'Small',  2000, 30, 10, 'TT-SPCY-S', 0, true),
  ('c0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000002', 'Medium', 3500, 25, 10, 'TT-SPCY-M', 1, true),
  ('c0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000002', 'Large',  5000, 12, 10, 'TT-SPCY-L', 2, true),

  ('c0000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000003', 'Small',  2200, 20, 8,  'TT-SWET-S', 0, true),
  ('c0000000-0000-4000-8000-000000000008', 'b0000000-0000-4000-8000-000000000003', 'Medium', 3800, 15, 8,  'TT-SWET-M', 1, true),
  ('c0000000-0000-4000-8000-000000000009', 'b0000000-0000-4000-8000-000000000003', 'Large',  5200,  6, 8,  'TT-SWET-L', 2, true)
on conflict do nothing;

-- Initial stock audit trail (guarded: safe to re-run without duplicating)
insert into public.inventory_movements (variant_id, delta, reason, note)
select v.id, v.stock_quantity, 'INITIAL_STOCK', 'Development seed'
from public.product_variants v
where v.stock_quantity > 0
  and not exists (
    select 1 from public.inventory_movements m
    where m.variant_id = v.id and m.reason = 'INITIAL_STOCK'
  );

-- ── Images ──────────────────────────────────────────────────────
-- Branded SVG placeholders ship in /public/images/products/.
-- Replace with real photography via the admin dashboard.
insert into public.product_images (product_id, image_url, alt_text, sort_order)
select * from (values
  ('b0000000-0000-4000-8000-000000000001', '/images/products/tt-original.svg',      'TT Original plantain chips pack',    0),
  ('b0000000-0000-4000-8000-000000000001', '/images/products/tt-original-open.svg', 'TT Original chips served in a bowl', 1),
  ('b0000000-0000-4000-8000-000000000002', '/images/products/tt-spicy.svg',         'TT Spicy plantain chips pack',       0),
  ('b0000000-0000-4000-8000-000000000003', '/images/products/tt-sweet.svg',         'TT Sweet plantain chips pack',       0)
) as v(product_id, image_url, alt_text, sort_order)
where not exists (
  select 1 from public.product_images i
  where i.product_id = v.product_id and i.image_url = v.image_url
);

-- ── Delivery regions ────────────────────────────────────────────
-- Ghana's 16 regions. WARNING: FEES ARE PLACEHOLDERS (GHc15 flat).
-- The owner sets real fees per region from the admin dashboard.
insert into public.delivery_regions (id, region, fee, sort_order)
values
  ('d0000000-0000-4000-8000-000000000001', 'Greater Accra',  1500, 0),
  ('d0000000-0000-4000-8000-000000000002', 'Ashanti',        1500, 1),
  ('d0000000-0000-4000-8000-000000000003', 'Western',       1500, 2),
  ('d0000000-0000-4000-8000-000000000004', 'Central',       1500, 3),
  ('d0000000-0000-4000-8000-000000000005', 'Eastern',       1500, 4),
  ('d0000000-0000-4000-8000-000000000006', 'Volta',         1500, 5),
  ('d0000000-0000-4000-8000-000000000007', 'Northern',      1500, 6),
  ('d0000000-0000-4000-8000-000000000008', 'Upper East',    1500, 7),
  ('d0000000-0000-4000-8000-000000000009', 'Upper West',    1500, 8),
  ('d0000000-0000-4000-8000-000000000010', 'Bono',          1500, 9),
  ('d0000000-0000-4000-8000-000000000011', 'Bono East',     1500, 10),
  ('d0000000-0000-4000-8000-000000000012', 'Ahafo',         1500, 11),
  ('d0000000-0000-4000-8000-000000000013', 'Savannah',      1500, 12),
  ('d0000000-0000-4000-8000-000000000014', 'North East',    1500, 13),
  ('d0000000-0000-4000-8000-000000000015', 'Oti',           1500, 14),
  ('d0000000-0000-4000-8000-000000000016', 'Western North', 1500, 15)
on conflict do nothing;

-- ── App settings ────────────────────────────────────────────────
-- PLACEHOLDER WhatsApp number. Real value comes from env/config later.
insert into public.app_settings (key, value)
values
  ('public.whatsapp_number', '"233XXXXXXXXX"'),
  ('public.whatsapp_message', '"Hello TT Brothers, I need help with my order."'),
  ('public.free_delivery_note', '"Free delivery on orders over GHc200 (placeholder)."')
on conflict (key) do nothing;
