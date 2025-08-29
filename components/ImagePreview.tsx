import { useEffect, useRef } from "react";


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
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoading?: boolean;
}

export default function ImagePreview({
  uploadedImages = [],
  onLoadMore,
  hasMore = false,
  isLoading = false
}: ImagePreviewProps) {
  // Only show uploaded images (captured images are now uploaded automatically)
  const allImages = uploadedImages.map((img, index) => ({
    type: 'uploaded' as const,
    data: img,
    index
  }));

  const loadingRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (!onLoadMore || !hasMore || isLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && onLoadMore) {
          onLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    const currentRef = loadingRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [onLoadMore, hasMore, isLoading]);

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
          {allImages.length} AI-generated image{allImages.length !== 1 ? 's' : ''} ✨
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
                <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded font-medium">
                  {allImages.length - image.index}
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

      {/* Infinite Scroll Loading Indicator */}
      {(isLoading || hasMore) && (
        <div
          ref={loadingRef}
          className="flex items-center justify-center py-8"
        >
          {isLoading ? (
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent"></div>
              <span className="text-muted-foreground">Loading more images...</span>
            </div>
          ) : hasMore ? (
            <div className="text-center text-muted-foreground">
              <div className="text-sm">Scroll down to load more images</div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
