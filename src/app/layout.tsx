import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Iskcon 60 Gala volunteer Shift Signup",
  description:
    "Sign up for volunteer shifts for the ISKCON Toronto 60th Anniversary Gala — Saturday, November 14, 2026.",
  applicationName: "ISKCON 60 Gala Volunteers",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Gala Volunteers", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#090D16",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}>
      <body className="min-h-full bg-[#090D16] text-slate-200">
        {children}
        <Toaster
          theme="dark"
          position="top-center"
          richColors
          toastOptions={{
            className: "glass !rounded-xl !text-slate-100",
          }}
        />
      </body>
    </html>
  );
}
