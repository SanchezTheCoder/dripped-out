import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

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
      isPublic: false,
    });
  },
});

export const getImages = query({
  handler: async (ctx) => {
    const images = await ctx.db
      .query("images")
      .order("desc")
      .collect();

    // Generate URLs for each image and filter out any that no longer
    // have a valid storage URL (e.g., underlying file deleted).
    const imagesWithUrls = await Promise.all(
      images.map(async (image) => ({
        ...image,
        url: await ctx.storage.getUrl(image.body),
      }))
    );

    return imagesWithUrls.filter((img) => {
      if (!img.url) return false;
      // Treat legacy records with undefined isPublic as public until backfilled.
      return img.isPublic ?? true;
    });
  },
});

export const getImageDetails = query({
  args: {
    imageId: v.optional(v.id("images")),
  },
  handler: async (ctx, { imageId }) => {
    if (!imageId) return null;

    const original = await ctx.db.get(imageId);
    if (!original) {
      return null;
    }

    const generatedId = original.generatedImageId as Id<"images"> | undefined;
    const generated = generatedId ? await ctx.db.get(generatedId) : null;

    const [originalUrl, generatedUrl] = await Promise.all([
      ctx.storage.getUrl(original.body as Id<"_storage">),
      generated ? ctx.storage.getUrl(generated.body as Id<"_storage">) : Promise.resolve(null),
    ]);

    return {
      original: {
        _id: original._id,
        generationStatus: original.generationStatus ?? null,
        generationError: original.generationError ?? null,
        url: originalUrl,
        generatedImageId: generatedId ?? null,
      },
      generated: generated && generatedUrl
        ? {
            _id: generated._id,
            url: generatedUrl,
            createdAt: generated.createdAt,
            isPublic: generated.isPublic ?? false,
          }
        : null,
    };
  },
});

export const shareImage = mutation({
  args: {
    imageId: v.id("images"),
  },
  handler: async (ctx, { imageId }) => {
    const image = await ctx.db.get(imageId);
    if (!image) {
      throw new Error("Image not found");
    }

    await ctx.db.patch(imageId, {
      isPublic: true,
      sharedAt: Date.now(),
    });
  },
});

const assertAdminToken = (token: string | undefined) => {
  const expected = process.env.ADMIN_DELETE_TOKEN;
  if (!expected) {
    throw new Error("ADMIN_DELETE_TOKEN not configured");
  }
  if (token !== expected) {
    throw new Error("Invalid admin token");
  }
};

export const adminDeleteImage = mutation({
  args: {
    imageId: v.id("images"),
    token: v.string(),
  },
  handler: async (ctx, { imageId, token }) => {
    const expected = process.env.ADMIN_DELETE_TOKEN;
    if (!expected) {
      return { ok: false as const, reason: "NOT_CONFIGURED" as const };
    }
    if (token !== expected) {
      // Do not throw; return a failure so clients can handle gracefully.
      return { ok: false as const, reason: "INVALID_ADMIN" as const };
    }

    const image = await ctx.db.get(imageId);
    if (!image) {
      return { ok: false as const, reason: "NOT_FOUND" as const };
    }

    await ctx.db.delete(imageId);

    try {
      await ctx.storage.delete(image.body as Id<"_storage">);
    } catch (error) {
      console.warn("Failed to delete storage object", { imageId, error });
    }

    return { ok: true as const };
  },
});

export const backfillIsPublic = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, { token }) => {
    assertAdminToken(token);

    const images = await ctx.db.query("images").collect();
    await Promise.all(
      images
        .filter((image) => image.isPublic === undefined)
        .map((image) =>
          ctx.db.patch(image._id, {
            isPublic: true,
            sharedAt: image.sharedAt ?? Date.now(),
          })
        )
    );
  },
});
