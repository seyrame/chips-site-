export default async function AdminDashboardPage({
  searchParams,
}: PageProps<"/admin">) {
  const { denied } = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-4xl text-forest">Dashboard</h1>
        <p className="mt-1 text-sm text-charcoal/70">
          Authentication is live. Business metrics arrive with Phase 8.
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

      <section className="rounded-3xl border border-toast/15 bg-white p-8">
        <h2 className="font-display text-2xl text-forest">
          You&apos;re signed in securely
        </h2>
        <ul className="mt-4 list-inside list-disc space-y-2 text-sm leading-relaxed text-charcoal/80">
          <li>Session cookies refresh automatically on every request.</li>
          <li>
            Every query here runs under Row Level Security — your role comes
            from the <code className="rounded bg-cream px-1">profiles</code>{" "}
            table, not the JWT.
          </li>
          <li>
            Next up (Phase 4): product &amp; variant management on top of the
            catalog schema.
          </li>
        </ul>
      </section>
    </div>
  );
}
