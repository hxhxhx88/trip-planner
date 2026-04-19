"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function EditorError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Couldn&apos;t load this plan
        </h1>
        <p className="text-muted-foreground">
          Something went wrong while opening the editor.
        </p>
        {error.digest ? (
          <p className="font-mono text-xs text-muted-foreground">
            Reference: {error.digest}
          </p>
        ) : null}
      </div>
      <Button onClick={() => unstable_retry()}>Reload</Button>
    </main>
  );
}
