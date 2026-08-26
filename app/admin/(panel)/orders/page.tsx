import Link from "next/link";
import type { Metadata } from "next";

import { listRecentOrders } from "@/services/admin/orders";
import { formatMoney } from "@/utils/money";

export const metadata: Metadata = {
  title: "Orders",
};

const CREATED_AT_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Africa/Accra",
});

export default async function AdminOrdersPage() {
  const orders = await listRecentOrders();

  const paidCount = orders.filter((o) => o.paymentStatus === "PAID").length;
  const awaitingCount = orders.filter(
    (o) => o.paymentStatus === "PENDING"
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl text-forest">Orders</h1>
          <p className="mt-1 text-sm text-charcoal/70">
            {orders.length} order{orders.length === 1 ? "" : "s"} ·{" "}
            {paidCount} paid · {awaitingCount} awaiting payment
          </p>
        </div>
      </header>

      {orders.length === 0 ? (
        <section className="rounded-3xl border border-toast/15 bg-white p-10 text-center">
          <p className="font-display text-2xl text-forest">No orders yet</p>
          <p className="mt-2 text-sm text-charcoal/70">
            Orders appear here the moment a customer checks out.
          </p>
        </section>
      ) : (
        <section className="overflow-x-auto rounded-3xl border border-toast/15 bg-white">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-toast/15 text-[11px] uppercase tracking-widest text-charcoal/50">
                <th scope="col" className="px-5 py-4 font-semibold">Order</th>
                <th scope="col" className="px-5 py-4 font-semibold">Customer</th>
                <th scope="col" className="px-5 py-4 font-semibold">Deliver to</th>
                <th scope="col" className="px-5 py-4 text-right font-semibold">Items</th>
                <th scope="col" className="px-5 py-4 text-right font-semibold">Total</th>
                <th scope="col" className="px-5 py-4 font-semibold">Payment</th>
                <th scope="col" className="px-5 py-4 font-semibold">Fulfilment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-toast/10">
              {orders.map((order) => (
                <tr key={order.id} className="align-top hover:bg-cream/60">
                  <td className="px-5 py-4">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="font-bold text-forest underline-offset-2 hover:underline"
                    >
                      {order.orderNumber}
                    </Link>
                    <p className="mt-0.5 text-xs text-charcoal/50">
                      {CREATED_AT_FORMAT.format(new Date(order.createdAt))}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <p>{order.customerName}</p>
                    <p className="mt-0.5 text-xs text-charcoal/50">
                      {order.customerPhone}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-charcoal/80">
                    {order.city}
                    <span className="block text-xs text-charcoal/50">
                      {order.region}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">{order.itemCount}</td>
                  <td className="px-5 py-4 text-right font-semibold">
                    {formatMoney(order.total)}
                  </td>
                  <td className="px-5 py-4">
                    <PaymentBadge status={order.paymentStatus} pendingIntent={order.hasPendingIntent} />
                  </td>
                  <td className="px-5 py-4">
                    <FulfilmentBadge status={order.orderStatus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

function PaymentBadge({
  status,
  pendingIntent,
}: {
  status: string;
  pendingIntent: boolean;
}) {
  const styles: Record<string, string> = {
    PAID: "bg-forest text-cream",
    PENDING: "bg-toast/15 text-toast",
    FAILED: "bg-red-100 text-red-800",
    REFUNDED: "bg-charcoal/10 text-charcoal",
  };
  const label =
    status === "PENDING" && pendingIntent
      ? "Awaiting checkout"
      : status.charAt(0) + status.slice(1).toLowerCase();
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${
        styles[status] ?? "bg-charcoal/10 text-charcoal"
      }`}
    >
      {label}
    </span>
  );
}

function FulfilmentBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: "border border-charcoal/20 text-charcoal/70",
    CONFIRMED: "bg-plantain/30 text-forest",
    PREPARING: "bg-plantain/50 text-forest",
    DISPATCHED: "bg-forest/10 text-forest",
    DELIVERED: "bg-forest text-cream",
    CANCELLED: "bg-red-100 text-red-800",
  };
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${
        styles[status] ?? "border border-charcoal/20 text-charcoal/70"
      }`}
    >
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}
