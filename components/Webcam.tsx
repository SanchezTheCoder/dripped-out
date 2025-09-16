'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';

import { Camera, CameraOff } from 'lucide-react';

interface WebcamProps {
  onCapture?: (imageData: string) => void;
  isUploading?: boolean;
  autoStart?: boolean;       // start camera automatically when true on mount
  reset?: number;            // increment to clear captured frame and return to live view
}

export default function Webcam({ onCapture, isUploading = false, autoStart = false, reset }: WebcamProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string>('');
  const [capturedImage, setCapturedImage] = useState<string>('');

  const startCamera = useCallback(async () => {
    try {
      setError('');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false
      });

      if (videoRef.current) {
        // Attach the stream and try to play immediately; some browsers
        // require an explicit play() call after setting srcObject.
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        try {
          await videoRef.current.play();
        } catch {
          // Fallback: wait for metadata and then play
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(() => {});
          };
        }
        setIsActive(true);
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError('Unable to access camera. Please check permissions.');
    }
  }, [videoRef]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
    setCapturedImage(''); // Clear captured image when stopping camera
    setError('');
  }, [videoRef]);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw the current video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to data URL
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    setCapturedImage(imageData);

    if (onCapture) {
      onCapture(imageData);
    }
  }, [videoRef, canvasRef, onCapture]);

  // Retake flow removed in favor of a single "Try Again" action elsewhere

  useEffect(() => {
    // Auto-start camera if requested. Avoid depending on isActive because it
    // would trigger cleanup (stop) immediately after starting.
    if (autoStart && !isActive) {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [autoStart, startCamera, stopCamera]);

  // When parent increments `reset`, clear the still frame and restart camera
  useEffect(() => {
    if (reset === undefined) return;
    setCapturedImage('');
    // Restart camera for a clean state regardless of current isActive
    stopCamera();
    startCamera();
  }, [reset, startCamera, stopCamera]);

  

  return (
    <div className="space-y-4">
      

      {error && (
        <div className="bg-destructive/10 border border-destructive text-destructive text-sm p-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="bg-muted rounded-lg p-4 border border-border">
        {!capturedImage ? (
          <div className="relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full rounded-lg border border-accent ${isActive ? 'block' : 'hidden'}`}
              style={{ aspectRatio: '4/3' }}
            />
            {!isActive && (
              <div className="w-full bg-card border border-border rounded-lg flex items-center justify-center" style={{ aspectRatio: '4/3', minHeight: '240px' }}>
                <div className="text-center text-muted-foreground">
                  <CameraOff className="w-16 h-16 mx-auto mb-3 text-accent" />
                  <p className="text-lg font-medium">Camera is off</p>
                  <p className="text-sm">Click &quot;Start Camera&quot; to begin</p>
                </div>
              </div>
            )}
            {isUploading && (
              <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                <div className="text-center text-white">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                  <p className="text-sm font-medium">Uploading...</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="relative">
            <img
              src={capturedImage}
              alt="Captured"
              className="w-full rounded-lg border border-accent"
            />
            <div className="absolute top-2 right-2 bg-accent text-accent-foreground px-2 py-1 rounded text-xs font-medium">
              Captured
            </div>
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" />
        
      </div>

      <div className="flex justify-center gap-3">
        {!isActive && !capturedImage && (
          <Button onClick={startCamera} size="sm" className=" flex items-center gap-2 px-6 py-3">
            <Camera className="w-4 h-4" />
            Start Camera
          </Button>
        )}

        {isActive && !capturedImage && (
          <>
            <Button
              onClick={capturePhoto}
              className="btn-primary px-6 py-3"
              disabled={isUploading}
            >
              {isUploading ? "📤 Uploading..." : "📸 Capture Photo"}
            </Button>
            <Button
              onClick={stopCamera}
              className="bg-muted hover:bg-muted/80 text-muted-foreground border border-border px-6 py-3"
              disabled={isUploading}
            >
              ⏹️ Stop Camera
            </Button>
          </>
        )}

        {capturedImage && (
          <Button onClick={stopCamera} className="bg-muted hover:bg-muted/80 text-muted-foreground border border-border px-6 py-3">
            ⏹️ Stop Camera
          </Button>
        )}
      </div>
    </div>
  );
}
