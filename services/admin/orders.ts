import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Admin order reads — cookie-scoped client under RLS (STAFF may read
 * business data). Composes order rows with item counts and the
 * authoritative payment attempt state.
 */

export interface AdminOrderListItem {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  region: string;
  city: string;
  total: number;
  paymentStatus: string;
  /** Latest payment attempt's status when one exists, else the order flag. */
  paymentAttemptStatus: string | null;
  orderStatus: string;
  paystackReference: string | null;
  createdAt: string;
  itemCount: number;
  hasPendingIntent: boolean;
}

interface OrderRecord {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  region: string;
  city: string;
  total: number | string;
  payment_status: string;
  order_status: string;
  paystack_reference: string | null;
  created_at: string;
}

export async function listRecentOrders(limit = 100): Promise<AdminOrderListItem[]> {
  const supabase = await createClient();

  const [{ data: orders, error: oErr }, { data: items, error: iErr }, { data: payments, error: pErr }] =
    await Promise.all([
      supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit),
      supabase
        .from("order_items")
        .select("order_id, quantity"),
      supabase
        .from("payments")
        .select("order_id, status, created_at")
        .order("created_at"),
    ]);

  if (oErr || iErr || pErr) throw (oErr ?? iErr ?? pErr);

  const itemCounts = new Map<string, number>();
  for (const item of items ?? []) {
    itemCounts.set(item.order_id, (itemCounts.get(item.order_id) ?? 0) + item.quantity);
  }

  const attemptsByOrder = new Map<string, string[]>();
  for (const payment of payments ?? []) {
    const list = attemptsByOrder.get(payment.order_id) ?? [];
    list.push(payment.status);
    attemptsByOrder.set(payment.order_id, list);
  }

  return ((orders ?? []) as OrderRecord[]).map((o) => {
    const attempts = attemptsByOrder.get(o.id);
    const pendingIntent = Boolean(
      o.paystack_reference && (!attempts || !attempts.some((a) => a !== "PENDING"))
    );
    return {
      id: o.id,
      orderNumber: o.order_number,
      customerName: o.customer_name,
      customerPhone: o.customer_phone,
      customerEmail: o.customer_email,
      region: o.region,
      city: o.city,
      total: Number(o.total),
      paymentStatus: o.payment_status,
      paymentAttemptStatus: attempts ? (attempts[attempts.length - 1] ?? null) : null,
      orderStatus: o.order_status,
      paystackReference: o.paystack_reference,
      createdAt: o.created_at,
      itemCount: itemCounts.get(o.id) ?? 0,
      hasPendingIntent: pendingIntent,
    };
  });
}
