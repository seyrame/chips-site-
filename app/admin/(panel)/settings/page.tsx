import type { Metadata } from "next";

import { SettingsForm } from "@/components/admin/settings-form";
import { getAppSettings } from "@/services/admin/settings";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function AdminSettingsPage() {
  const settings = await getAppSettings();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-4xl text-forest">Settings</h1>
        <p className="mt-1 text-sm text-charcoal/70">
          Manage store-wide configuration. Changes take effect immediately.
        </p>
      </header>

      <SettingsForm settings={settings} />
    </div>
  );
}
