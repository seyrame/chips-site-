import type { Metadata } from "next";

import { listCustomerSummaries } from "@/services/admin/customers";
import { formatMoney } from "@/utils/money";

export const metadata: Metadata = {
  title: "Customers",
};

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "Africa/Accra",
});

export default async function AdminCustomersPage() {
  const customers = await listCustomerSummaries();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-4xl text-forest">Customers</h1>
        <p className="mt-1 text-sm text-charcoal/70">
          {customers.length} customer{customers.length === 1 ? "" : "s"} · built
          automatically from checkout details
        </p>
      </header>

      {customers.length === 0 ? (
        <section className="rounded-3xl border border-toast/15 bg-white p-10 text-center">
          <p className="font-display text-2xl text-forest">No customers yet</p>
          <p className="mt-2 text-sm text-charcoal/70">
            Customers appear here after their first order.
          </p>
        </section>
      ) : (
        <section className="overflow-x-auto rounded-3xl border border-toast/15 bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-toast/15 text-[11px] uppercase tracking-widest text-charcoal/50">
                <th scope="col" className="px-5 py-4 font-semibold">Name</th>
                <th scope="col" className="px-5 py-4 font-semibold">Contact</th>
                <th scope="col" className="px-5 py-4 text-right font-semibold">Orders</th>
                <th scope="col" className="px-5 py-4 text-right font-semibold">Lifetime value</th>
                <th scope="col" className="px-5 py-4 font-semibold">Last order</th>
                <th scope="col" className="px-5 py-4 font-semibold">Customer since</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-toast/10">
              {customers.map((customer) => (
                <tr key={customer.id} className="align-top hover:bg-cream/60">
                  <td className="px-5 py-4 font-semibold">{customer.fullName}</td>
                  <td className="px-5 py-4">
                    <p>{customer.phone ?? "—"}</p>
                    <p className="mt-0.5 break-all text-xs text-charcoal/50">
                      {customer.email ?? ""}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-right">{customer.orderCount}</td>
                  <td className="px-5 py-4 text-right font-semibold">
                    {formatMoney(customer.lifetimeValue)}
                  </td>
                  <td className="px-5 py-4 text-charcoal/80">
                    {customer.lastOrderAt
                      ? DATE_FORMAT.format(new Date(customer.lastOrderAt))
                      : "—"}
                  </td>
                  <td className="px-5 py-4 text-charcoal/50">
                    {DATE_FORMAT.format(new Date(customer.createdAt))}
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
