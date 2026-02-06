import { Geist_Mono, Space_Grotesk } from "next/font/google";

import "@stellarUI/globals.css";
import { Providers } from "@/components/providers/providers";
import Toaster from "@stellarUI/components/Sonner/Sonner";
import { PublicEnv } from "@/lib/public-env";
import TitleBar from "@/components/desktop/TitleBar";

const fontSans = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata = {
  title: "StellarStack",
  description: "StellarStack - Modern web application",
  icons: {
    icon: "/favicon/favicon.ico",
    shortcut: "/favicon/favicon.ico",
    apple: "/favicon/apple-touch-icon.png",
    other: {
      rel: "apple-touch-icon-precomposed",
      url: "/favicon/apple-touch-icon.png",
    },
  },
  manifest: "/favicon/site.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon/favicon.svg" />
        <link rel="icon" type="image/png" href="/favicon/favicon-96x96.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/favicon/apple-touch-icon.png" />
        <meta name="theme-color" content="#000000" />
      </head>
      <body className={`${fontSans.variable} ${fontMono.variable} dark font-sans antialiased${process.env.NEXT_PUBLIC_DESKTOP_MODE === "true" ? " pt-8" : ""}`}>
        <PublicEnv />
        {process.env.NEXT_PUBLIC_DESKTOP_MODE === "true" && <TitleBar />}
        <Providers>
          {children}
          <Toaster position="bottom-right" />
        </Providers>
      </body>
    </html>
  );
}
