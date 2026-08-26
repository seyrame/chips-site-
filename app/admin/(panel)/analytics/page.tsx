import type { Metadata } from "next";

import { getAnalyticsData } from "@/services/admin/analytics";
import { formatMoney } from "@/utils/money";

export const metadata: Metadata = {
  title: "Analytics",
};

export default async function AdminAnalyticsPage() {
  const data = await getAnalyticsData();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-4xl text-forest">Analytics</h1>
        <p className="mt-1 text-sm text-charcoal/70">
          Business performance overview — revenue, orders, products and customers.
        </p>
      </header>

      {/* ── Revenue overview ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total revenue"
          value={formatMoney(data.revenue.totalRevenue)}
          description={`${data.revenue.paidOrderCount} paid orders`}
        />
        <MetricCard
          label="Average order value"
          value={formatMoney(data.revenue.averageOrderValue)}
          description="Across paid orders"
        />
        <MetricCard
          label="Total orders"
          value={String(data.orders.totalOrders)}
          description={`${data.orders.cancelledOrders} cancelled`}
        />
        <MetricCard
          label="Total customers"
          value={String(data.customers.totalCustomers)}
          description="Registered customers"
        />
      </div>

      {/* ── Order funnel ── */}
      <section className="rounded-3xl border border-toast/15 bg-white p-6 sm:p-8">
        <h2 className="font-display text-2xl text-forest">Order pipeline</h2>
        <p className="mt-1 text-sm text-charcoal/60">
          Current distribution of orders across fulfilment stages.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <FunnelStat label="Pending" count={data.orders.pendingOrders} color="cream-dark" />
          <FunnelStat label="Confirmed" count={data.orders.confirmedOrders} color="forest-soft/15" />
          <FunnelStat label="Preparing" count={data.orders.preparingOrders} color="plantain/25" />
          <FunnelStat label="Dispatched" count={data.orders.dispatchedOrders} color="toast/20" />
          <FunnelStat label="Delivered" count={data.orders.deliveredOrders} color="forest/10" />
          <FunnelStat label="Cancelled" count={data.orders.cancelledOrders} color="red-100" />
        </div>
      </section>

      {/* ── Product health ── */}
      <section className="rounded-3xl border border-toast/15 bg-white p-6 sm:p-8">
        <h2 className="font-display text-2xl text-forest">Product health</h2>
        <p className="mt-1 text-sm text-charcoal/60">
          Inventory status and catalog overview.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatBox label="Active products" value={String(data.products.activeProducts)} />
          <StatBox label="Featured" value={String(data.products.featuredProducts)} />
          <StatBox label="Total variants" value={String(data.products.totalVariants)} />
          <StatBox
            label="Low stock"
            value={String(data.products.lowStockVariants)}
            warn={data.products.lowStockVariants > 0}
          />
          <StatBox
            label="Out of stock"
            value={String(data.products.outOfStockVariants)}
            danger={data.products.outOfStockVariants > 0}
          />
        </div>
      </section>

      {/* ── Revenue chart (text-based sparkline) ── */}
      <section className="rounded-3xl border border-toast/15 bg-white p-6 sm:p-8">
        <h2 className="font-display text-2xl text-forest">Revenue — last 30 days</h2>
        <p className="mt-1 text-sm text-charcoal/60">
          Daily settled payment volume.
        </p>

        {data.dailyRevenue.some((d) => d.revenue > 0) ? (
          <div className="mt-5">
            <div className="flex items-end gap-[3px]" style={{ height: 120 }}>
              {data.dailyRevenue.map((day) => {
                const max = Math.max(...data.dailyRevenue.map((d) => d.revenue), 1);
                const height = Math.max(2, (day.revenue / max) * 100);
                return (
                  <div
                    key={day.date}
                    className="group relative flex-1"
                    style={{ height: `${height}%` }}
                  >
                    <div className="h-full w-full rounded-t-sm bg-forest/80 transition-colors group-hover:bg-forest" />
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-charcoal px-2.5 py-1.5 text-[10px] text-cream shadow-lg group-hover:block">
                      {day.date}
                      <br />
                      {formatMoney(day.revenue)} · {day.orderCount} orders
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-charcoal/40">
              <span>{data.dailyRevenue[0]?.date}</span>
              <span>{data.dailyRevenue[data.dailyRevenue.length - 1]?.date}</span>
            </div>
          </div>
        ) : (
          <p className="mt-5 text-sm text-charcoal/50">
            No settled payments in the last 30 days yet.
          </p>
        )}
      </section>

      {/* ── Top products ── */}
      <section className="rounded-3xl border border-toast/15 bg-white p-6 sm:p-8">
        <h2 className="font-display text-2xl text-forest">Top products</h2>
        <p className="mt-1 text-sm text-charcoal/60">
          Ranked by total revenue from non-cancelled orders.
        </p>

        {data.topProducts.length > 0 ? (
          <ul className="mt-5 divide-y divide-toast/10">
            {data.topProducts.map((product, index) => (
              <li
                key={product.productName}
                className="flex items-center gap-4 py-3"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-forest/10 text-xs font-bold text-forest">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-charcoal">
                    {product.productName}
                  </p>
                  <p className="text-xs text-charcoal/50">
                    {product.totalQuantity} units sold
                  </p>
                </div>
                <p className="shrink-0 font-semibold text-forest">
                  {formatMoney(product.totalRevenue)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-5 text-sm text-charcoal/50">
            No product sales recorded yet.
          </p>
        )}
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-toast/15 bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-charcoal/50">
        {label}
      </p>
      <p className="mt-2 font-display text-3xl font-semibold text-forest">
        {value}
      </p>
      <p className="mt-0.5 text-xs text-charcoal/50">{description}</p>
    </div>
  );
}

const FUNNEL_COLORS: Record<string, string> = {
  "cream-dark": "bg-cream-dark",
  "forest-soft/15": "bg-forest-soft/15",
  "plantain/25": "bg-plantain/25",
  "toast/20": "bg-toast/20",
  "forest/10": "bg-forest/10",
  "red-100": "bg-red-100",
};

function FunnelStat({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  return (
    <div className={`rounded-2xl p-4 text-center ${FUNNEL_COLORS[color] ?? "bg-cream-dark"}`}>
      <p className="text-2xl font-bold text-charcoal">{count}</p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-charcoal/60">
        {label}
      </p>
    </div>
  );
}

function StatBox({
  label,
  value,
  warn,
  danger,
}: {
  label: string;
  value: string;
  warn?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-cream p-4 text-center">
      <p
        className={`text-2xl font-bold ${
          danger ? "text-red-700" : warn ? "text-toast" : "text-forest"
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-charcoal/60">{label}</p>
    </div>
  );
}
