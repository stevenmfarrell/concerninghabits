import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import SWUnregister from "../components/SWUnregister";
import { Toaster } from "react-hot-toast";
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
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster 
          position="bottom-center" 
          containerStyle={{ bottom: 100 }} 
          toastOptions={{ 
            duration: 4000,
            success: {
              style: {
                background: '#1c1917', // stone-900
                color: '#fff',
                fontWeight: '500',
              },
              iconTheme: {
                primary: '#10b981', // emerald-500
                secondary: '#fff',
              }
            }
          }} 
        />
        <BottomNav />
        <SWUnregister />
      </body>
    </html>
  );
}
