"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { deletePlan, duplicatePlan } from "@/actions/plans";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = { planId: string; planName: string };

export function DangerZone({ planId, planName }: Props) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const onDuplicate = () => {
    startTransition(async () => {
      const res = await duplicatePlan({ id: planId });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Plan duplicated");
      router.push(`/plans/${res.data.id}/settings`);
    });
  };

  const onDelete = () => {
    startTransition(async () => {
      const res = await deletePlan({ id: planId });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Plan deleted");
      setConfirmOpen(false);
      router.push("/");
    });
  };

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <div>
          <h3 className="text-sm font-medium">Duplicate plan</h3>
          <p className="text-sm text-muted-foreground">
            Make a copy of this plan as a new draft.
          </p>
        </div>
        <Button variant="outline" onClick={onDuplicate} disabled={isPending}>
          {isPending ? "Working..." : "Duplicate"}
        </Button>
      </section>

      <section className="space-y-2 rounded-lg border border-destructive/30 p-4">
        <div>
          <h3 className="text-sm font-medium text-destructive">Delete plan</h3>
          <p className="text-sm text-muted-foreground">
            Permanently remove this plan, its days, events, and travels.
          </p>
        </div>
        <Button
          variant="destructive"
          onClick={() => setConfirmOpen(true)}
          disabled={isPending}
        >
          Delete plan
        </Button>
      </section>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete plan?</DialogTitle>
            <DialogDescription>
              This will permanently delete &ldquo;{planName}&rdquo; and all its
              contents. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={onDelete}
              disabled={isPending}
            >
              {isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
