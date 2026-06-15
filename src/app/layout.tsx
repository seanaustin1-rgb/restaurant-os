import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { Cormorant_Garamond, DM_Sans, Space_Mono } from "next/font/google";
import { AppHeader } from "@/components/AppHeader";
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
  title: "OutFront Data",
  description: "Financial insights for operators — know your numbers, decide now.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      appearance={{
        // Start from Clerk's dark base theme so popover/menu secondary text,
        // borders and inputs are legible on the dark UI (the prior config only
        // set colorText, leaving menu items like "Manage account" / "Sign out"
        // dark-on-dark), then layer the brand palette on top.
        baseTheme: dark,
        variables: {
          colorPrimary: "#C8873A",
          colorBackground: "#141614",
          colorText: "#E6E8E4",
        },
      }}
    >
      <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
        <body className="min-h-screen bg-ink text-[#E6E8E4] antialiased">
          <AppHeader />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
