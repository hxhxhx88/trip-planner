"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";

export function TimeAgo({ iso }: { iso: string }) {
  const [label, setLabel] = useState("");
  useEffect(() => {
    const update = () =>
      setLabel(formatDistanceToNow(new Date(iso), { addSuffix: true }));
    update();
    const interval = window.setInterval(update, 60_000);
    return () => window.clearInterval(interval);
  }, [iso]);
  return <span suppressHydrationWarning>{label}</span>;
}
