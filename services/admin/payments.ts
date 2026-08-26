import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { PaymentRow } from "@/types/database";

/**
 * Admin payment reads — cookie-scoped client under RLS (STAFF may read
 * business data). Composes payment attempts with order context for the
 * reconciliation panel.
 */

export interface AdminPaymentListItem {
  id: string;
  orderId: string;
  orderNumber: string;
  paystackReference: string;
  amount: number;
  currency: string;
  channel: string | null;
  gatewayResponse: string | null;
  status: string;
  paidAt: string | null;
  verifiedAt: string | null;
  createdAt: string;
  customerName: string;
}

interface PaymentWithOrder extends PaymentRow {
  order?: {
    order_number: string;
    customer_name: string;
  } | null;
}

export async function listRecentPayments(limit = 200): Promise<AdminPaymentListItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("payments")
    .select("*, order:orders!inner(order_number, customer_name)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return ((data ?? []) as PaymentWithOrder[]).map((p) => ({
    id: p.id,
    orderId: p.order_id,
    orderNumber: p.order?.order_number ?? "—",
    paystackReference: p.paystack_reference,
    amount: Number(p.amount),
    currency: p.currency,
    channel: p.channel,
    gatewayResponse: p.gateway_response,
    status: p.status,
    paidAt: p.paid_at,
    verifiedAt: p.verified_at,
    createdAt: p.created_at,
    customerName: p.order?.customer_name ?? "—",
  }));
}

export interface PaymentStatusBreakdown {
  paid: number;
  pending: number;
  failed: number;
  refunded: number;
  totalAmount: number;
}

export async function getPaymentStatusBreakdown(): Promise<PaymentStatusBreakdown> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("payments")
    .select("status, amount");

  if (error) throw error;

  const result: PaymentStatusBreakdown = {
    paid: 0,
    pending: 0,
    failed: 0,
    refunded: 0,
    totalAmount: 0,
  };

  for (const row of data ?? []) {
    const amount = Number(row.amount);
    switch (row.status) {
      case "PAID":
        result.paid += 1;
        result.totalAmount += amount;
        break;
      case "PENDING":
        result.pending += 1;
        break;
      case "FAILED":
        result.failed += 1;
        break;
      case "REFUNDED":
        result.refunded += 1;
        break;
    }
  }

  return result;
}
