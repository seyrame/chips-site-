import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Admin analytics — aggregate metrics for the analytics dashboard.
 * All queries run under RLS via the cookie-scoped server client.
 */

export interface RevenueMetrics {
  /** Total revenue from settled orders (pesewas). */
  totalRevenue: number;
  /** Number of orders with PAID status. */
  paidOrderCount: number;
  /** Average order value for paid orders (pesewas). */
  averageOrderValue: number;
}

export interface OrderMetrics {
  totalOrders: number;
  pendingOrders: number;
  confirmedOrders: number;
  preparingOrders: number;
  dispatchedOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
}

export interface CustomerMetrics {
  totalCustomers: number;
  /** Customers who placed at least one order. */
  customersWithOrders: number;
}

export interface ProductMetrics {
  totalProducts: number;
  activeProducts: number;
  featuredProducts: number;
  totalVariants: number;
  lowStockVariants: number;
  outOfStockVariants: number;
}

export interface DailyRevenue {
  date: string;
  revenue: number;
  orderCount: number;
}

export interface TopProduct {
  productName: string;
  totalQuantity: number;
  totalRevenue: number;
}

export interface AnalyticsData {
  revenue: RevenueMetrics;
  orders: OrderMetrics;
  customers: CustomerMetrics;
  products: ProductMetrics;
  /** Last 30 days of daily revenue. */
  dailyRevenue: DailyRevenue[];
  /** Top 10 products by revenue. */
  topProducts: TopProduct[];
}

export async function getAnalyticsData(): Promise<AnalyticsData> {
  const supabase = await createClient();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const ninetyDaysIso = ninetyDaysAgo.toISOString();

  const [
    paymentsResult,
    ordersResult,
    customersResult,
    productsResult,
    variantsResult,
    orderItemsResult,
    paymentsAllResult,
  ] = await Promise.all([
    // Payments: last 90 days only (for revenue metrics).
    supabase.from("payments").select("status, amount").gte("created_at", ninetyDaysIso),
    // Orders: last 90 days only (for status counts).
    supabase.from("orders").select("order_status, created_at").gte("created_at", ninetyDaysIso),
    // Customers: count only, not all rows.
    supabase.from("customers").select("id", { count: "exact", head: true }),
    // Products + variants: small catalog, no limit needed.
    supabase.from("products").select("id, active, featured"),
    supabase
      .from("product_variants")
      .select("stock_quantity, low_stock_threshold, active"),
    // Order items: scoped to last 90 days via join.
    supabase
      .from("order_items")
      .select("product_name, quantity, subtotal, order:orders!inner(order_status, created_at)")
      .gte("order->>created_at", ninetyDaysIso),
    supabase
      .from("payments")
      .select("amount, status, created_at")
      .eq("status", "PAID")
      .gte("created_at", thirtyDaysAgo.toISOString())
      .order("created_at"),
  ]);

  if (paymentsResult.error) throw paymentsResult.error;
  if (ordersResult.error) throw ordersResult.error;
  if (customersResult.error) throw customersResult.error;
  if (productsResult.error) throw productsResult.error;
  if (variantsResult.error) throw variantsResult.error;
  if (orderItemsResult.error) throw orderItemsResult.error;
  if (paymentsAllResult.error) throw paymentsAllResult.error;

  // ── Revenue metrics ──
  let totalRevenue = 0;
  let paidOrderCount = 0;
  for (const p of paymentsResult.data ?? []) {
    if (p.status === "PAID") {
      totalRevenue += Number(p.amount);
      paidOrderCount += 1;
    }
  }

  // ── Order metrics ──
  const orderMetrics: OrderMetrics = {
    totalOrders: ordersResult.data?.length ?? 0,
    pendingOrders: 0,
    confirmedOrders: 0,
    preparingOrders: 0,
    dispatchedOrders: 0,
    deliveredOrders: 0,
    cancelledOrders: 0,
  };
  for (const o of ordersResult.data ?? []) {
    switch (o.order_status) {
      case "PENDING":
        orderMetrics.pendingOrders++;
        break;
      case "CONFIRMED":
        orderMetrics.confirmedOrders++;
        break;
      case "PREPARING":
        orderMetrics.preparingOrders++;
        break;
      case "DISPATCHED":
        orderMetrics.dispatchedOrders++;
        break;
      case "DELIVERED":
        orderMetrics.deliveredOrders++;
        break;
      case "CANCELLED":
        orderMetrics.cancelledOrders++;
        break;
    }
  }

  // ── Customer metrics ──
  // Total customers from the count query; unique customers from recent orders.
  const { data: orderCustomers } = await supabase
    .from("orders")
    .select("customer_id")
    .neq("order_status", "CANCELLED")
    .not("customer_id", "is", null)
    .gte("created_at", ninetyDaysIso);
  const uniqueCustomerIds = new Set(orderCustomers?.map((o) => o.customer_id));
  const customerMetrics: CustomerMetrics = {
    totalCustomers: customersResult.count ?? 0,
    customersWithOrders: uniqueCustomerIds.size,
  };

  // ── Product metrics ──
  const productMetrics: ProductMetrics = {
    totalProducts: productsResult.data?.length ?? 0,
    activeProducts: 0,
    featuredProducts: 0,
    totalVariants: 0,
    lowStockVariants: 0,
    outOfStockVariants: 0,
  };
  for (const p of productsResult.data ?? []) {
    if (p.active) productMetrics.activeProducts++;
    if (p.featured) productMetrics.featuredProducts++;
  }
  for (const v of variantsResult.data ?? []) {
    if (!v.active) continue;
    productMetrics.totalVariants++;
    if (v.stock_quantity === 0) {
      productMetrics.outOfStockVariants++;
    } else if (v.stock_quantity <= v.low_stock_threshold) {
      productMetrics.lowStockVariants++;
    }
  }

  // ── Daily revenue (last 30 days) ──
  const dailyMap = new Map<string, { revenue: number; orderCount: number }>();

  // Pre-fill all 30 days with zeros
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    dailyMap.set(key, { revenue: 0, orderCount: 0 });
  }

  for (const p of paymentsAllResult.data ?? []) {
    if (!p.created_at) continue;
    const dateKey = p.created_at.split("T")[0];
    const existing = dailyMap.get(dateKey);
    if (existing) {
      existing.revenue += Number(p.amount);
      existing.orderCount += 1;
    }
  }

  const dailyRevenue: DailyRevenue[] = Array.from(dailyMap.entries()).map(
    ([date, data]) => ({
      date,
      revenue: data.revenue,
      orderCount: data.orderCount,
    })
  );

  // ── Top products ──
  const productRevenueMap = new Map<
    string,
    { totalQuantity: number; totalRevenue: number }
  >();

  for (const item of orderItemsResult.data ?? []) {
    const order = Array.isArray(item.order) ? item.order[0] : item.order;
    if (order?.order_status === "CANCELLED") continue;

    const existing = productRevenueMap.get(item.product_name) ?? {
      totalQuantity: 0,
      totalRevenue: 0,
    };
    existing.totalQuantity += item.quantity;
    existing.totalRevenue += Number(item.subtotal);
    productRevenueMap.set(item.product_name, existing);
  }

  const topProducts: TopProduct[] = Array.from(productRevenueMap.entries())
    .map(([productName, data]) => ({ productName, ...data }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 10);

  return {
    revenue: {
      totalRevenue,
      paidOrderCount,
      averageOrderValue: paidOrderCount > 0 ? Math.round(totalRevenue / paidOrderCount) : 0,
    },
    orders: orderMetrics,
    customers: customerMetrics,
    products: productMetrics,
    dailyRevenue,
    topProducts,
  };
}
