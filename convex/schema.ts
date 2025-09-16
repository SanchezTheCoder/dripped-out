import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    images: defineTable({
        body: v.string(),
        createdAt: v.number(),
        isGenerated: v.optional(v.boolean()),
        originalImageId: v.optional(v.string()),
        generatedImageId: v.optional(v.string()),
        generationStatus: v.optional(v.string()), // "pending", "processing", "completed", "failed"
        generationError: v.optional(v.string()),
        isPublic: v.optional(v.boolean()),
        sharedAt: v.optional(v.number()),
    })
    .index("by_created_at", ["createdAt"])
    .index("by_is_generated", ["isGenerated"])
    .index("by_generation_status", ["generationStatus"])
});
