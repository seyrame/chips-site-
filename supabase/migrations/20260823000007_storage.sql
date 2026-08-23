-- ═══════════════════════════════════════════════════════════════
-- TT Brothers · Migration 0007
-- Supabase Storage: product image bucket + access policies.
-- ═══════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- Anyone may view product images (bucket is public; this also covers
-- signed-transform usage).
create policy "Public reads product images"
  on storage.objects for select
  using (bucket_id = 'product-images');

-- Only OWNER/ADMIN may upload, replace or remove product imagery.
create policy "Managers upload product images"
  on storage.objects for insert
  with check (bucket_id = 'product-images' and (select public.is_manager()));

create policy "Managers update product images"
  on storage.objects for update
  using (bucket_id = 'product-images' and (select public.is_manager()));

create policy "Managers delete product images"
  on storage.objects for delete
  using (bucket_id = 'product-images' and (select public.is_manager()));
