import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import PwaRegistry from "@/components/PwaRegistry";
import ConvexClientProvider from "@/components/ConvexClientProvider";
import { TrackDailyProvider } from "@/context/TrackDailyContext";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

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
  themeColor: "#09090b",
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
  return (
    <html lang="en" className={`${jakarta.variable} h-full antialiased`}>
      <body className="font-jakarta min-h-full flex flex-col selection:bg-purple-500/30 selection:text-purple-200">
        <PwaRegistry />
        <ConvexClientProvider>
          <TrackDailyProvider>
            <main className="flex-1 flex flex-col max-w-md w-full mx-auto relative px-4 md:px-0">
              {children}
            </main>
          </TrackDailyProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
