/**
 * Domain types used across the application (spec §37).
 * Row types mirror the database 1:1; domain types shape what the UI
 * and services pass around.
 */
import type {
  CategoryRow,
  CustomerRow,
  OrderItemRow,
  OrderRow,
  PaymentRow,
  ProductImageRow,
  ProductRow,
  ProductVariantRow,
  UserRole,
} from "./database";

export type {
  AppSettingRow,
  CategoryRow,
  CustomerRow,
  DeliveryRegionRow,
  DeliverySettingsRow,
  InventoryMovementRow,
  InventoryReason,
  OrderItemRow,
  OrderRow,
  OrderStatus,
  PaymentRow,
  PaymentStatus,
  ProductImageRow,
  ProductRow,
  ProductVariantRow,
  ProfileRow,
  UserRole,
} from "./database";

export type Category = CategoryRow;

export type ProductImage = ProductImageRow;

export interface ProductVariant extends ProductVariantRow {
  /** Computed for display: stock_quantity <= low_stock_threshold && > 0 */
  isLowStock: boolean;
  /** Computed: stock_quantity === 0 */
  isOutOfStock: boolean;
}

export interface Product extends ProductRow {
  category?: Category;
  images: ProductImage[];
  variants: ProductVariant[];
}

export interface CartItem {
  variantId: string;
  productId: string;
  productSlug: string;
  productName: string;
  variantName: string;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
  maxQuantity: number;
}

export type { OrderRow as Order };
export type { OrderItemRow as OrderItem };
export type { PaymentRow as Payment };
export type { CustomerRow as Customer };

export interface AdminUser {
  id: string;
  email: string;
  role: UserRole | null;
}
