import type { Metadata, Viewport } from "next";
import { Crimson_Text, Inter } from "next/font/google";
import { Providers } from "@/components/Providers";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const crimsonText = Crimson_Text({
  variable: "--font-crimson-text",
  subsets: ["latin"],
  weight: ["400", "600"],
});

export const metadata: Metadata = {
  title: "GG Cash Book",
  description: "Private cash books, expenses, investments, and recurring reminders.",
  applicationName: "GG Cash Book",
  appleWebApp: { capable: true, title: "GG Cash Book", statusBarStyle: "default" },
  icons: { icon: "/icon.svg", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#4a5d8f",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${crimsonText.variable} h-full antialiased`}
    >
      <head>
        {/* Apply the saved appearance before paint; only the root attribute changes. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("gg-cash-book-theme");document.documentElement.dataset.theme=t==="dark"||t==="light"?t:matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}catch(e){console.warn("Theme preference could not be read.",e);document.documentElement.dataset.theme=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}`,
          }}
        />
      </head>
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
