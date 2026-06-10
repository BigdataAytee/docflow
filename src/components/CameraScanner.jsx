import { useState, useRef, useEffect, useCallback } from "react";
import { Camera, X, ZoomIn, RotateCcw, Loader2, ScanLine } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";

/**
 * CameraScanner — full-screen live camera viewfinder with document alignment overlay.
 * Captures a high-resolution frame and returns a Blob via onCapture(blob).
 */
export default function CameraScanner({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [flashActive, setFlashActive] = useState(false);
  const [torch, setTorch] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [error, setError] = useState(null); // null | "denied" | "unavailable"
  const [retryKey, setRetryKey] = useState(0);
  const { openSettings } = usePermissions();

  // Start camera
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setError(null);
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 3840 },
            height: { ideal: 2160 },
            focusMode: { ideal: "continuous" },
          },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            if (!cancelled) setReady(true);
          };
        }
        const track = stream.getVideoTracks()[0];
        const caps = track.getCapabilities?.() || {};
        if (caps.torch) setTorchSupported(true);
      } catch (err) {
        if (!cancelled) {
          setError(err.name === "NotAllowedError" || err.name === "PermissionDeniedError"
            ? "denied"
            : "unavailable");
        }
      }
    }
    startCamera();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [retryKey]);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torch;
    await track.applyConstraints({ advanced: [{ torch: next }] });
    setTorch(next);
  }, [torch]);

  const capture = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || capturing) return;
    setCapturing(true);

    // Flash effect
    setFlashActive(true);
    setTimeout(() => setFlashActive(false), 180);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");

    // Draw raw frame
    ctx.drawImage(video, 0, 0);

    // ── Image enhancement: boost contrast & sharpness for OCR ──
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imageData.data;

    // 1. Auto-levels: find min/max luminance
    let min = 255, max = 0;
    for (let i = 0; i < d.length; i += 4) {
      const lum = 0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2];
      if (lum < min) min = lum;
      if (lum > max) max = lum;
    }
    const range = max - min || 1;

    // 2. Apply stretch + mild contrast S-curve
    for (let i = 0; i < d.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        let v = ((d[i + c] - min) / range) * 255;
        // S-curve contrast boost
        v = v / 255;
        v = v < 0.5 ? 2 * v * v : 1 - Math.pow(-2 * v + 2, 2) / 2;
        d[i + c] = Math.min(255, Math.max(0, Math.round(v * 255)));
      }
    }
    ctx.putImageData(imageData, 0, 0);

    // Unsharp mask: draw blurred copy, blend
    const offscreen = document.createElement("canvas");
    offscreen.width = canvas.width;
    offscreen.height = canvas.height;
    const octx = offscreen.getContext("2d");
    octx.filter = "blur(1.5px)";
    octx.drawImage(canvas, 0, 0);
    const sharp = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const blur  = octx.getImageData(0, 0, offscreen.width, offscreen.height);
    const amount = 1.6;
    for (let i = 0; i < sharp.data.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        sharp.data[i+c] = Math.min(255, Math.max(0,
          sharp.data[i+c] + amount * (sharp.data[i+c] - blur.data[i+c])
        ));
      }
    }
    ctx.putImageData(sharp, 0, 0);

    // Export as high-quality JPEG
    canvas.toBlob(blob => {
      onCapture(blob);
    }, "image/jpeg", 0.97);
  }, [capturing, onCapture]);

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e) => { if (e.key === " " || e.key === "Enter") capture(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [capture]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black" style={{ touchAction: "none" }}>
      {/* Flash overlay */}
      <div className="absolute inset-0 z-10 pointer-events-none transition-opacity duration-100"
        style={{ background: "white", opacity: flashActive ? 0.85 : 0 }} />

      {/* Video feed */}
      <video
        ref={videoRef}
        autoPlay playsInline muted
        className="absolute inset-0 w-full h-full object-cover"
        style={{ display: ready ? "block" : "none" }}
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Loading */}
      {!ready && !error && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-10 w-10 text-white animate-spin" />
          <p className="text-white/70 text-sm">Starting camera…</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-8 text-center">
          <div className="w-20 h-20 rounded-3xl bg-red-500/20 flex items-center justify-center">
            <Camera className="h-10 w-10 text-red-400" />
          </div>

          {error === "denied" ? (
            <>
              <div>
                <p className="text-white font-bold text-lg mb-1">Camera Access Blocked</p>
                <p className="text-white/60 text-sm leading-relaxed">
                  Your browser has blocked camera access. To fix this:
                </p>
              </div>

              {/* Step-by-step instructions */}
              <div className="w-full max-w-xs bg-white/10 rounded-2xl p-4 text-left space-y-2.5">
                {[
                  { icon: "1", text: "Look for a 🔒 or 📷 icon in your browser's address bar" },
                  { icon: "2", text: 'Click it and set Camera to "Allow"' },
                  { icon: "3", text: 'Tap "Retry" below — no page reload needed' },
                ].map(({ icon, text }) => (
                  <div key={icon} className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-indigo-500 text-white text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">{icon}</span>
                    <p className="text-white/80 text-xs leading-relaxed">{text}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-2 w-full max-w-xs">
                {/* Open device settings (works on iOS & some Android) */}
                <button
                  onClick={openSettings}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold px-6 py-3 rounded-2xl transition-colors flex items-center justify-center gap-2"
                >
                  <span>⚙️</span> Open Device Settings
                </button>
                <button
                  onClick={() => setRetryKey(k => k + 1)}
                  className="w-full bg-white/15 hover:bg-white/25 text-white text-sm font-bold px-6 py-3 rounded-2xl transition-colors"
                >
                  🔄 Retry Camera
                </button>
                <button onClick={onClose} className="text-white/40 text-xs hover:text-white/70 transition-colors py-1">
                  Cancel — use gallery instead
                </button>
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="text-white font-bold text-lg mb-1">Camera Unavailable</p>
                <p className="text-white/60 text-sm">Could not access your camera. Try uploading an image from your gallery instead.</p>
              </div>
              <button
                onClick={() => setRetryKey(k => k + 1)}
                className="bg-white/15 hover:bg-white/25 text-white text-sm font-bold px-6 py-2.5 rounded-2xl transition-colors"
              >
                🔄 Try Again
              </button>
              <button onClick={onClose} className="text-white/40 text-xs hover:text-white/70 transition-colors">
                Go Back
              </button>
            </>
          )}
        </div>
      )}

      {/* Overlay UI — only when camera is ready */}
      {ready && !error && (
        <>
          {/* Top bar */}
          <div className="relative z-20 flex items-center justify-between px-5 pt-safe pt-4 pb-3"
            style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.65), transparent)" }}>
            <button onClick={onClose}
              className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white border border-white/15">
              <X className="h-5 w-5" />
            </button>
            <div className="flex flex-col items-center">
              <p className="text-white font-black text-sm tracking-wide">Document Scanner</p>
              <p className="text-white/50 text-[10px] font-medium mt-0.5">Position document within the frame</p>
            </div>
            {torchSupported ? (
              <button onClick={toggleTorch}
                className={`w-10 h-10 rounded-full backdrop-blur-sm flex items-center justify-center border transition-all ${torch ? "bg-yellow-400 border-yellow-300 text-black" : "bg-black/40 border-white/15 text-white"}`}>
                <span className="text-lg leading-none">⚡</span>
              </button>
            ) : <div className="w-10" />}
          </div>

          {/* Document alignment frame */}
          <div className="relative z-20 flex-1 flex items-center justify-center px-6">
            <div className="relative w-full" style={{ maxWidth: 380, aspectRatio: "3/4" }}>
              {/* Semi-dark vignette outside frame */}
              <div className="absolute -inset-[9999px] bg-black/45 pointer-events-none" style={{ clipPath: "polygon(0% 0%, 0% 100%, 100% 100%, 100% 0%)" }} />

              {/* Corner brackets */}
              {[
                { top: 0, left: 0, borderTop: "3px solid #6366f1", borderLeft: "3px solid #6366f1", borderRadius: "12px 0 0 0" },
                { top: 0, right: 0, borderTop: "3px solid #6366f1", borderRight: "3px solid #6366f1", borderRadius: "0 12px 0 0" },
                { bottom: 0, left: 0, borderBottom: "3px solid #6366f1", borderLeft: "3px solid #6366f1", borderRadius: "0 0 0 12px" },
                { bottom: 0, right: 0, borderBottom: "3px solid #6366f1", borderRight: "3px solid #6366f1", borderRadius: "0 0 12px 0" },
              ].map((style, i) => (
                <div key={i} className="absolute w-9 h-9" style={style} />
              ))}

              {/* Animated scan line */}
              <div className="absolute left-2 right-2 h-0.5 rounded-full pointer-events-none"
                style={{
                  background: "linear-gradient(90deg, transparent, #6366f1, #a5b4fc, #6366f1, transparent)",
                  boxShadow: "0 0 12px rgba(99,102,241,0.9)",
                  animation: "scanline 2.2s ease-in-out infinite",
                }} />

              {/* Center crosshair */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-6 h-6 relative">
                  <div className="absolute top-1/2 left-0 right-0 h-px bg-white/30" />
                  <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/30" />
                </div>
              </div>

              {/* Tips */}
              <div className="absolute -bottom-10 left-0 right-0 flex items-center justify-center gap-1.5">
                <ScanLine className="h-3.5 w-3.5 text-indigo-400" />
                <span className="text-[11px] font-semibold text-white/60">Ensure good lighting & flat surface</span>
              </div>
            </div>
          </div>

          {/* Bottom controls */}
          <div className="relative z-20 flex items-center justify-center gap-8 pb-safe pb-8 pt-4"
            style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)" }}>

            {/* Zoom tip */}
            <div className="flex items-center gap-1.5 text-white/40 text-xs">
              <ZoomIn className="h-3.5 w-3.5" />
              <span>Pinch to zoom</span>
            </div>

            {/* Shutter */}
            <button
              onClick={capture}
              disabled={capturing}
              className="relative w-20 h-20 rounded-full flex items-center justify-center transition-all active:scale-90"
              style={{ background: capturing ? "rgba(99,102,241,0.4)" : "white", boxShadow: "0 0 0 5px rgba(255,255,255,0.2), 0 6px 32px rgba(0,0,0,0.4)" }}
            >
              {capturing
                ? <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#6366f1" }} />
                : <Camera className="h-8 w-8 text-slate-800" />
              }
            </button>

            {/* Retry hint */}
            <div className="flex items-center gap-1.5 text-white/40 text-xs">
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Retake</span>
            </div>
          </div>
        </>
      )}

      {/* Scan line keyframes */}
      <style>{`
        @keyframes scanline {
          0%   { top: 8%;  opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { top: 92%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}