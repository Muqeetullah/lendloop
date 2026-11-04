import type { MutationCtx, QueryCtx } from "../_generated/server";

type Context = QueryCtx | MutationCtx;

export async function identityOrThrow(ctx: Context) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Authentication required");
  return identity;
}

export async function userOrThrow(ctx: Context) {
  const identity = await identityOrThrow(ctx);
  const user = await ctx.db
    .query("users")
    .withIndex("by_token", (q) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .unique();
  if (!user) throw new Error("User profile not initialized");
  return { identity, user };
}

export function isAdmin(subject: string) {
  const admin = process.env.ADMIN_CLERK_USER_ID;
  return Boolean(admin && subject === admin);
}

export async function adminOrThrow(ctx: Context) {
  const { identity, user } = await userOrThrow(ctx);
  if (!isAdmin(identity.subject)) throw new Error("Not authorized");
  return user;
}
