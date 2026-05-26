/**
 * PWA camera capture (Phase 1).
 *
 * - Prefers rear camera (`facingMode: 'environment'`).
 * - Renders a live <video> preview; on capture, draws to a hidden <canvas>
 *   and emits a JPEG data URL.
 * - Photos are downsized to max 1600px on the long edge (keeps payload under
 *   the API's 8MB body cap and still enough resolution for sidewall OCR).
 *
 * Permissions: getUserMedia requires HTTPS in prod (PWA handles this). Dev
 * works on localhost over http.
 */
import { useEffect, useRef, useState } from 'react';
import { Button } from '../design/index.js';

const MAX_LONG_EDGE = 1600;
const JPEG_QUALITY = 0.82;

type Props = {
  onCapture: (dataUrl: string) => void;
  labels: {
    capture: string;
    retake: string;
    useFile: string;
  };
};

export function CameraCapture({ onCapture, labels }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } },
          audio: false,
        });
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'camera_unavailable');
      }
    };
    void start();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [stream]);

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return;

    const longEdge = Math.max(vw, vh);
    const scale = longEdge > MAX_LONG_EDGE ? MAX_LONG_EDGE / longEdge : 1;
    canvas.width = Math.round(vw * scale);
    canvas.height = Math.round(vh * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    onCapture(dataUrl);
  };

  const useFile = () => fileRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') onCapture(reader.result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4">
      <div
        className="relative aspect-[3/4] md:aspect-video w-full max-w-2xl mx-auto rounded-[var(--rb-radius-lg)] overflow-hidden bg-[var(--rb-bg-sunk)] border border-[var(--rb-border)]"
      >
        {error ? (
          <div className="absolute inset-0 grid place-items-center text-[var(--rb-fg-muted)] p-6 text-center">
            {error}
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button size="tap" onClick={capture} disabled={!stream}>
          {labels.capture}
        </Button>
        <Button size="tap" tone="secondary" onClick={useFile}>
          {labels.useFile}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={onFile}
        />
      </div>
    </div>
  );
}
