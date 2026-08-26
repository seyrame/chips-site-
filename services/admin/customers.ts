import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Admin customer reads — cookie-scoped client under RLS. Customers are
 * upserted by the place_order pipeline; this view aggregates their
 * order history for the fulfilment panel.
 */

export interface CustomerSummary {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  createdAt: string;
  orderCount: number;
  /** Sum of non-cancelled order totals, pesewas. */
  lifetimeValue: number;
  lastOrderAt: string | null;
}

export async function listCustomerSummaries(limit = 200): Promise<CustomerSummary[]> {
  const supabase = await createClient();

  const [{ data: customers, error: cErr }, { data: orders, error: oErr }] = await Promise.all([
    supabase.from("customers").select("*").order("created_at", { ascending: false }).limit(limit),
    supabase
      .from("orders")
      .select("customer_id, total, order_status, created_at")
      .not("customer_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(5000),
  ]);
  if (cErr || oErr) throw (cErr ?? oErr);

  const stats = new Map<
    string,
    { orderCount: number; lifetimeValue: number; lastOrderAt: string | null }
  >();
  for (const order of orders ?? []) {
    if (!order.customer_id) continue;
    const entry =
      stats.get(order.customer_id) ??
      { orderCount: 0, lifetimeValue: 0, lastOrderAt: null as string | null };
    if (order.order_status !== "CANCELLED") {
      entry.orderCount += 1;
      entry.lifetimeValue += Number(order.total);
    }
    // Orders arrive newest-first; first sighting is the latest.
    if (entry.lastOrderAt === null) {
      entry.lastOrderAt = order.created_at;
    }
    stats.set(order.customer_id, entry);
  }

  return ((customers ?? []) as Array<{
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    created_at: string;
  }>).map((c) => {
    const s = stats.get(c.id);
    return {
      id: c.id,
      fullName: c.full_name ?? "—",
      email: c.email,
      phone: c.phone,
      createdAt: c.created_at,
      orderCount: s?.orderCount ?? 0,
      lifetimeValue: s?.lifetimeValue ?? 0,
      lastOrderAt: s?.lastOrderAt ?? null,
    };
  });
}
