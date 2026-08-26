export default function StorefrontLoading() {
  return (
    <div className="mx-auto flex w-full max-w-7xl animate-pulse flex-col gap-6 px-4 py-12 sm:px-6">
      <div className="h-8 w-48 rounded-full bg-cream-dark" />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-3xl border border-toast/10 bg-white p-4">
            <div className="aspect-square rounded-2xl bg-cream-dark" />
            <div className="mt-4 h-4 w-3/4 rounded-full bg-cream-dark" />
            <div className="mt-2 h-3 w-1/2 rounded-full bg-cream-dark" />
          </div>
        ))}
      </div>
    </div>
  );
}
