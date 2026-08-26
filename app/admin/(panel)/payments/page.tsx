import type { Metadata } from "next";
import Link from "next/link";

import { BRAND } from "@/lib/config/site";
import { listRecentPayments, getPaymentStatusBreakdown } from "@/services/admin/payments";
import { formatMoney } from "@/utils/money";

export const metadata: Metadata = {
  title: "Payments",
};

const CREATED_AT_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: BRAND.timezone,
});

export default async function AdminPaymentsPage() {
  const [payments, breakdown] = await Promise.all([
    listRecentPayments(),
    getPaymentStatusBreakdown(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-4xl text-forest">Payments</h1>
        <p className="mt-1 text-sm text-charcoal/70">
          {payments.length} payment attempt{payments.length === 1 ? "" : "s"} ·
          Reconciliation view for Paystack transactions
        </p>
      </header>

      {/* ── Summary cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Total settled" value={formatMoney(breakdown.totalAmount)} accent="forest" />
        <SummaryCard label="Successful" value={String(breakdown.paid)} sub="payments" accent="forest" />
        <SummaryCard label="Pending" value={String(breakdown.pending)} sub="payments" accent="toast" />
        <SummaryCard
          label="Failed / Refunded"
          value={String(breakdown.failed + breakdown.refunded)}
          sub="payments"
          accent="red"
        />
      </div>

      {/* ── Payments table ── */}
      {payments.length === 0 ? (
        <section className="rounded-3xl border border-toast/15 bg-white p-10 text-center">
          <p className="font-display text-2xl text-forest">No payments yet</p>
          <p className="mt-2 text-sm text-charcoal/70">
            Payment attempts appear here as customers check out.
          </p>
        </section>
      ) : (
        <section className="overflow-x-auto rounded-3xl border border-toast/15 bg-white">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead>
              <tr className="border-b border-toast/15 text-[11px] uppercase tracking-widest text-charcoal/50">
                <th scope="col" className="px-5 py-4 font-semibold">Order</th>
                <th scope="col" className="px-5 py-4 font-semibold">Customer</th>
                <th scope="col" className="px-5 py-4 font-semibold">Reference</th>
                <th scope="col" className="px-5 py-4 text-right font-semibold">Amount</th>
                <th scope="col" className="px-5 py-4 font-semibold">Channel</th>
                <th scope="col" className="px-5 py-4 font-semibold">Status</th>
                <th scope="col" className="px-5 py-4 font-semibold">Created</th>
                <th scope="col" className="px-5 py-4 font-semibold">Paid at</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-toast/10">
              {payments.map((p) => (
                <tr key={p.id} className="align-top hover:bg-cream/60">
                  <td className="px-5 py-4">
                    <Link
                      href={`/admin/orders/${p.orderId}`}
                      className="font-bold text-forest underline-offset-2 hover:underline"
                    >
                      {p.orderNumber}
                    </Link>
                  </td>
                  <td className="px-5 py-4">{p.customerName}</td>
                  <td className="px-5 py-4">
                    <code className="rounded bg-cream-dark px-1.5 py-0.5 text-[11px]">
                      {p.paystackReference}
                    </code>
                  </td>
                  <td className="px-5 py-4 text-right font-semibold">
                    {formatMoney(p.amount)}
                  </td>
                  <td className="px-5 py-4 text-charcoal/70">
                    {p.channel ?? "—"}
                  </td>
                  <td className="px-5 py-4">
                    <PaymentBadge status={p.status} />
                  </td>
                  <td className="px-5 py-4 text-charcoal/60">
                    {CREATED_AT_FORMAT.format(new Date(p.createdAt))}
                  </td>
                  <td className="px-5 py-4 text-charcoal/60">
                    {p.paidAt
                      ? CREATED_AT_FORMAT.format(new Date(p.paidAt))
                      : "—"}
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

function SummaryCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent: "forest" | "toast" | "red";
}) {
  const colors = {
    forest: "bg-forest/10 text-forest",
    toast: "bg-toast/15 text-toast-dark",
    red: "bg-red-100 text-red-800",
  };
  return (
    <div className="rounded-3xl border border-toast/15 bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-charcoal/50">
        {label}
      </p>
      <p className={`mt-2 font-display text-3xl font-semibold ${colors[accent].split(" ")[1]}`}>
        {value}
      </p>
      {sub ? (
        <p className="mt-0.5 text-xs text-charcoal/50">{sub}</p>
      ) : null}
    </div>
  );
}

function PaymentBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PAID: "bg-forest text-cream",
    PENDING: "bg-toast/15 text-toast",
    FAILED: "bg-red-100 text-red-800",
    REFUNDED: "bg-charcoal/10 text-charcoal",
  };
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${
        styles[status] ?? "bg-charcoal/10 text-charcoal"
      }`}
    >
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}
