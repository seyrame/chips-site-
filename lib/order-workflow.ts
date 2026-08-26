import type { OrderStatus } from "@/types/database";

/**
 * Allowed fulfilment transitions. This mirrors the guard inside
 * update_order_status() (migration 0011) — the SQL function remains
 * the source of truth; this map only shapes the UI and pre-validates
 * submissions for nicer errors.
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["CONFIRMED", "PREPARING", "DISPATCHED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "DISPATCHED", "CANCELLED"],
  PREPARING: ["DISPATCHED", "CANCELLED"],
  DISPATCHED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

export const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  PREPARING: "Preparing",
  DISPATCHED: "Dispatched",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};
