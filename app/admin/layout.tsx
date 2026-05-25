import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin — Gild Society",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen-safe bg-gs-surface">{children}</div>;
}
