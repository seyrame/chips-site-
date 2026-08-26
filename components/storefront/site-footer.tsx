import Link from "next/link";

import { BRAND } from "@/lib/config/site";

export function SiteFooter({
  whatsappLink,
}: {
  whatsappLink: string | null;
}) {
  return (
    <footer className="bg-forest text-cream">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:grid-cols-3">
        <div>
          <p className="font-display text-2xl">{BRAND.name}</p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-cream/70">
            {BRAND.tagline}. Small-batch, hand-cut plantain chips made in Ghana.
          </p>
        </div>

        <nav aria-label="Footer" className="text-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-plantain">
            Explore
          </p>
          <ul className="mt-4 space-y-2.5">
            <li>
              <Link href="/shop" className="text-cream/80 hover:text-cream">
                Shop all chips
              </Link>
            </li>
            <li>
              <Link href="/#story" className="text-cream/80 hover:text-cream">
                Our story
              </Link>
            </li>
          </ul>
        </nav>

        <div className="text-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-plantain">
            Questions?
          </p>
          {whatsappLink ? (
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-forest-soft px-5 py-2.5 font-medium text-cream transition-colors hover:bg-[#0d6350]"
            >
              Chat with us on WhatsApp
            </a>
          ) : (
            <p className="mt-4 text-cream/60">
              WhatsApp support coming soon — set WHATSAPP_NUMBER to enable chat.
            </p>
          )}
        </div>
      </div>

      <div className="border-t border-cream/10 py-5 text-center text-xs text-cream/40">
        © {new Date().getFullYear()} {BRAND.name} · Made in Ghana
        <span className="mx-2">·</span>
        <span className="space-x-2">
          <Link href="/privacy" className="hover:text-cream/70">Privacy</Link>
          <span>·</span>
          <Link href="/terms" className="hover:text-cream/70">Terms</Link>
          <span>·</span>
          <Link href="/returns" className="hover:text-cream/70">Returns</Link>
        </span>
        <span className="mx-2">·</span>
        Built by Komla
      </div>
    </footer>
  );
}
