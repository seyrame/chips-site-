import type { Metadata } from "next";
import Link from "next/link";

import { StockAdjuster } from "@/components/admin/stock-adjuster";
import {
  listInventoryRows,
  listRecentMovements,
} from "@/services/admin/products";
import { formatMoney } from "@/utils/money";

export const metadata: Metadata = {
  title: "Inventory",
};

const REASON_LABELS: Record<string, string> = {
  INITIAL_STOCK: "Initial stock",
  ORDER_PLACED: "Order placed",
  ORDER_CANCELLED_RESTOCK: "Order cancelled — restocked",
  ADMIN_ADJUSTMENT: "Manual adjustment",
};

export default async function AdminInventoryPage() {
  const [rows, movements] = await Promise.all([
    listInventoryRows(),
    listRecentMovements(),
  ]);

  const lowCount = rows.filter(
    (r) =>
      r.active &&
      r.stockQuantity > 0 &&
      r.stockQuantity <= r.lowStockThreshold
  ).length;
  const outCount = rows.filter(
    (r) => r.active && r.stockQuantity === 0
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-4xl text-forest">Inventory</h1>
        <p className="mt-1 flex flex-wrap gap-x-4 text-sm text-charcoal/70">
          <span>{rows.length} variants</span>
          {lowCount > 0 ? (
            <span className="font-semibold text-toast">
              {lowCount} running low
            </span>
          ) : null}
          {outCount > 0 ? (
            <span className="font-semibold text-red-700">
              {outCount} out of stock
            </span>
          ) : null}
        </p>
      </header>

      {/* ── Variant stock levels ── */}
      <section className="overflow-hidden rounded-3xl border border-toast/15 bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-toast/15 bg-cream-dark text-left text-xs uppercase tracking-widest text-charcoal/60">
              <th className="px-5 py-3 font-semibold">Product / variant</th>
              <th className="px-3 py-3 font-semibold">Price</th>
              <th className="px-3 py-3 font-semibold">Stock</th>
              <th className="px-5 py-3 font-semibold">Adjust</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const out = row.stockQuantity === 0;
              const low =
                !out &&
                row.stockQuantity <= row.lowStockThreshold;
              return (
                <tr
                  key={row.variantId}
                  className="border-b border-toast/10 last:border-b-0"
                >
                  <td className="px-5 py-3.5">
                    <Link
                      href={`/admin/products/${row.productId}`}
                      className="font-semibold text-forest hover:underline"
                    >
                      {row.productName}
                    </Link>
                    <span className="text-charcoal/50"> · {row.variantName}</span>
                    {!row.active ? (
                      <span className="ml-2 rounded-full bg-charcoal/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-charcoal/60">
                        Inactive
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-3.5 whitespace-nowrap text-charcoal/80">
                    {formatMoney(row.price)}
                  </td>
                  <td className="px-3 py-3.5">
                    <span
                      className={`inline-flex h-8 w-14 items-center justify-center rounded-lg font-bold ${
                        out
                          ? "bg-red-100 text-red-800"
                          : low
                            ? "bg-plantain/30 text-charcoal"
                            : "bg-forest/10 text-forest"
                      }`}
                      title={
                        out
                          ? "Out of stock"
                          : low
                            ? "At or below the low-stock threshold"
                            : undefined
                      }
                    >
                      {row.stockQuantity}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    {row.active ? (
                      <StockAdjuster variantId={row.variantId} />
                    ) : (
                      <span className="text-xs text-charcoal/40">
                        Activate variant to adjust
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* ── Movement audit trail ── */}
      <section className="rounded-3xl border border-toast/15 bg-white p-6 sm:p-8">
        <h2 className="font-display text-2xl text-forest">Recent movements</h2>
        {movements.length === 0 ? (
          <p className="mt-4 text-sm text-charcoal/50">No movements recorded.</p>
        ) : (
          <ul className="mt-4 divide-y divide-toast/10 text-sm">
            {movements.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5"
              >
                <span
                  className={`w-16 rounded-md px-2 py-0.5 text-center text-xs font-bold ${
                    m.delta >= 0
                      ? "bg-forest/10 text-forest"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {m.delta >= 0 ? `+${m.delta}` : m.delta}
                </span>
                <span className="rounded-md bg-cream px-2 py-0.5 text-xs uppercase tracking-widest text-charcoal/60">
                  {REASON_LABELS[m.reason] ?? m.reason}
                </span>
                {m.note ? (
                  <span className="text-charcoal/70">{m.note}</span>
                ) : null}
                <time
                  dateTime={new Date(m.created_at).toISOString()}
                  className="ml-auto text-xs whitespace-nowrap text-charcoal/40"
                >
                  {new Date(m.created_at).toLocaleString("en-GB", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
