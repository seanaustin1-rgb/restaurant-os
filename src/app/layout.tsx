import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Cormorant_Garamond, DM_Sans, Space_Mono } from "next/font/google";
import "./globals.css";

const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});

const body = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-body",
});

const mono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Restaurant OS",
  description: "Multi-tenant restaurant operator intelligence platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#C8873A",
          colorBackground: "#141614",
          colorText: "#E6E8E4",
        },
      }}
    >
      <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
        <body className="min-h-screen bg-ink text-[#E6E8E4] antialiased">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
