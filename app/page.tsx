"use client";
import ConvexFloatingBubble from "@/components/ConvexFloatingBubble";
import ImagePreview from "@/components/ImagePreview";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Webcam from "@/components/Webcam";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Github } from "lucide-react";

// Type definition for image objects (matching Convex schema)
interface ImageObject {
  _id: string;
  body: string;
  createdAt: number;
  _creationTime: number;
  isGenerated?: boolean;
  originalImageId?: string;
  generationStatus?: string;
  generationError?: string;
  url: string | null;
}

export default function Home() {
  const generateUploadUrl = useMutation(api.images.generateUploadUrl);

  // Image generation scheduling mutation
  const scheduleImageGeneration = useMutation(api.generate.scheduleImageGeneration);

  const imageInput = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const images = useQuery(api.images.getImages) || [];
  const [isCapturing, setIsCapturing] = useState(false);

  // Pagination state for infinite scroll
  const [displayedImages, setDisplayedImages] = useState<ImageObject[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const IMAGES_PER_PAGE = 12; // 3 columns x 4 rows

  // Use refs to prevent infinite loops
  const prevImagesLengthRef = useRef<number>(0);
  const prevGeneratedLengthRef = useRef<number>(0);

  // Memoize generated images to prevent infinite re-renders
  const generatedImages = useMemo(() => {
    return images.filter(img => img.isGenerated);
  }, [images]);

  // Check if there are any actively processing images
  const hasActiveGenerations = useMemo(() => {
    return images.some(img =>
      img.generationStatus === 'pending' ||
      img.generationStatus === 'processing'
    );
  }, [images]);


  // Initialize displayed images when images load (only when content actually changes)
  useEffect(() => {
    const currentGeneratedLength = generatedImages.length;
    const currentImagesLength = images.length;

    // Only update if the actual content has changed, not just references
    if (currentGeneratedLength !== prevGeneratedLengthRef.current ||
      currentImagesLength !== prevImagesLengthRef.current) {
      setDisplayedImages(generatedImages.slice(0, IMAGES_PER_PAGE));
      setCurrentPage(0);

      // Update refs to track previous state
      prevGeneratedLengthRef.current = currentGeneratedLength;
      prevImagesLengthRef.current = currentImagesLength;
    }
  }, [generatedImages, images]);

  // Handle loading more images for infinite scroll
  const handleLoadMore = useCallback(() => {
    if (isLoadingMore) return;

    const totalImages = generatedImages.length;
    const nextPage = currentPage + 1;
    const startIndex = nextPage * IMAGES_PER_PAGE;
    const endIndex = Math.min(startIndex + IMAGES_PER_PAGE, totalImages);

    if (startIndex < totalImages) {
      setIsLoadingMore(true);

      // Simulate loading delay (you can remove this in production)
      setTimeout(() => {
        setDisplayedImages(prev => [
          ...prev,
          ...generatedImages.slice(startIndex, endIndex)
        ]);
        setCurrentPage(nextPage);
        setIsLoadingMore(false);
      }, 500);
    }
  }, [generatedImages, currentPage, isLoadingMore]);

  // Helper function to check if error is a quota/rate limit error
  const isQuotaError = (error: unknown): boolean => {
    const errorMessage = error instanceof Error ? error.message : String(error || '');
    return errorMessage.includes('quota') ||
      errorMessage.includes('RESOURCE_EXHAUSTED') ||
      errorMessage.includes('rate limit') ||
      errorMessage.includes('429');
  };

  const handleImageCapture = async (imageData: string) => {
    setIsCapturing(true);

    try {
      // Convert base64 to blob
      const response = await fetch(imageData);
      const blob = await response.blob();

      // Create a File object from the blob
      const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });

      // Step 1: Get an upload URL from Convex
      const uploadUrl = await generateUploadUrl();

      // Step 2: Upload the file to the generated URL
      const uploadResult = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadResult.ok) {
        throw new Error(`Upload failed: ${uploadResult.statusText}`);
      }

      const { storageId } = await uploadResult.json();

      // Step 3: Schedule image generation (this is now resilient to page refreshes)
      setIsGenerating(true);
      try {
        await scheduleImageGeneration({ storageId });
        console.log("Image generation scheduled successfully!");

        // Show success toast
        toast.success("Image Generation Started!", {
          description: "You can refresh the page, generation will continue in the background.",
          duration: 4000,
        });
      } catch (genError) {
        console.error("Failed to schedule image generation:", genError);

        // Show appropriate toast based on error type
        if (isQuotaError(genError)) {
          toast.error("Gemini API Quota Exceeded", {
            description: "You've reached your daily/monthly limit. Try again later or upgrade your plan.",
            duration: 8000,
            action: {
              label: "Learn More",
              onClick: () => window.open("https://ai.google.dev/gemini-api/docs/rate-limits", "_blank"),
            },
          });
        } else {
          toast.error("Failed to Start Generation", {
            description: "Failed to schedule image generation. Please try again.",
            duration: 5000,
          });
        }
      } finally {
        setIsGenerating(false);
      }

      console.log("Image captured and uploaded successfully!");

    } catch (error) {
      console.error("Failed to upload captured image:", error);
      // You could add error handling UI here
    } finally {
      setIsCapturing(false);
    }
  };

  const handleSendImage = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedImage) return;

    setIsUploading(true);

    try {
      // Step 1: Get an upload URL from Convex
      const uploadUrl = await generateUploadUrl();

      // Step 2: Upload the file to the generated URL
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": selectedImage.type },
        body: selectedImage,
      });

      if (!result.ok) {
        throw new Error(`Upload failed: ${result.statusText}`);
      }

      const { storageId } = await result.json();

      // Step 3: Schedule image generation (this is now resilient to page refreshes)
      setIsGenerating(true);
      try {
        await scheduleImageGeneration({ storageId });
        console.log("Image generation scheduled successfully!");

        // Show success toast
        toast.success("Image Generation Started!", {
          description: "Your image is being enhanced with AI. You can refresh the page - generation will continue in the background.",
          duration: 4000,
        });
      } catch (genError) {
        console.error("Failed to schedule image generation:", genError);

        // Show appropriate toast based on error type
        if (isQuotaError(genError)) {
          toast.error("Gemini API Quota Exceeded", {
            description: "You've reached your daily/monthly limit. Try again later or upgrade your plan.",
            duration: 8000,
            action: {
              label: "Learn More",
              onClick: () => window.open("https://ai.google.dev/gemini-api/docs/rate-limits", "_blank"),
            },
          });
        } else {
          toast.error("Failed to Start Generation", {
            description: "Failed to schedule image generation. Please try again.",
            duration: 5000,
          });
        }
      } finally {
        setIsGenerating(false);
      }

      // Reset the form
      setSelectedImage(null);
      imageInput.current!.value = "";

    } catch (error) {
      console.error("Upload failed:", error);
      // You could add error handling UI here
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="flex flex-col w-full min-h-screen p-4 lg:p-6">
      <div className="flex flex-col items-start justify-start gap-2 w-full">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold">Convex Drip Me Out</h1>
          <a
            href="https://github.com/michaelshimeles/drip-me-out"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="View source code on GitHub"
          >
            <Github className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8" />
          </a>
        </div>
        <p className="text-sm text-muted-foreground">
          Upload an image or capture a photo to see what you look like with a diamond chain.
        </p>
      </div>
      {/** Image upload or open camera */}
      <div className="w-full mt-6 sm:mt-8 lg:mt-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          {/* Camera/Upload Section */}
          <div className="lg:max-w-2xl w-full">
            <Tabs defaultValue="camera">
              <TabsList>
                <TabsTrigger value="camera" className="text-sm font-medium">📸 Camera</TabsTrigger>
                {/* <TabsTrigger value="upload" className="text-sm font-medium">📤 Upload</TabsTrigger> */}
              </TabsList>
              <TabsContent value="upload" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Upload Image</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col justify-center">
                    <div className="space-y-4">
                      <Input
                        type="file"
                        accept="image/*"
                        ref={imageInput}
                        onChange={(event) => setSelectedImage(event.target.files![0])}
                        disabled={selectedImage !== null}
                        className="w-full"
                      />
                      <Button
                        type="submit"
                        onClick={handleSendImage}
                        size="sm"
                        variant="outline"
                        className="w-full h-11"
                        disabled={isUploading || isGenerating || !selectedImage}
                      >
                        {isUploading ? "Uploading..." : isGenerating ? "Generating..." : "Upload & Generate"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="camera" className="mt-4">
                <div className="w-full">
                  <Webcam onCapture={handleImageCapture} isUploading={isCapturing || isGenerating} />
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Image Preview Section */}
          <div className="w-full">
            <ImagePreview
              images={[]}
              uploadedImages={displayedImages.map(image => ({
                _id: image._id,
                body: image.body,
                createdAt: image.createdAt,
                url: image.url ?? "",
                generationStatus: image.generationStatus
              }))}
              onLoadMore={handleLoadMore}
              hasMore={displayedImages.length < generatedImages.length}
              isLoading={isLoadingMore}
            />
          </div>
        </div>

        {/* Mobile-optimized generating indicator */}
        {hasActiveGenerations && (
          <div className="fixed bottom-4 right-4 lg:top-6 lg:right-6 z-50">
            <div className="flex items-center gap-2 bg-card/95 backdrop-blur-sm border border-border rounded-lg px-3 py-2 shadow-lg">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-accent"></div>
              <span className="text-sm text-muted-foreground font-medium">Generating...</span>
            </div>
          </div>
        )}
      </div>

      {/* Floating Convex Showcase Bubble */}
      <ConvexFloatingBubble />
    </div>
  );
}
