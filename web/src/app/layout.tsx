import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "YIMBY Tracker",
  description: "Trigger and monitor the newyorkyimby.com scraper",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
