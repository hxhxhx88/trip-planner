"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

type Props = {
  onAdd: () => void;
  disabled?: boolean;
};

export function AddEventButton({ onAdd, disabled }: Props) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onAdd}
      disabled={disabled}
      className="w-full justify-start text-muted-foreground"
    >
      <Plus className="size-4" />
      Add event
    </Button>
  );
}
