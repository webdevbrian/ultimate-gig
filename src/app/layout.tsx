import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
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
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const stored = localStorage.getItem('ultimate-gig:ui:theme-mode');
                  const mode = (stored === 'light' || stored === 'dark' || stored === 'system') ? stored : 'system';
                  const root = document.documentElement;

                  if (mode === 'dark') {
                    root.classList.add('dark');
                  } else if (mode === 'system') {
                    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                      root.classList.add('dark');
                    }
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <div className="min-h-screen bg-background text-foreground flex flex-col">
          <header className="border-b border-black/5 bg-white/70 px-4 py-3 text-sm font-medium backdrop-blur dark:border-white/10 dark:bg-black/70">
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Link href="/" className="flex items-center gap-2">
                  <Image
                    src="/icon.png"
                    alt="Ultimate Gig"
                    width={24}
                    height={24}
                    className="rounded"
                  />
                </Link>
                <div className="flex items-center gap-2">
                  <Link
                    href="/settings"
                    className="inline-flex items-center justify-center rounded border border-zinc-300 bg-white px-2 py-0.5 text-[11px] font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    Settings
                  </Link>
                  <ThemeToggle />
                </div>
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
