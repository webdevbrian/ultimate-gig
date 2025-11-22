import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeToggle } from "@/components/ThemeToggle";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ultimate Gig",
  description:
    "Sync and manage Ultimate Guitar playlists with notes, playback tracking, and gig tools.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="min-h-screen bg-background text-foreground flex flex-col">
          <header className="border-b border-black/5 bg-white/70 px-4 py-3 text-sm font-medium backdrop-blur dark:border-white/10 dark:bg-black/70">
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
              <div className="flex items-baseline gap-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-base font-semibold tracking-tight">Ultimate Gig</span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    Playlist & tab manager for live sets
                  </span>
                </div>
                <ThemeToggle />
              </div>
              {/* <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Local & offline-friendly
              </span> */}
            </div>
          </header>
          <main className="flex-1 min-h-0 px-4 pt-6 pb-0 flex flex-col">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
