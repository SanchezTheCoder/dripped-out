"use client";
import ConvexFloatingBubble from "@/components/ConvexFloatingBubble";
import ImagePreview from "@/components/ImagePreview";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Webcam from "@/components/Webcam";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { GithubIcon, Loader2, ShieldCheck, Share2, Trash2 } from "lucide-react";
import Link from "next/link";

// Type definition for image objects (matching Convex schema)
interface ImageObject {
  _id: string;
  body: string;
  createdAt: number;
  _creationTime: number;
  isGenerated?: boolean;
  originalImageId?: string;
  generatedImageId?: string;
  generationStatus?: string;
  generationError?: string;
  url: string | null;
  isPublic?: boolean;
  sharedAt?: number;
}

export default function Home() {
  const generateUploadUrl = useMutation(api.images.generateUploadUrl);

  // Image generation scheduling mutation
  const scheduleImageGeneration = useMutation(api.generate.scheduleImageGeneration);
  const shareImageMutation = useMutation(api.images.shareImage);
  const adminDeleteImageMutation = useMutation(api.images.adminDeleteImage);

  const imageInput = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const images = useQuery(api.images.getImages) || [];
  const [isCapturing, setIsCapturing] = useState(false);
  const [latestOriginalId, setLatestOriginalId] = useState<Id<"images"> | null>(null);
  const latestDetails = useQuery(
    api.images.getImageDetails,
    latestOriginalId ? { imageId: latestOriginalId } : "skip"
  );
  const [hasSharedCurrent, setHasSharedCurrent] = useState(false);
  const [isSharingToFeed, setIsSharingToFeed] = useState(false);
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [adminInput, setAdminInput] = useState("");
  const [showAdminControls, setShowAdminControls] = useState(false);
  // Webcam reset / auto-start when trying again
  const [webcamReset, setWebcamReset] = useState(0);
  const [webcamAutoStart, setWebcamAutoStart] = useState(false);

  const downloadImage = useCallback(async (url: string, suggestedName: string) => {
    if (!url) return;

    try {
      const response = await fetch(url, { credentials: "omit" });
      if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = suggestedName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(downloadUrl);
    } catch (_err) {
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("dripped-out-admin-token");
    if (stored) {
      setAdminToken(stored);
      setAdminInput(stored);
    }
  }, []);

  useEffect(() => {
    if (!latestDetails) {
      setHasSharedCurrent(false);
      return;
    }

    setHasSharedCurrent(latestDetails.generated?.isPublic ?? false);
  }, [latestDetails]);

  const isAdmin = Boolean(adminToken);
  const latestStatus = latestDetails?.original?.generationStatus ?? null;
  const latestError = latestDetails?.original?.generationError ?? null;
  const latestGeneratedImage = latestDetails?.generated ?? null;
  const isGenerationComplete = Boolean(latestGeneratedImage && latestStatus === 'completed');
  const shareDisabled = !latestGeneratedImage || hasSharedCurrent || isSharingToFeed;

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
    // Only include generated images that have a valid URL
    return images.filter(img => img.isGenerated && Boolean(img.url));
  }, [images]);

  // Check if there are any actively processing images
  const hasActiveGenerations = useMemo(() => {
    if (isGenerating) return true;
    const status = latestDetails?.original?.generationStatus;
    return status === 'pending' || status === 'processing';
  }, [isGenerating, latestDetails?.original?.generationStatus]);

  const handleShareToFeed = useCallback(async () => {
    if (!latestGeneratedImage?._id) return;
    setIsSharingToFeed(true);
    try {
      await shareImageMutation({ imageId: latestGeneratedImage._id as Id<"images"> });
      setHasSharedCurrent(true);
      toast.success("Shared to feed", {
        description: "Your photo now appears in the gallery.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error("Failed to share", { description: message });
    } finally {
      setIsSharingToFeed(false);
    }
  }, [latestGeneratedImage?._id, shareImageMutation]);

  const handleTryAgain = useCallback(() => {
    setLatestOriginalId(null);
    setHasSharedCurrent(false);
    setIsSharingToFeed(false);
    // Nudge the webcam to clear the still and show live view
    setWebcamAutoStart(true);
    setWebcamReset((n) => n + 1);
  }, []);

  const handleAdminTokenSave = useCallback(() => {
    if (typeof window === "undefined") return;
    const trimmed = adminInput.trim();
    if (!trimmed) {
      window.localStorage.removeItem("dripped-out-admin-token");
      setAdminToken(null);
      toast.success("Admin token cleared");
      return;
    }

    window.localStorage.setItem("dripped-out-admin-token", trimmed);
    setAdminToken(trimmed);
    toast.success("Admin token saved");
  }, [adminInput]);

  const handleAdminDelete = useCallback(async (imageId: string) => {
    if (!adminToken) {
      toast.error("Enter admin token first", {
        description: "Open admin tools to provide the token.",
      });
      setShowAdminControls(true);
      return;
    }

    try {
      const result = await adminDeleteImageMutation({ imageId: imageId as Id<"images">, token: adminToken });
      if (result?.ok) {
        toast.success("Image removed");
      } else if (result?.reason === "INVALID_ADMIN") {
        toast.error("Invalid admin token", {
          description: "Check the token in Admin tools and try again.",
        });
      } else if (result?.reason === "NOT_CONFIGURED") {
        toast.error("Admin not configured", {
          description: "Set ADMIN_DELETE_TOKEN in Convex dev env.",
        });
      } else if (result?.reason === "NOT_FOUND") {
        toast("Already gone", { description: "Image no longer exists." });
      } else {
        toast.error("Delete failed", { description: "Unknown error." });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error("Delete failed", { description: message });
    }
  }, [adminToken, adminDeleteImageMutation]);


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

  // Reset pagination when new images are added
  useEffect(() => {
    if (generatedImages.length > 0 && displayedImages.length === 0) {
      setDisplayedImages(generatedImages.slice(0, IMAGES_PER_PAGE));
      setCurrentPage(0);
    }
  }, [generatedImages.length, displayedImages.length]);

  // Handle loading more images for infinite scroll
  const handleLoadMore = useCallback(() => {
    if (isLoadingMore) return;

    const totalImages = generatedImages.length;
    const nextPage = currentPage + 1;
    const startIndex = nextPage * IMAGES_PER_PAGE;
    const endIndex = Math.min(startIndex + IMAGES_PER_PAGE, totalImages);

    if (startIndex < totalImages) {
      setIsLoadingMore(true);

      // Load images immediately without artificial delay for fluid experience
      setDisplayedImages(prev => [
        ...prev,
        ...generatedImages.slice(startIndex, endIndex)
      ]);
      setCurrentPage(nextPage);
      setIsLoadingMore(false);
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
        const newOriginalId = await scheduleImageGeneration({ storageId });
        setLatestOriginalId(newOriginalId as Id<"images">);
        setHasSharedCurrent(false);
        setIsSharingToFeed(false);
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
        const newOriginalId = await scheduleImageGeneration({ storageId });
        setLatestOriginalId(newOriginalId as Id<"images">);
        setHasSharedCurrent(false);
        setIsSharingToFeed(false);
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
      <div className="flex flex-col items-center sm:items-start justify-start gap-2 w-full">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold">Dripped Out!</h1>
          <Link
            href="https://github.com/SanchezTheCoder/dripped-out"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="View source code on GitHub"
          >
            <Button variant="ghost" size="icon">
              <GithubIcon />
            </Button>
          </Link>
          <Button
            variant={isAdmin ? "glow" : "ghost"}
            size="icon"
            aria-label="Toggle admin tools"
            onClick={() => setShowAdminControls((prev) => !prev)}
          >
            <ShieldCheck className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground text-center sm:text-left">
         Capture a photo to see what you look like dripped out with diamonds.
        </p>
        {showAdminControls && (
          <div className="w-full max-w-md rounded-lg border border-border/60 bg-card/70 p-3 text-sm">
            <div className="flex items-center gap-2">
              <Input
                type="password"
                placeholder="Admin token"
                value={adminInput}
                onChange={(event) => setAdminInput(event.target.value)}
              />
              <Button variant="outline" size="sm" onClick={handleAdminTokenSave}>
                Save
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Token is stored locally. Clear the field and save to remove access.
            </p>
          </div>
        )}
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
                  <Webcam
                    onCapture={handleImageCapture}
                    isUploading={isCapturing || isGenerating}
                    autoStart={webcamAutoStart}
                    reset={webcamReset}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Image Preview Section */}
          <div className="w-full space-y-4">
            {latestOriginalId && (
              <Card className="border border-white/10 bg-card/70 backdrop-blur-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-base font-medium">
                    Latest capture
                    {hasSharedCurrent && (
                      <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
                        Shared
                      </span>
                    )}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Preview your result, download it, or share it to the public feed.
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {latestStatus === 'failed' ? (
                    <div className="space-y-3">
                      <p className="text-sm text-red-400">
                        Generation failed: {latestError ?? 'Unknown error'}
                      </p>
                      <Button variant="outline" size="sm" onClick={handleTryAgain}>
                        Dismiss
                      </Button>
                    </div>
                  ) : !latestGeneratedImage?.url ? (
                    latestStatus === 'processing' || latestStatus === 'pending' ? (
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>
                          {latestStatus === 'processing'
                            ? 'Enhancing your photo...'
                            : 'Queued to generate...'}
                        </span>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        Result unavailable. You can capture another.
                      </div>
                    )
                  ) : (
                    <div className="space-y-3">
                      <div className="relative overflow-hidden rounded-xl border border-white/10">
                        <img
                          src={latestGeneratedImage.url}
                          alt="Latest generated result"
                          className="h-full w-full object-cover"
                        />
                        <div className="pointer-events-none absolute inset-0 opacity-30 mix-blend-screen bg-[repeating-linear-gradient(0deg,rgba(255,255,255,.03)_0_2px,transparent_2px_4px)]" />
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant={hasSharedCurrent ? "outline" : "glow"}
                          size="sm"
                          disabled={shareDisabled}
                          onClick={handleShareToFeed}
                        >
                          {isSharingToFeed
                            ? 'Sharing...'
                            : hasSharedCurrent
                            ? 'Shared'
                            : 'Share to Feed'}
                          <Share2 className="ml-2 h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            downloadImage(
                              latestGeneratedImage.url,
                              `dripped-out-${new Date(latestGeneratedImage.createdAt)
                                .toISOString()
                                .replace(/[:.]/g, '-')}.png`
                            )
                          }
                        >
                          Download
                        </Button>
                        <Button variant="secondary" size="sm" onClick={handleTryAgain}>
                          Try Again
                        </Button>
                      </div>
                      {!hasSharedCurrent && (
                        <p className="text-xs text-muted-foreground">
                          Sharing is optional—skip it to keep this result just for you.
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
            <ImagePreview
              images={[]}
              uploadedImages={displayedImages.map(image => ({
                _id: image._id,
                body: image.body,
                createdAt: image.createdAt,
                url: image.url ?? "",
                generationStatus: image.generationStatus
              }))}
              totalImages={generatedImages.length}
              currentPage={currentPage}
              imagesPerPage={IMAGES_PER_PAGE}
              onLoadMore={handleLoadMore}
              hasMore={displayedImages.length < generatedImages.length}
              isLoading={isLoadingMore}
              onAdminDelete={handleAdminDelete}
              isAdmin={isAdmin}
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
