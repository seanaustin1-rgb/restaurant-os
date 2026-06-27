import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { dark } from "@clerk/themes";
import type { UserRole } from "@prisma/client";
import { Cormorant_Garamond, DM_Sans, Space_Mono } from "next/font/google";
import { AppHeader } from "@/components/AppHeader";
import { prisma } from "@/lib/prisma";
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

async function loadSignedInRoles(): Promise<UserRole[]> {
  const { userId } = await auth();
  if (!userId) return [];

  const rows = await prisma.userRestaurantRole.findMany({
    where: { clerkUserId: userId },
    select: { role: true },
    distinct: ["role"],
  });
  return rows.map((row) => row.role);
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const roles = await loadSignedInRoles();

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
        <body className="min-h-screen bg-ink text-ink-text antialiased">
          <AppHeader roles={roles} />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
