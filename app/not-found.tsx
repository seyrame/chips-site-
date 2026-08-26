import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <span aria-hidden className="text-6xl">
        🍌
      </span>
      <h1 className="mt-6 font-display text-4xl text-forest">Page not found</h1>
      <p className="mt-3 max-w-md text-sm text-charcoal/60">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/shop"
          className="rounded-full bg-forest px-6 py-3 text-sm font-semibold text-cream hover:bg-forest-soft"
        >
          Back to shop
        </Link>
        <Link
          href="/"
          className="rounded-full border border-forest/20 px-6 py-3 text-sm font-semibold text-forest hover:bg-cream-dark"
        >
          Home
        </Link>
      </div>
    </div>
  );
}
