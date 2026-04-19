import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { ArrowLeftIcon, FileDownIcon, SettingsIcon } from "lucide-react";

import { AutoFillButton } from "@/components/editor/AutoFillButton";
import { ReleaseBanner } from "@/components/editor/ReleaseBanner";
import { Button } from "@/components/ui/button";
import { getPlan } from "@/lib/model/plans";

export default function EditorLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ planId: string }>;
}) {
  return (
    <div className="flex h-screen flex-col">
      <Suspense fallback={<TopbarSkeleton />}>
        <Topbar paramsPromise={params} />
      </Suspense>
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

async function Topbar({
  paramsPromise,
}: {
  paramsPromise: Promise<{ planId: string }>;
}) {
  const { planId } = await paramsPromise;
  const plan = await getPlan(planId);
  return (
    <header className="flex items-center justify-between border-b px-4 py-2">
      <div className="flex items-center gap-2 text-sm">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" />
          All plans
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium">{plan?.name ?? "Unknown plan"}</span>
      </div>
      <div className="flex items-center gap-1">
        <Link href={`/plans/${planId}/settings`}>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Plan settings"
            className="gap-1"
          >
            <SettingsIcon className="size-4" />
            Settings
          </Button>
        </Link>
        <AutoFillButton planId={planId} isDirty={plan?.dirtySince != null} />
        <ReleaseBanner
          planId={planId}
          releasedSlug={plan?.releasedSlug ?? null}
        />
        <Link
          href={`/plans/${planId}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button
            variant="ghost"
            size="sm"
            aria-label="Download PDF"
            className="gap-1"
          >
            <FileDownIcon className="size-4" />
            PDF
          </Button>
        </Link>
      </div>
    </header>
  );
}

function TopbarSkeleton() {
  return (
    <header className="flex items-center justify-between border-b px-4 py-2">
      <div className="h-5 w-40 animate-pulse rounded bg-muted" />
      <div className="flex items-center gap-1">
        <div className="h-8 w-20 animate-pulse rounded bg-muted" />
        <div className="h-8 w-20 animate-pulse rounded bg-muted" />
        <div className="h-8 w-20 animate-pulse rounded bg-muted" />
      </div>
    </header>
  );
}
