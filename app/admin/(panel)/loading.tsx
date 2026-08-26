export default function AdminLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-forest/20 border-t-forest" />
        <p className="text-sm text-charcoal/50">Loading…</p>
      </div>
    </div>
  );
}
