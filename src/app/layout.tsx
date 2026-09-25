import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import SWUnregister from "../components/SWUnregister";
import { Toaster } from "react-hot-toast";
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
  themeColor: "#047857", // emerald-700
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster position="bottom-center" toastOptions={{ duration: 4000 }} />
        <SWUnregister />
      </body>
    </html>
  );
}
