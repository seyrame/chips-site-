-- ═══════════════════════════════════════════════════════════════
-- TT Brothers · Migration 0002
-- Product catalog: categories, products, variants, images.
-- Deliberately category-agnostic: plantain chips today,
-- honey/groundnuts/etc. tomorrow — no app changes required.
--
-- MONEY CONVENTION: all monetary columns are BIGINT minor units
-- (pesewas). GH₵35.00 is stored as 3500. Matches Paystack's API.
-- ═══════════════════════════════════════════════════════════════

-- ── Categories ──────────────────────────────────────────────────
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null,
  description text,
  image       text,
  active      boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

comment on table public.categories is 'Product categories (e.g. Plantain Chips, later Honey).';
create unique index categories_slug_key on public.categories (lower(slug));

-- ── Products ────────────────────────────────────────────────────
create table public.products (
  id                uuid primary key default gen_random_uuid(),
  category_id       uuid not null references public.categories (id) on delete restrict,
  name              text not null,
  slug              text not null,
  description       text,
  short_description text,
  ingredients       text,
  meta_title        text,
  meta_description  text,
  active            boolean not null default true,
  featured          boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on column public.products.meta_title is 'SEO title override; falls back to product name.';
comment on column public.products.meta_description is 'SEO meta description override.';
create unique index products_slug_key on public.products (lower(slug));
create index products_category_idx on public.products (category_id);
create index products_active_featured_idx on public.products (active, featured)
  where active;
-- Trigram indexes for Phase 5 search over name/description.
create index products_name_trgm_idx on public.products using gin (name gin_trgm_ops);
create index products_description_trgm_idx on public.products using gin (description gin_trgm_ops);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- ── Product variants ────────────────────────────────────────────
-- Inventory and pricing live at the VARIANT level: TT Original
-- Small/Medium/Large each carry their own price + stock.
create table public.product_variants (
  id                  uuid primary key default gen_random_uuid(),
  product_id          uuid not null references public.products (id) on delete cascade,
  name                text not null,
  price               bigint not null check (price >= 0),
  stock_quantity      integer not null default 0 check (stock_quantity >= 0),
  low_stock_threshold integer not null default 5 check (low_stock_threshold >= 0),
  sku                 text,
  sort_order          integer not null default 0,
  active              boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on column public.product_variants.price is 'Unit price in pesewas (GHS minor units).';
comment on column public.product_variants.stock_quantity is
  'On-hand units. LOW STOCK when <= low_stock_threshold; computed, never stored.';
create index variants_product_idx on public.product_variants (product_id);
-- One variant name per product (e.g. a product cannot have two "Medium")
create unique index variants_product_name_key on public.product_variants (product_id, lower(name));
create unique index variants_sku_key on public.product_variants (lower(sku))
  where sku is not null;

create trigger variants_set_updated_at
  before update on public.product_variants
  for each row execute function public.set_updated_at();

-- ── Product images ──────────────────────────────────────────────
-- Primary image = lowest sort_order. Admin "set primary" = move to front.
create table public.product_images (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  image_url  text not null,
  alt_text   text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.product_images is
  'Gallery ordered by sort_order; the lowest value is the primary image.';
create index images_product_order_idx on public.product_images (product_id, sort_order);
