/**
 * Hand-authored Supabase schema types — mirror of supabase/migrations.
 * Regenerate with `supabase gen types` once a live project exists;
 * this file is the compile-time contract until then.
 */

export type UserRole = "OWNER" | "ADMIN" | "STAFF";
export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED";
export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PREPARING"
  | "DISPATCHED"
  | "DELIVERED"
  | "CANCELLED";
export type InventoryReason =
  | "INITIAL_STOCK"
  | "ORDER_PLACED"
  | "ORDER_CANCELLED_RESTOCK"
  | "ADMIN_ADJUSTMENT";

export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  active: boolean;
  sort_order: number;
  created_at: string;
}

export interface ProductRow {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  ingredients: string | null;
  meta_title: string | null;
  meta_description: string | null;
  active: boolean;
  featured: boolean;
  created_at: string;
  updated_at: string;
}

/** price fields are pesewas (GHS minor units) */
export interface ProductVariantRow {
  id: string;
  product_id: string;
  name: string;
  price: number;
  stock_quantity: number;
  low_stock_threshold: number;
  sku: string | null;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductImageRow {
  id: string;
  product_id: string;
  image_url: string;
  alt_text: string | null;
  sort_order: number;
  created_at: string;
}

export interface CustomerRow {
  id: string;
  email: string | null;
  phone: string | null;
  full_name: string | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderRow {
  id: string;
  order_number: string;
  customer_id: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  region: string;
  city: string;
  delivery_address: string;
  delivery_instructions: string | null;
  subtotal: number;
  delivery_fee: number;
  total: number;
  currency: "GHS";
  payment_status: PaymentStatus;
  order_status: OrderStatus;
  paystack_reference: string | null;
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  variant_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface PaymentRow {
  id: string;
  order_id: string;
  paystack_reference: string;
  amount: number;
  currency: "GHS";
  channel: string | null;
  gateway_response: string | null;
  status: PaymentStatus;
  paid_at: string | null;
  verified_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface InventoryMovementRow {
  id: string;
  variant_id: string;
  delta: number;
  reason: InventoryReason;
  order_id: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface DeliveryRegionRow {
  id: string;
  region: string;
  fee: number;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface DeliverySettingsRow {
  id: string;
  default_fee: number;
  free_delivery_threshold: number | null;
  updated_at: string;
}

export interface AppSettingRow {
  key: string;
  value: unknown;
  updated_at: string;
}

export interface ProfileRow {
  id: string;
  role: UserRole | null;
  created_at: string;
  updated_at: string;
}
