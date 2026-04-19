import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { MapProvider } from "@/components/map/MapProvider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Travel Planner",
  description: "Human-in-the-loop trip itinerary planner.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <MapProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </MapProvider>
        <Toaster />
      </body>
    </html>
  );
}
