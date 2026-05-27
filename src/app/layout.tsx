import type { Metadata, Viewport } from "next";
import PwaRegistry from "@/components/PwaRegistry";
import ConvexClientProvider from "@/components/ConvexClientProvider";
import { TrackDailyProvider } from "@/context/TrackDailyContext";
import { ToastProvider } from "@/components/Toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "LifeOS",
  description: "Personal planning, habits, and behavioral analytics hub.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "LifeOS",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#f6f7f9",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const serverMissingEnv = !process.env.CLERK_JWT_ISSUER_DOMAIN
    ? ["CLERK_JWT_ISSUER_DOMAIN"]
    : [];

  return (
    <html lang="en" className="h-full antialiased">
      <body className="font-jakarta min-h-full flex flex-col selection:bg-sky-200 selection:text-slate-950">
        <PwaRegistry />
        <ConvexClientProvider serverMissingEnv={serverMissingEnv}>
          <TrackDailyProvider>
            <ToastProvider>{children}</ToastProvider>
          </TrackDailyProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
