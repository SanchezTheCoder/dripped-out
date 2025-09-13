import { Button } from "./ui/button";
import { Download } from "lucide-react";



interface UploadedImage {
  _id: string;
  body: string;
  createdAt: number;
  url: string;
  generationStatus?: string;
}

interface ImagePreviewProps {
  images: string[]; // Keeping for compatibility, but will be empty
  uploadedImages?: UploadedImage[];
  totalImages?: number; // Total count of all generated images
  currentPage?: number; // Current page number for pagination
  imagesPerPage?: number; // Number of images per page
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoading?: boolean;
}

export default function ImagePreview({
  uploadedImages = [],
  totalImages = 0,
  currentPage = 0,
  imagesPerPage = 12,
  onLoadMore,
  hasMore = false,
  isLoading = false
}: ImagePreviewProps) {
  const downloadImage = async (url: string, suggestedName: string) => {
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
      // Fallback: open in new tab if we cannot fetch due to CORS or network errors
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    }
  };
  // Only show uploaded images (captured images are now uploaded automatically)
  const allImages = uploadedImages.map((img, index) => ({
    type: 'uploaded' as const,
    data: img,
    index
  }));



  if (allImages.length === 0 && !isLoading) {
    return (
      <div className="flex items-center justify-center h-64 border-2 border-dashed border-accent/30 bg-muted/50 rounded-lg">
        <div className="text-center text-muted-foreground">
          <div className="text-6xl mb-4">🎨</div>
          <p className="text-lg font-medium mb-2">No generated images yet</p>
          <p className="text-sm">Upload or capture an image to see AI-generated versions</p>

        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {totalImages} AI-generated image{totalImages !== 1 ? 's' : ''} ✨
          {isLoading && ' (loading...)'}
        </p>
      </div>

      {/* 3-Column Grid Layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {allImages.map((image) => (
          <div key={`${image.type}-${image.index}`} className="group">
            <div className="bg-card border-border hover:border-accent transition-colors overflow-hidden rounded-lg">
              <div className="aspect-square relative">
                <img
                  src={image.data.url}
                  alt={`Image ${new Date(image.data.createdAt).toLocaleDateString()}`}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  onError={(e) => {
                    // Fallback to placeholder if image fails to load
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent) {
                      parent.innerHTML = `
                        <div class="flex items-center justify-center h-full text-muted-foreground">
                          <div class="text-center">
                            <div class="text-2xl mb-1">📷</div>
                            <div class="text-xs">Image</div>
                          </div>
                        </div>
                      `;
                    }
                  }}
                />

                {/* Actions overlay */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="icon"
                    variant="secondary"
                    aria-label="Download image"
                    onClick={() =>
                      downloadImage(
                        image.data.url,
                        `dripped-out-${new Date(image.data.createdAt)
                          .toISOString()
                          .replace(/[:.]/g, '-')}.png`
                      )
                    }
                    disabled={!image.data.url}
                  >
                    <Download />
                  </Button>
                </div>


                {/* Generation status overlay */}
                {(image.data.generationStatus === 'pending' || image.data.generationStatus === 'processing') && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="text-center text-white">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                      <p className="text-sm font-medium">
                        {image.data.generationStatus === 'pending' ? 'Queued' : 'Processing'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Load More Button */}
      {hasMore && (
        <div className="flex items-center justify-center py-6">
          <Button
            size="sm"
            onClick={onLoadMore}
            disabled={isLoading}
            variant="outline"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Loading...</span>
              </div>
            ) : (
              `Load More (${totalImages - allImages.length} remaining)`
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
