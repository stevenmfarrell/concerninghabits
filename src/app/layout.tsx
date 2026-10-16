import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Emoji } from "next/font/google";
import ServiceWorkerSetup from "../components/ServiceWorkerSetup";
import OfflineSync from "../components/OfflineSync";
import SyncStatus from "../components/SyncStatus";
import { verifySession } from "../lib/auth";
import { prisma } from "../lib/prisma";
import TimeZoneSync from "../components/TimeZoneSync";
import ResumeReload from "../components/ResumeReload";
import ThemeSync from "../components/ThemeSync";
import { THEME_SCRIPT } from "../lib/theme";
import { Toaster } from "react-hot-toast";
import ToastLimit from "../components/ToastLimit";
import ToastTouchResume from "../components/ToastTouchResume";
import { TOAST_OPTIONS } from "../components/toastOptions";
import BottomNav from "../components/BottomNav";
import SmartEntry from "./SmartEntry";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Black-and-white emoji, so they sit in with the line icons (see src/lib/emoji.ts)
const notoEmoji = Noto_Emoji({
  variable: "--font-noto-emoji",
  subsets: ["emoji"],
});


export const metadata: Metadata = {
  title: "Concerning Habits",
  description: "AI-powered family habit tracker",
  appleWebApp: {
    capable: true,
    title: "Habits",
    statusBarStyle: "default",
  },
};

export const viewport = {
  themeColor: "#047857", // emerald-700
};

// Who's signed in, as the outbox needs to know (see OfflineSync), or null on the sign-in pages
async function outboxUser() {
  const session = await verifySession();
  if (!session) return null;
  return prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, bedtime: true } });
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await outboxUser();
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${notoEmoji.variable} h-full antialiased`}
      // THEME_SCRIPT sets data-theme before React hydrates
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-canvas">
        {children}
        <Toaster position="bottom-center" containerStyle={{ bottom: 100 }} toastOptions={TOAST_OPTIONS} />
        <ToastLimit />
        <ToastTouchResume />
        <BottomNav status={user && <SyncStatus />} center={user && <SmartEntry />} />
        <ServiceWorkerSetup signedIn={!!user} />
        <OfflineSync user={user} />
        <TimeZoneSync />
        <ResumeReload />
        <ThemeSync />
      </body>
    </html>
  );
}
