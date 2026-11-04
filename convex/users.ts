import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  adminOrThrow,
  identityOrThrow,
  isAdmin,
  userOrThrow,
} from "./lib/access";

export const ensureCurrent = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await identityOrThrow(ctx);
    const existing = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (existing) return existing._id;
    return await ctx.db.insert("users", {
      tokenIdentifier: identity.tokenIdentifier,
      clerkUserId: identity.subject,
      trustedLender: false,
    });
  },
});

export const current = query({
  args: {},
  handler: async (ctx) => {
    const { identity, user } = await userOrThrow(ctx);
    return {
      id: user._id,
      trustedLender: user.trustedLender,
      role: isAdmin(identity.subject) ? ("admin" as const) : ("user" as const),
    };
  },
});

export const setTrusted = mutation({
  args: { userId: v.id("users"), trusted: v.boolean() },
  handler: async (ctx, { userId, trusted }) => {
    await adminOrThrow(ctx);
    const user = await ctx.db.get("users", userId);
    if (!user) throw new Error("User not found");
    await ctx.db.patch("users", userId, { trustedLender: trusted });
  },
});

// Contact details are supplied explicitly by the user and shared only with approved loan participants.
export const profile = query({
  args: {},
  returns: v.object({ displayName: v.string(), contact: v.string() }),
  handler: async (ctx) => {
    const { user } = await userOrThrow(ctx);
    return { displayName: user.displayName ?? "", contact: user.contact ?? "" };
  },
});

export const updateProfile = mutation({
  args: { displayName: v.string(), contact: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user } = await userOrThrow(ctx);
    const displayName = args.displayName.trim();
    const contact = args.contact.trim();
    if (!displayName || displayName.length > 80 || contact.length > 160)
      throw new Error("Invalid profile details");
    await ctx.db.patch("users", user._id, { displayName, contact });
    return null;
  },
});
