import type { Metadata } from "next";
import Link from "next/link";

import { getAnalyticsData } from "@/services/admin/analytics";
import { formatMoney } from "@/utils/money";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function AdminDashboardPage({
  searchParams,
}: PageProps<"/admin">) {
  const { denied } = await searchParams;
  const data = await getAnalyticsData();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-4xl text-forest">Dashboard</h1>
        <p className="mt-1 text-sm text-charcoal/70">
          Welcome back. Here&apos;s your business at a glance.
        </p>
      </header>

      {denied ? (
        <p
          role="alert"
          className="rounded-2xl bg-plantain/15 px-5 py-4 text-sm text-charcoal"
        >
          That area requires an OWNER or ADMIN role.
        </p>
      ) : null}

      {/* ── Quick metrics ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashMetric
          label="Revenue"
          value={formatMoney(data.revenue.totalRevenue)}
          href="/admin/payments"
          accent="forest"
        />
        <DashMetric
          label="Orders"
          value={String(data.orders.totalOrders)}
          href="/admin/orders"
          sub={`${data.orders.pendingOrders} pending · ${data.orders.deliveredOrders} delivered`}
        />
        <DashMetric
          label="Products"
          value={String(data.products.activeProducts)}
          href="/admin/products"
          sub={`${data.products.totalVariants} variants`}
        />
        <DashMetric
          label="Customers"
          value={String(data.customers.totalCustomers)}
          href="/admin/customers"
        />
      </div>

      {/* ── Active pipeline ── */}
      <section className="rounded-3xl border border-toast/15 bg-white p-6 sm:p-8">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl text-forest">Needs attention</h2>
          <Link
            href="/admin/orders"
            className="text-xs font-semibold uppercase tracking-widest text-forest hover:text-forest-soft"
          >
            View all orders →
          </Link>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <AttentionCard
            label="Awaiting payment"
            count={data.orders.pendingOrders}
            color="bg-toast/15"
            href="/admin/orders"
          />
          <AttentionCard
            label="To prepare"
            count={data.orders.confirmedOrders + data.orders.preparingOrders}
            color="bg-plantain/25"
            href="/admin/orders"
          />
          <AttentionCard
            label="Low / out of stock"
            count={data.products.lowStockVariants + data.products.outOfStockVariants}
            color="bg-red-100"
            href="/admin/inventory"
            warn={data.products.outOfStockVariants > 0}
          />
        </div>
      </section>

      {/* ── Quick links ── */}
      <section className="rounded-3xl border border-toast/15 bg-white p-6 sm:p-8">
        <h2 className="font-display text-2xl text-forest">Quick actions</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickLink href="/admin/products/new" label="+ New product" />
          <QuickLink href="/admin/inventory" label="Adjust inventory" />
          <QuickLink href="/admin/orders" label="Fulfil orders" />
          <QuickLink href="/admin/settings" label="Store settings" />
        </div>
      </section>

      {/* ── System info ── */}
      <section className="rounded-3xl border border-toast/15 bg-white p-6 sm:p-8">
        <h2 className="font-display text-2xl text-forest">System</h2>
        <ul className="mt-4 space-y-2 text-sm leading-relaxed text-charcoal/80">
          <li>
            Session cookies refresh automatically on every request.
          </li>
          <li>
            Every query runs under Row Level Security — your role comes from the{" "}
            <code className="rounded bg-cream px-1">profiles</code> table, not the JWT.
          </li>
          <li>
            Fulfilment lives in{" "}
            <Link href="/admin/orders" className="font-semibold text-forest hover:underline">
              /admin/orders
            </Link>
            : advance the status workflow, cancel with automatic restock, and issue full
            Paystack refunds.
          </li>
          <li>
            Payments reconciliation is at{" "}
            <Link href="/admin/payments" className="font-semibold text-forest hover:underline">
              /admin/payments
            </Link>
            .
          </li>
        </ul>
      </section>
    </div>
  );
}

function DashMetric({
  label,
  value,
  href,
  sub,
  accent,
}: {
  label: string;
  value: string;
  href: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-3xl border border-toast/15 bg-white p-5 transition-shadow hover:shadow-md"
    >
      <p className="text-xs font-semibold uppercase tracking-widest text-charcoal/50">
        {label}
      </p>
      <p className={`mt-2 font-display text-3xl font-semibold ${accent === "forest" ? "text-forest" : "text-charcoal"}`}>
        {value}
      </p>
      {sub ? (
        <p className="mt-0.5 text-xs text-charcoal/50">{sub}</p>
      ) : null}
    </Link>
  );
}

function AttentionCard({
  label,
  count,
  color,
  href,
  warn,
}: {
  label: string;
  count: number;
  color: string;
  href: string;
  warn?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`${color} rounded-2xl p-5 transition-shadow hover:shadow-md`}
    >
      <p className={`text-3xl font-bold ${warn ? "text-red-700" : "text-charcoal"}`}>
        {count}
      </p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-charcoal/60">
        {label}
      </p>
    </Link>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-forest/20 bg-cream px-5 py-4 text-sm font-semibold text-forest transition-colors hover:bg-forest hover:text-cream"
    >
      {label}
    </Link>
  );
}
