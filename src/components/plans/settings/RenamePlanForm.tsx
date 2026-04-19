"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { renamePlan } from "@/actions/plans";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = { planId: string; initialName: string };

export function RenamePlanForm({ planId, initialName }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [isPending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const res = await renamePlan({ id: planId, name: trimmed });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Name updated");
      router.refresh();
    });
  };

  const dirty = name.trim() !== initialName && name.trim().length > 0;

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="settings-name">Name</Label>
        <Input
          id="settings-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          required
        />
      </div>
      <Button type="submit" disabled={!dirty || isPending}>
        {isPending ? "Saving..." : "Save"}
      </Button>
    </form>
  );
}
