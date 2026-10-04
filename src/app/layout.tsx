import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import SWUnregister from "../components/SWUnregister";
import TimeZoneSync from "../components/TimeZoneSync";
import ThemeSync from "../components/ThemeSync";
import { THEME_SCRIPT } from "../lib/theme";
import { Toaster } from "react-hot-toast";
import ToastLimit from "../components/ToastLimit";
import ToastTouchResume from "../components/ToastTouchResume";
import { TOAST_OPTIONS } from "../components/toastOptions";
import BottomNav from "../components/BottomNav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
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
        <BottomNav />
        <SWUnregister />
        <TimeZoneSync />
        <ThemeSync />
      </body>
    </html>
  );
}
