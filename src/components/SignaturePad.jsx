import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

export default function SignaturePad({ label = "Signature", onSave }) {
  const canvasRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [savedSig, setSavedSig] = useState(null);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const source = e.touches ? e.touches[0] : e;
    return { x: source.clientX - rect.left, y: source.clientY - rect.top };
  };

  const startDraw = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const { x, y } = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setDrawing(true);
  };

  const draw = (e) => {
    if (!drawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const { x, y } = getPos(e, canvas);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDraw = () => setDrawing(false);

  const clear = () => {
    const canvas = canvasRef.current;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    setSavedSig(null);
  };

  const save = () => {
    const dataUrl = canvasRef.current.toDataURL("image/png");
    setSavedSig(dataUrl);
    onSave && onSave(dataUrl);
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      {savedSig ? (
        <div className="border border-border rounded-lg p-3 bg-white">
          <img src={savedSig} alt="Signature" className="h-16 object-contain" />
          <button onClick={() => setSavedSig(null)} className="text-xs text-primary mt-1 hover:underline">Re-sign</button>
        </div>
      ) : (
        <div className="space-y-2">
          <canvas
            ref={canvasRef}
            width={300}
            height={100}
            className="border-2 border-dashed border-border rounded-lg bg-gray-50 touch-none cursor-crosshair w-full"
            style={{ maxWidth: 300, height: 100 }}
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={stopDraw}
            onMouseLeave={stopDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={stopDraw}
          />
          <p className="text-xs text-muted-foreground">Sign above using mouse or stylus</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={clear} disabled={!hasSignature}><Trash2 className="h-3 w-3 mr-1" />Clear</Button>
            <Button size="sm" onClick={save} disabled={!hasSignature}>Save Signature</Button>
          </div>
        </div>
      )}
    </div>
  );
}