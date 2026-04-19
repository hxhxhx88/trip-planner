"use client";

import type { ReactNode } from "react";
import { APIProvider } from "@vis.gl/react-google-maps";

type Props = { children: ReactNode };

export function MapProvider({ children }: Props) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return <>{children}</>;
  return <APIProvider apiKey={apiKey}>{children}</APIProvider>;
}
