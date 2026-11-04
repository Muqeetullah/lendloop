"use client";

import { useAuth } from "@clerk/nextjs";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";

const deploymentUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!deploymentUrl) throw new Error("Missing NEXT_PUBLIC_CONVEX_URL");
const convex = new ConvexReactClient(deploymentUrl);

export function ConvexProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}
