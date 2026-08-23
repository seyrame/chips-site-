import type { ReactNode } from "react";

import { SiteFooter } from "@/components/storefront/site-footer";
import { SiteHeader } from "@/components/storefront/site-header";
import {
  WHATSAPP_DEFAULT_MESSAGE,
  buildWhatsAppLink,
} from "@/lib/config/site";

export default function StorefrontLayout({ children }: { children: ReactNode }) {
  const whatsappLink = buildWhatsAppLink(WHATSAPP_DEFAULT_MESSAGE);

  return (
    <>
      <SiteHeader />
      <main className="flex min-h-[70vh] flex-col">{children}</main>
      <SiteFooter whatsappLink={whatsappLink} />
    </>
  );
}
