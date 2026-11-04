import { v } from "convex/values";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { mutation, query } from "./_generated/server";
import { isAdmin, userOrThrow } from "./lib/access";
import { cleanText, todayUtc } from "./lib/validation";

const fields = {
  name: v.string(),
  category: v.string(),
  condition: v.string(),
  description: v.string(),
};
function validateFields(input: {
  name: string;
  category: string;
  condition: string;
  description: string;
}) {
  return {
    name: cleanText(input.name, "name", 80),
    category: cleanText(input.category, "category", 40),
    condition: cleanText(input.condition, "condition", 40),
    description: cleanText(input.description, "description", 500),
  };
}

export const create = mutation({
  args: fields,
  handler: async (ctx, args) => {
    const { user } = await userOrThrow(ctx);
    return await ctx.db.insert("tools", {
      ...validateFields(args),
      ownerId: user._id,
      archived: false,
    });
  },
});

export const edit = mutation({
  args: { toolId: v.id("tools"), ...fields },
  handler: async (ctx, { toolId, ...fields }) => {
    const { user } = await userOrThrow(ctx);
    const tool = await ctx.db.get("tools", toolId);
    if (!tool || tool.ownerId !== user._id || tool.archived)
      throw new Error("Not authorized or listing unavailable");
    await ctx.db.patch("tools", toolId, validateFields(fields));
  },
});

export const archive = mutation({
  args: { toolId: v.id("tools") },
  handler: async (ctx, { toolId }) => {
    const { identity, user } = await userOrThrow(ctx);
    const tool = await ctx.db.get("tools", toolId);
    if (!tool || (tool.ownerId !== user._id && !isAdmin(identity.subject)))
      throw new Error("Not authorized or listing unavailable");
    if (!tool.archived) await ctx.db.patch("tools", toolId, { archived: true });
  },
});

// Each page reads a bounded number of listings and at most one matching loan per listing.
export const publicAvailable = query({
  args: {
    paginationOpts: paginationOptsValidator,
    refreshKey: v.optional(v.string()),
  },
  returns: paginationResultValidator(
    v.object({ name: v.string(), category: v.string() }),
  ),
  handler: async (ctx, { paginationOpts, refreshKey }) => {
    if (
      paginationOpts.numItems < 1 ||
      paginationOpts.numItems > 50 ||
      (refreshKey && refreshKey.length > 10)
    )
      throw new Error("Invalid page request");
    const today = todayUtc();
    const page = await ctx.db
      .query("tools")
      .withIndex("by_archived", (q) => q.eq("archived", false))
      .paginate(paginationOpts);
    const available = await Promise.all(
      page.page.map(async (tool) => {
        const current = await ctx.db
          .query("requests")
          .withIndex("by_tool_status_start", (q) =>
            q
              .eq("toolId", tool._id)
              .eq("status", "approved")
              .lte("startDate", today),
          )
          .first();
        return current ? null : { name: tool.name, category: tool.category };
      }),
    );
    return {
      ...page,
      page: available.filter(
        (tool): tool is NonNullable<typeof tool> => tool !== null,
      ),
    };
  },
});

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const { user } = await userOrThrow(ctx);
    return await ctx.db
      .query("tools")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();
  },
});

// A bounded view for the first lending journey. The public query remains separate.
export const board = query({
  args: { refreshKey: v.optional(v.string()) },
  returns: v.array(
    v.object({
      id: v.id("tools"),
      name: v.string(),
      category: v.string(),
      condition: v.string(),
      description: v.string(),
      own: v.boolean(),
      available: v.boolean(),
    }),
  ),
  handler: async (ctx, { refreshKey }) => {
    if (refreshKey && refreshKey.length > 10)
      throw new Error("Invalid refresh key");
    const { user } = await userOrThrow(ctx);
    const tools = await ctx.db
      .query("tools")
      .withIndex("by_archived", (q) => q.eq("archived", false))
      .order("desc")
      .take(100);
    const today = todayUtc();
    return await Promise.all(
      tools.map(async (tool) => {
        const current = await ctx.db
          .query("requests")
          .withIndex("by_tool_status_start", (q) =>
            q
              .eq("toolId", tool._id)
              .eq("status", "approved")
              .lte("startDate", today),
          )
          .first();
        return {
          id: tool._id,
          name: tool.name,
          category: tool.category,
          condition: tool.condition,
          description: tool.description,
          own: tool.ownerId === user._id,
          available: !current,
        };
      }),
    );
  },
});

const listingView = v.object({
  id: v.id("tools"),
  name: v.string(),
  category: v.string(),
  condition: v.string(),
  description: v.string(),
  own: v.boolean(),
  available: v.boolean(),
});

// The selected category is indexed so a page is filtered before it is read.
export const boardPage = query({
  args: {
    paginationOpts: paginationOptsValidator,
    category: v.optional(v.string()),
    refreshKey: v.optional(v.string()),
  },
  returns: paginationResultValidator(listingView),
  handler: async (ctx, { paginationOpts, category, refreshKey }) => {
    const { user } = await userOrThrow(ctx);
    if (
      paginationOpts.numItems < 1 ||
      paginationOpts.numItems > 50 ||
      (category !== undefined && (!category.trim() || category.length > 40)) ||
      (refreshKey && refreshKey.length > 10)
    )
      throw new Error("Invalid page request");
    const page =
      category === undefined
        ? await ctx.db
            .query("tools")
            .withIndex("by_archived", (q) => q.eq("archived", false))
            .order("desc")
            .paginate(paginationOpts)
        : await ctx.db
            .query("tools")
            .withIndex("by_archived_category", (q) =>
              q.eq("archived", false).eq("category", category),
            )
            .order("desc")
            .paginate(paginationOpts);
    const today = todayUtc();
    return {
      ...page,
      page: await Promise.all(
        page.page.map(async (tool) => {
          const current = await ctx.db
            .query("requests")
            .withIndex("by_tool_status_start", (q) =>
              q
                .eq("toolId", tool._id)
                .eq("status", "approved")
                .lte("startDate", today),
            )
            .first();
          return {
            id: tool._id,
            name: tool.name,
            category: tool.category,
            condition: tool.condition,
            description: tool.description,
            own: tool.ownerId === user._id,
            available: !current,
          };
        }),
      ),
    };
  },
});

export const myListingsPage = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(
    v.object({
      id: v.id("tools"),
      name: v.string(),
      category: v.string(),
      condition: v.string(),
      description: v.string(),
    }),
  ),
  handler: async (ctx, { paginationOpts }) => {
    const { user } = await userOrThrow(ctx);
    if (paginationOpts.numItems < 1 || paginationOpts.numItems > 50)
      throw new Error("Invalid page request");
    const page = await ctx.db
      .query("tools")
      .withIndex("by_owner_archived", (q) =>
        q.eq("ownerId", user._id).eq("archived", false),
      )
      .order("desc")
      .paginate(paginationOpts);
    return {
      ...page,
      page: page.page.map((tool) => ({
        id: tool._id,
        name: tool.name,
        category: tool.category,
        condition: tool.condition,
        description: tool.description,
      })),
    };
  },
});
