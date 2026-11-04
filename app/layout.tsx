import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import "./globals.css";
import { ConvexProvider } from "./convex-provider";

export const metadata: Metadata = {
  title: "LendLoop",
  description: "A neighborhood tool lending board.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <ClerkProvider>
          <ConvexProvider>{children}</ConvexProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
