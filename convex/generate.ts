import { v } from "convex/values";
import { internalAction, mutation } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { GoogleGenAI } from "@google/genai";

/**
 * Helper function to convert ArrayBuffer to base64 (Convex-compatible)
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Helper function to convert base64 to Uint8Array (Convex-compatible)
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binaryString.length));
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Generate decorated image using Google's Gemini 2.5 Flash model
 * This is now an internal action that can be scheduled
 */
/**
 * Update image generation status
 */
export const updateImageStatus = mutation({
  args: {
    imageId: v.id("images"),
    status: v.string(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { imageId, status, error } = args;

    const updateData: any = { generationStatus: status };
    if (error) {
      updateData.generationError = error;
    }

    await ctx.db.patch(imageId, updateData);
  },
});

/**
 * Save generated image
 */
export const saveGeneratedImage = mutation({
  args: {
    storageId: v.id("_storage"),
    originalImageId: v.id("images"),
  },
  handler: async (ctx, args) => {
    const { storageId, originalImageId } = args;

    const generatedImageId = await ctx.db.insert("images", {
      body: storageId,
      createdAt: Date.now(),
      isGenerated: true,
      originalImageId: originalImageId,
    });
    return generatedImageId;
  },
});

/**
 * Schedule image generation (call this from your upload functions)
 */
export const scheduleImageGeneration = mutation({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const { storageId } = args;

    // First, save the original image with pending status
    const originalImageId = await ctx.db.insert("images", {
      body: storageId,
      createdAt: Date.now(),
      isGenerated: false,
      generationStatus: "pending",
    });

    // Schedule the image generation to run immediately
    await ctx.scheduler.runAfter(0, internal.generate.generateImage, {
      storageId,
      originalImageId,
    });

    return originalImageId;
  },
});

export const generateImage = internalAction({
  args: {
    storageId: v.id("_storage"),
    originalImageId: v.id("images"),
  },
  handler: async (ctx, args) => {
    const { storageId, originalImageId } = args;

    console.log(
      `[generateImage] Using Gemini 2.5 Flash Image Preview with storageId: ${storageId}, originalImageId: ${originalImageId}`
    );

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("GEMINI_API_KEY or GOOGLE_GENAI_API_KEY is not set");
      // Mark the original image as having failed generation
      await ctx.runMutation(api.generate.updateImageStatus, {
        imageId: originalImageId,
        status: "failed",
        error: "API key not configured",
      });
      return;
    }

    try {
      // Mark the original image as being processed
      await ctx.runMutation(api.generate.updateImageStatus, {
        imageId: originalImageId,
        status: "processing",
      });

      const ai = new GoogleGenAI({ apiKey });

      // Get the URL from storage ID
      const baseImageUrl = await ctx.storage.getUrl(storageId);
      if (!baseImageUrl) {
        throw new Error("Failed to get image URL from storage");
      }

      // Load the source image and encode as base64 for inlineData
      const response = await fetch(baseImageUrl);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch uploaded image from storage: ${response.statusText}`
        );
      }
      const mimeType = response.headers.get("content-type") || "image/png";
      const arrayBuffer = await response.arrayBuffer();
      const base64Image = arrayBufferToBase64(arrayBuffer);

      // Follow the official SDK example: text + inlineData parts
      const contents = [
        { text: "Edit my selfie into a flashy night paparazzi shot: diamond grill, iced-out watch by my face, 1 ring; harsh on-camera flash, slight motion blur, VHS grain, cool blue tint, shallow depth of field, high contrast. Use subtle, high-intensity micro-glints only on the jewelry (grill/watch/rings)—tiny, sparse, edge-focused highlights with no bloom or lens flares; zero sparkles on skin, hair, clothes, or background; The background is black and dark and blurry. 35mm film style with noticeable grain, dust, and scratches." },
        {
          inlineData: {
            mimeType,
            data: base64Image,
          },
        },
      ];

      const genResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-image-preview",
        contents,
      });

      const candidates = genResponse.candidates ?? [];
      if (candidates.length === 0) {
        throw new Error("Gemini returned no candidates");
      }

      // Find first inlineData part with image data
      let b64Out: string | null = null;
      const parts: Array<any> = candidates[0].content?.parts ?? [];
      for (const part of parts) {
        const inline = part.inlineData as { data?: string } | undefined;
        if (inline?.data) {
          b64Out = inline.data;
          break;
        }
      }
      if (!b64Out) {
        throw new Error("Gemini response did not include image data");
      }

      // Convert base64 to Uint8Array and store in Convex storage
      const imageBuffer = base64ToUint8Array(b64Out);
      const imageBlob = new Blob([imageBuffer as BlobPart], { type: "image/png" });
      const generatedStorageId = await ctx.storage.store(imageBlob);
      const url = await ctx.storage.getUrl(generatedStorageId);

      if (!url) {
        throw new Error("Failed to get storage URL after upload");
      }

      // Save the generated image record
      await ctx.runMutation(api.generate.saveGeneratedImage, {
        storageId: generatedStorageId,
        originalImageId: originalImageId,
      });

      // Mark the original image as completed
      await ctx.runMutation(api.generate.updateImageStatus, {
        imageId: originalImageId,
        status: "completed",
      });

      console.log(`[generateImage] Successfully generated image for originalImageId: ${originalImageId}`);

    } catch (error) {
      console.error(`[generateImage] Failed to generate image:`, error);

      // Mark the original image as failed with more detailed error info
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred during generation';

      try {
        await ctx.runMutation(api.generate.updateImageStatus, {
          imageId: originalImageId,
          status: "failed",
          error: errorMessage
        });
        console.log(`[generateImage] Marked image ${originalImageId} as failed: ${errorMessage}`);
      } catch (updateError) {
        console.error(`[generateImage] Failed to update image status:`, updateError);
        // Even if status update fails, log the original error
        console.error(`[generateImage] Original generation error: ${errorMessage}`);
      }
    }
  },
});
