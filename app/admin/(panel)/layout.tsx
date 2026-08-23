import type { Metadata } from "next";
import Link from "next/link";

import { LogoutButton } from "@/components/admin/logout-button";
import { BRAND } from "@/lib/config/site";
import { requirePanelAccess } from "@/services/admin/auth";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · TT Admin" },
  robots: { index: false, follow: false },
};

const NAV_ITEMS = [
  { label: "Dashboard", href: "/admin", enabled: true },
  { label: "Products", href: "/admin/products", enabled: true },
  { label: "Inventory", href: "/admin/inventory", enabled: true },
  // Orders/Payments/Customers arrive after checkout (Phases 6-8).
  { label: "Orders", href: "/admin/orders", enabled: false },
  { label: "Payments", href: "/admin/payments", enabled: false },
  { label: "Customers", href: "/admin/customers", enabled: false },
  { label: "Analytics", href: "/admin/analytics", enabled: false },
  { label: "Settings", href: "/admin/settings", enabled: false },
] as const;

export default async function AdminPanelLayout({
  children,
}: LayoutProps<"/admin">) {
  const admin = await requirePanelAccess();

  return (
    <div className="flex min-h-dvh flex-col bg-cream-dark">
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-forest text-cream shadow-lg">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <Link href="/admin" className="font-display text-xl tracking-wide">
            {BRAND.name}
            <span className="ml-2 rounded-full bg-plantain px-2 py-0.5 align-middle text-[10px] font-sans font-bold uppercase tracking-widest text-forest">
              Admin
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-xs text-cream/70 sm:inline">
              {admin.email}
            </span>
            <span className="rounded-full border border-plantain/60 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-plantain">
              {admin.role}
            </span>
            <LogoutButton />
          </div>
        </div>

        {/* Section navigation */}
        <nav
          aria-label="Admin sections"
          className="mx-auto max-w-7xl overflow-x-auto px-4 pb-2 sm:px-6"
        >
          <ul className="flex gap-1 text-sm whitespace-nowrap">
            {NAV_ITEMS.map((item) =>
              item.enabled ? (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="inline-block rounded-t-lg px-3 py-2 font-semibold text-cream underline-offset-8 hover:bg-forest-soft hover:underline"
                  >
                    {item.label}
                  </Link>
                </li>
              ) : (
                <li key={item.label}>
                  <span
                    aria-disabled="true"
                    title="Coming in a later phase"
                    className="inline-block cursor-not-allowed rounded-t-lg px-3 py-2 text-cream/40"
                  >
                    {item.label}
                  </span>
                </li>
              )
            )}
          </ul>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>

      <footer className="bg-forest-deep py-4 text-center text-xs text-cream/40">
        {BRAND.name} admin · authorized access only
      </footer>
    </div>
  );
}
