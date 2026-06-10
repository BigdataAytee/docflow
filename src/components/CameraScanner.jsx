import { useState, useRef, useEffect, useCallback } from "react";
import { Camera, X, ZoomIn, RotateCcw, Loader2, ScanLine } from "lucide-react";

/**
 * CameraScanner — the parent MUST call getUserMedia() inside the click handler
 * that opens this component, then pass the resulting stream via `initialStream`.
 * This avoids any async gap that breaks the browser's user-gesture requirement.
 */
export default function CameraScanner({ initialStream, onCapture, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(initialStream || null);

  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [flashActive, setFlashActive] = useState(false);
  const [torch, setTorch] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  // Attach the stream (either the passed-in one or start fresh if none given)
  useEffect(() => {
    let cancelled = false;

    async function attach(stream) {
      if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => { if (!cancelled) setReady(true); };
      }
      const track = stream.getVideoTracks()[0];
      const caps = track.getCapabilities?.() || {};
      if (caps.torch) setTorchSupported(true);
    }

    if (initialStream) {
      // Upgrade to higher-res constraints on the existing track if possible
      const track = initialStream.getVideoTracks()[0];
      track.applyConstraints({
        facingMode: { ideal: "environment" },
        width: { ideal: 3840 },
        height: { ideal: 2160 },
      }).catch(() => {}).finally(() => attach(initialStream));
    } else {
      // Fallback: start camera here (only works if browser already granted permission)
      navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 3840 }, height: { ideal: 2160 } },
        audio: false,
      }).then(attach).catch(() => { if (!cancelled) onClose(); });
    }

    return () => {
      cancelled = true;
      // Only stop the stream if WE started it (not the passed-in one — caller owns it)
      if (!initialStream) streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, []);

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
    setFlashActive(true);
    setTimeout(() => setFlashActive(false), 180);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);

    // Auto-levels + contrast boost
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imageData.data;
    let min = 255, max = 0;
    for (let i = 0; i < d.length; i += 4) {
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      if (lum < min) min = lum;
      if (lum > max) max = lum;
    }
    const range = max - min || 1;
    for (let i = 0; i < d.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        let v = ((d[i + c] - min) / range);
        v = v < 0.5 ? 2 * v * v : 1 - Math.pow(-2 * v + 2, 2) / 2;
        d[i + c] = Math.min(255, Math.max(0, Math.round(v * 255)));
      }
    }
    ctx.putImageData(imageData, 0, 0);

    // Unsharp mask
    const offscreen = document.createElement("canvas");
    offscreen.width = canvas.width;
    offscreen.height = canvas.height;
    const octx = offscreen.getContext("2d");
    octx.filter = "blur(1.5px)";
    octx.drawImage(canvas, 0, 0);
    const sharp = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const blur = octx.getImageData(0, 0, offscreen.width, offscreen.height);
    const amount = 1.6;
    for (let i = 0; i < sharp.data.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        sharp.data[i + c] = Math.min(255, Math.max(0,
          sharp.data[i + c] + amount * (sharp.data[i + c] - blur.data[i + c])
        ));
      }
    }
    ctx.putImageData(sharp, 0, 0);

    canvas.toBlob(blob => { onCapture(blob); }, "image/jpeg", 0.97);
  }, [capturing, onCapture]);

  useEffect(() => {
    const handler = (e) => { if (e.key === " " || e.key === "Enter") capture(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [capture]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black" style={{ touchAction: "none" }}>
      {/* Flash */}
      <div className="absolute inset-0 z-10 pointer-events-none transition-opacity duration-100"
        style={{ background: "white", opacity: flashActive ? 0.85 : 0 }} />

      <video ref={videoRef} autoPlay playsInline muted
        className="absolute inset-0 w-full h-full object-cover"
        style={{ display: ready ? "block" : "none" }} />
      <canvas ref={canvasRef} className="hidden" />

      {/* Loading */}
      {!ready && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-10 w-10 text-white animate-spin" />
          <p className="text-white/70 text-sm">Starting camera…</p>
        </div>
      )}

      {ready && (
        <>
          {/* Top bar */}
          <div className="relative z-20 flex items-center justify-between px-5 pt-4 pb-3"
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

          {/* Alignment frame */}
          <div className="relative z-20 flex-1 flex items-center justify-center px-6">
            <div className="relative w-full" style={{ maxWidth: 380, aspectRatio: "3/4" }}>
              {[
                { top: 0, left: 0, borderTop: "3px solid #6366f1", borderLeft: "3px solid #6366f1", borderRadius: "12px 0 0 0" },
                { top: 0, right: 0, borderTop: "3px solid #6366f1", borderRight: "3px solid #6366f1", borderRadius: "0 12px 0 0" },
                { bottom: 0, left: 0, borderBottom: "3px solid #6366f1", borderLeft: "3px solid #6366f1", borderRadius: "0 0 0 12px" },
                { bottom: 0, right: 0, borderBottom: "3px solid #6366f1", borderRight: "3px solid #6366f1", borderRadius: "0 0 12px 0" },
              ].map((style, i) => (
                <div key={i} className="absolute w-9 h-9" style={style} />
              ))}
              <div className="absolute left-2 right-2 h-0.5 rounded-full pointer-events-none"
                style={{ background: "linear-gradient(90deg, transparent, #6366f1, #a5b4fc, #6366f1, transparent)", boxShadow: "0 0 12px rgba(99,102,241,0.9)", animation: "scanline 2.2s ease-in-out infinite" }} />
              <div className="absolute -bottom-10 left-0 right-0 flex items-center justify-center gap-1.5">
                <ScanLine className="h-3.5 w-3.5 text-indigo-400" />
                <span className="text-[11px] font-semibold text-white/60">Ensure good lighting & flat surface</span>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="relative z-20 flex items-center justify-center gap-8 pb-8 pt-4"
            style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)" }}>
            <div className="flex items-center gap-1.5 text-white/40 text-xs">
              <ZoomIn className="h-3.5 w-3.5" /><span>Pinch to zoom</span>
            </div>
            <button onClick={capture} disabled={capturing}
              className="relative w-20 h-20 rounded-full flex items-center justify-center transition-all active:scale-90"
              style={{ background: capturing ? "rgba(99,102,241,0.4)" : "white", boxShadow: "0 0 0 5px rgba(255,255,255,0.2), 0 6px 32px rgba(0,0,0,0.4)" }}>
              {capturing
                ? <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#6366f1" }} />
                : <Camera className="h-8 w-8 text-slate-800" />}
            </button>
            <div className="flex items-center gap-1.5 text-white/40 text-xs">
              <RotateCcw className="h-3.5 w-3.5" /><span>Retake</span>
            </div>
          </div>
        </>
      )}

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