export default function Loading() {
  return (
    <div className="grid h-full grid-cols-2">
      <div className="border-r bg-muted/40" />
      <div className="space-y-4 p-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-5 w-32 animate-pulse rounded bg-muted" />
        <div className="space-y-2 pt-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-muted" />
          ))}
        </div>
      </div>
    </div>
  );
}
