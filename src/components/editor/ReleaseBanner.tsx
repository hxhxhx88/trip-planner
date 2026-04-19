"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Copy, ExternalLink, Loader2Icon, X } from "lucide-react";
import { toast } from "sonner";

import { releasePlan, unreleasePlan } from "@/actions/release";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type Props = {
  planId: string;
  releasedSlug: string | null;
};

export function ReleaseBanner({ planId, releasedSlug }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const onRelease = () => {
    if (isPending) return;
    startTransition(async () => {
      const res = await releasePlan({ planId });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Released · link ready to share");
      router.refresh();
    });
  };

  if (!releasedSlug) {
    return (
      <Button
        type="button"
        size="sm"
        onClick={onRelease}
        disabled={isPending}
        className="gap-1"
      >
        {isPending ? (
          <Loader2Icon className="size-3.5 animate-spin" />
        ) : null}
        Release
      </Button>
    );
  }

  return (
    <ReleasedPopover
      planId={planId}
      slug={releasedSlug}
      isPending={isPending}
      startTransition={startTransition}
      router={router}
    />
  );
}

function ReleasedPopover({
  planId,
  slug,
  isPending,
  startTransition,
  router,
}: {
  planId: string;
  slug: string;
  isPending: boolean;
  startTransition: (fn: () => void) => void;
  router: ReturnType<typeof useRouter>;
}) {
  const [copied, setCopied] = useState(false);

  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/p/${slug}`
      : `/p/${slug}`;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied");
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copy failed — select the URL manually");
    }
  };

  const onUnrelease = () => {
    if (isPending) return;
    startTransition(async () => {
      const res = await unreleasePlan({ planId });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Unreleased · link retracted");
      router.refresh();
    });
  };

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1 border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400"
          >
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full bg-emerald-500"
            />
            Released
          </Button>
        }
      />
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Shareable link
            </p>
            <div className="mt-1 flex items-center gap-1 rounded-md border bg-muted/30 px-2 py-1.5">
              <code className="min-w-0 flex-1 truncate text-xs">{url}</code>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Copy link"
                className="size-7 p-0"
                onClick={onCopy}
              >
                {copied ? (
                  <Check className="size-3.5" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </Button>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open in new tab"
                className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ExternalLink className="size-3.5" />
              </a>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Anyone with the link can view this plan. Edits propagate on next
            reload.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full gap-1"
            onClick={onUnrelease}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2Icon className="size-3.5 animate-spin" />
            ) : (
              <X className="size-3.5" />
            )}
            Unrelease
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
