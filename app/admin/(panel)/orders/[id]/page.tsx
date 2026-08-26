import Link from "next/link";
import { notFound } from "next/navigation";

import { BRAND } from "@/lib/config/site";
import { OrderFulfilmentControls } from "@/components/admin/order-status-controls";
import { formatMoney } from "@/utils/money";
import { getOrderDetail } from "@/services/admin/orders";

export const dynamic = "force-dynamic";

const PAYMENT_BADGE_CLASS: Record<string, string> = {
  PENDING: "bg-cream-dark text-charcoal",
  PAID: "bg-forest-soft/15 text-forest",
  FAILED: "bg-red-50 text-red-700",
  REFUNDED: "bg-toast/15 text-toast-dark",
};

const ORDER_BADGE_CLASS: Record<string, string> = {
  PENDING: "bg-cream-dark text-charcoal",
  CONFIRMED: "bg-forest-soft/15 text-forest",
  PREPARING: "bg-plantain/25 text-charcoal",
  DISPATCHED: "bg-toast/20 text-toast-dark",
  DELIVERED: "bg-forest text-cream",
  CANCELLED: "bg-red-100 text-red-800",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: BRAND.timezone,
  });
}

export default async function AdminOrderDetailPage({
  params,
}: PageProps<"/admin/orders/[id]">) {
  const { id } = await params;
  const detail = await getOrderDetail(id);
  if (!detail) notFound();

  const { order, items, payments } = detail;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <Link
        href="/admin/orders"
        className="text-xs font-semibold uppercase tracking-wide text-toast hover:text-toast-dark"
      >
        ← All orders
      </Link>

      <header className="mt-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-forest">
            Order {order.order_number}
          </h1>
          <p className="mt-1 text-sm text-charcoal/60">
            Placed {formatDate(order.created_at)} · Ref{" "}
            <code className="rounded bg-cream-dark px-1.5 py-0.5 text-[11px]">
              {order.paystack_reference ?? "no payment intent"}
            </code>
          </p>
        </div>
        <div className="flex gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${ORDER_BADGE_CLASS[order.order_status] ?? ""}`}
          >
            {order.order_status}
          </span>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${PAYMENT_BADGE_CLASS[order.payment_status] ?? ""}`}
          >
            {order.payment_status}
          </span>
        </div>
      </header>

      {/* Workflow + refunds */}
      <section className="mt-6 rounded-3xl border border-toast/15 bg-white p-6 sm:p-8">
        <OrderFulfilmentControls
          orderId={order.id}
          currentStatus={order.order_status}
          canRefund={order.payment_status === "PAID"}
        />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        {/* Items */}
        <section className="rounded-3xl border border-toast/15 bg-white p-6 sm:p-8 lg:col-span-3">
          <h2 className="font-display text-xl font-semibold text-forest">Items</h2>
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-charcoal/50">
                <th className="pb-2">Product</th>
                <th className="pb-2 text-center">Qty</th>
                <th className="pb-2 text-right">Unit</th>
                <th className="pb-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-toast/10">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="py-2.5 pr-2">
                    <span className="font-medium">{item.product_name}</span>
                    <span className="block text-xs text-charcoal/50">
                      {item.variant_name}
                    </span>
                  </td>
                  <td className="py-2.5 text-center">{item.quantity}</td>
                  <td className="py-2.5 text-right">{formatMoney(item.unit_price)}</td>
                  <td className="py-2.5 text-right font-semibold">
                    {formatMoney(item.subtotal)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="text-sm">
                <td colSpan={3} className="pt-3 text-right text-charcoal/60">
                  Subtotal
                </td>
                <td className="pt-3 text-right">{formatMoney(order.subtotal)}</td>
              </tr>
              <tr className="text-sm">
                <td colSpan={3} className="pt-1 text-right text-charcoal/60">
                  Delivery — {order.region}, {order.city}
                </td>
                <td className="pt-1 text-right">{formatMoney(order.delivery_fee)}</td>
              </tr>
              <tr>
                <td colSpan={3} className="pt-2 text-right font-semibold text-forest">
                  Total
                </td>
                <td className="pt-2 text-right font-display text-lg font-bold text-forest">
                  {formatMoney(order.total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </section>

        {/* Customer + delivery */}
        <div className="grid content-start gap-6 lg:col-span-2">
          <section className="rounded-3xl border border-toast/15 bg-white p-6">
            <h2 className="font-display text-xl font-semibold text-forest">Customer</h2>
            <dl className="mt-3 grid gap-2 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-charcoal/50">Name</dt>
                <dd>{order.customer_name}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-charcoal/50">Email</dt>
                <dd className="break-all">{order.customer_email}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-charcoal/50">Phone</dt>
                <dd>{order.customer_phone}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-3xl border border-toast/15 bg-white p-6">
            <h2 className="font-display text-xl font-semibold text-forest">Delivery</h2>
            <p className="mt-3 text-sm leading-relaxed">
              {order.delivery_address}
              <br />
              {order.city}, {order.region}
            </p>
            {order.delivery_instructions ? (
              <p className="mt-3 rounded-xl bg-cream-dark px-3 py-2 text-sm italic text-charcoal/70">
                “{order.delivery_instructions}”
              </p>
            ) : null}
          </section>
        </div>
      </div>

      {/* Payment attempts */}
      <section className="mt-6 rounded-3xl border border-toast/15 bg-white p-6 sm:p-8">
        <h2 className="font-display text-xl font-semibold text-forest">
          Payment attempts ({payments.length})
        </h2>
        {payments.length === 0 ? (
          <p className="mt-3 text-sm text-charcoal/60">No payment attempts recorded.</p>
        ) : (
          <ul className="mt-4 divide-y divide-toast/10 text-sm">
            {payments.map((payment) => (
              <li key={payment.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${PAYMENT_BADGE_CLASS[payment.status] ?? ""}`}
                >
                  {payment.status}
                </span>
                <span className="font-semibold">{formatMoney(payment.amount)}</span>
                {payment.channel ? (
                  <span className="text-charcoal/60">{payment.channel}</span>
                ) : null}
                <span className="text-charcoal/50">
                  created {formatDate(payment.created_at)}
                </span>
                {payment.paid_at ? (
                  <span className="text-charcoal/50">paid {formatDate(payment.paid_at)}</span>
                ) : null}
                {payment.gateway_response ? (
                  <span className="w-full truncate text-xs text-charcoal/40">
                    {payment.gateway_response}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
