import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const sendImage = mutation({
  args: {
    storageId: v.id("_storage"),
    isGenerated: v.optional(v.boolean()),
    originalImageId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("images", {
      body: args.storageId,
      createdAt: Date.now(),
      isGenerated: args.isGenerated,
      originalImageId: args.originalImageId,
    });
  },
});

export const getImages = query({
  handler: async (ctx) => {
    const images = await ctx.db.query("images").order("desc").collect();

    // Generate URLs for each image
    const imagesWithUrls = await Promise.all(
      images.map(async (image) => ({
        ...image,
        url: await ctx.storage.getUrl(image.body),
      }))
    );

    return imagesWithUrls;
  },
});