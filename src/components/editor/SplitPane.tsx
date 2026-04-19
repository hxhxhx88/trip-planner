import type { ReactNode } from "react";

type Props = {
  left: ReactNode;
  right: ReactNode;
};

export function SplitPane({ left, right }: Props) {
  return (
    <div className="grid h-full grid-cols-2">
      <div className="overflow-hidden border-r">{left}</div>
      <div className="overflow-auto">{right}</div>
    </div>
  );
}
