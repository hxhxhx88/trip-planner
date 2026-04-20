"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { setPlanLanguage, type PlanLanguage } from "@/actions/plans";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = { planId: string; initialLanguage: string };

const LANGUAGES: { value: PlanLanguage; label: string }[] = [
  { value: "en", label: "English" },
  { value: "zh-TW", label: "繁體中文 (Traditional Chinese)" },
];

export function LanguageForm({ planId, initialLanguage }: Props) {
  const router = useRouter();
  const [language, setLanguage] = useState<PlanLanguage>(
    isPlanLanguage(initialLanguage) ? initialLanguage : "en",
  );
  const [isPending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (language === initialLanguage) return;
    startTransition(async () => {
      const res = await setPlanLanguage({ id: planId, language });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Language updated");
      router.refresh();
    });
  };

  const dirty = language !== initialLanguage;

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="settings-lang">Language</Label>
        <Select
          value={language}
          onValueChange={(v) => {
            if (v && isPlanLanguage(v)) setLanguage(v);
          }}
        >
          <SelectTrigger id="settings-lang" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Used for place names, addresses, and categories returned by Google
          when searching new places.
        </p>
      </div>
      <Button type="submit" disabled={!dirty || isPending}>
        {isPending ? "Saving..." : "Save"}
      </Button>
    </form>
  );
}

function isPlanLanguage(v: string): v is PlanLanguage {
  return v === "en" || v === "zh-TW";
}
