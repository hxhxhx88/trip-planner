"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontalIcon } from "lucide-react";

import { deletePlan, duplicatePlan, renamePlan } from "@/actions/plans";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  planId: string;
  name: string;
};

export function PlanRowActions({ planId, name }: Props) {
  const router = useRouter();
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(name);
  const [isPending, startTransition] = useTransition();

  const onDuplicate = () => {
    startTransition(async () => {
      const res = await duplicatePlan({ id: planId });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Plan duplicated");
      router.refresh();
    });
  };

  const onRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === name) {
      setRenameOpen(false);
      return;
    }
    startTransition(async () => {
      const res = await renamePlan({ id: planId, name: trimmed });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Plan renamed");
      setRenameOpen(false);
      router.refresh();
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
      setDeleteOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label="Plan actions">
              <MoreHorizontalIcon />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            render={<Link href={`/plans/${planId}/edit`} />}
          >
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            render={<Link href={`/plans/${planId}/settings`} />}
          >
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              setRenameValue(name);
              setRenameOpen(true);
            }}
          >
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onDuplicate} disabled={isPending}>
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={renameOpen} onOpenChange={(next) => setRenameOpen(next)}>
        <DialogContent>
          <form onSubmit={onRenameSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Rename plan</DialogTitle>
              <DialogDescription>
                Give the plan a new name.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor={`rename-${planId}`}>Name</Label>
              <Input
                id={`rename-${planId}`}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                maxLength={120}
                required
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRenameOpen(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending || !renameValue.trim()}
              >
                {isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={(next) => setDeleteOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete plan?</DialogTitle>
            <DialogDescription>
              This will permanently delete &ldquo;{name}&rdquo; and all its days.
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(false)}
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
    </>
  );
}
