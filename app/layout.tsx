import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Gild Society — Your Neighborhood, Your News",
  description:
    "Hyper-local newsletters for your neighborhood. Real news, real neighbors, real community.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://gildsociety.com"
  ),
  openGraph: {
    title: "Gild Society",
    description: "Keeping the community safe together.",
    siteName: "Gild Society",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${nunito.variable} h-full`}>
      <body className="min-h-full flex flex-col font-nunito antialiased bg-gs-surface text-gs-dark">
        {children}
      </body>
    </html>
  );
}
