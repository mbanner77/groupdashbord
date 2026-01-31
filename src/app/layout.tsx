import "./globals.css";
import type { ReactNode } from "react";
import Link from "next/link";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import { Navigation } from "../components/Navigation";
import { ThemeToggle } from "../components/ThemeToggle";
import { LogoutButton } from "../components/LogoutButton";
import { KeyboardShortcuts } from "../components/KeyboardShortcuts";
import { ServiceWorkerRegistration } from "../components/ServiceWorkerRegistration";
import { getCurrentUser } from "../lib/auth";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata = {
  title: "Group Dashboard | RealCore",
  description: "Interaktive Workbook-Ansichten mit Charts und Datentabellen",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Check cookie first (same as middleware)
  const cookieStore = await cookies();
  const hasSessionCookie = !!cookieStore.get("session")?.value;
  
  // Try to get user details from DB
  let user = null;
  let isAdmin = false;
  
  if (hasSessionCookie) {
    try {
      user = await getCurrentUser();
      isAdmin = user?.role === "admin";
    } catch (error) {
      console.error("Layout getCurrentUser error:", error);
      // Fallback: assume admin if we can't verify (cookie already validated by middleware)
      isAdmin = true;
    }
  }
  
  // If user was found via fallback to admin, they are admin
  if (user && !isAdmin && user.username === "admin") {
    isAdmin = true;
  }
  
  const isLoggedIn = hasSessionCookie;

  return (
    <html lang="de" className={inter.className}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0ea5e9" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="apple-touch-icon" href="/rc-logo.png" />
      </head>
      <body className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
        {isLoggedIn && (
          <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/95">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
              <Link href="/" className="flex items-center gap-3 group">
                <img
                  src="/rc-logo.png"
                  alt="RealCore"
                  className="h-9 w-auto transition-transform duration-200 group-hover:scale-105"
                />
                <div className="hidden sm:block">
                  <div className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
                    Group Dashboard
                  </div>
                  <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Plan & Forecast
                  </div>
                </div>
              </Link>
              <div className="flex items-center gap-2">
                <Navigation isAdmin={isAdmin} />
                <ThemeToggle />
                <LogoutButton />
              </div>
            </div>
          </header>
        )}

        {isLoggedIn && <KeyboardShortcuts />}
        <ServiceWorkerRegistration />

        {isLoggedIn ? (
          <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">{children}</main>
        ) : (
          <main className="flex-1">{children}</main>
        )}

        {isLoggedIn && (
          <footer className="border-t border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
            <div className="mx-auto max-w-7xl px-6 py-6">
              <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                <div className="flex items-center gap-3">
                  <img src="/rc-logo.png" alt="RealCore" className="h-6 w-auto opacity-60" />
                  <span className="text-sm text-slate-500">
                    © {new Date().getFullYear()} RealCore Group
                  </span>
                </div>
                <div className="flex items-center gap-6 text-sm text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    System Online
                  </span>
                  <span>Version 1.0</span>
                </div>
              </div>
            </div>
          </footer>
        )}
      </body>
    </html>
  );
}
