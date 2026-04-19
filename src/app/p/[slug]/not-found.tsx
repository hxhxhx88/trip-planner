export default function ReleasedNotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
        404
      </p>
      <h1 className="text-2xl font-semibold tracking-tight">
        This trip is no longer shared
      </h1>
      <p className="text-sm text-muted-foreground">
        The owner may have unreleased the link or removed the plan.
      </p>
    </main>
  );
}
