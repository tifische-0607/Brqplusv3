import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

export type SignaturePadHandle = { toDataUrl: () => string | null; clear: () => void };

/** Pointer-events signature canvas (mouse, touch, stylus). */
export const SignaturePad = forwardRef<SignaturePadHandle, { disabled?: boolean; onChange?: (hasInk: boolean) => void }>(
  function SignaturePad({ disabled, onChange }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const last = useRef<{ x: number; y: number } | null>(null);
    const [hasInk, setHasInk] = useState(false);

    function setup() {
      const c = canvasRef.current;
      if (!c) return;
      const ratio = window.devicePixelRatio || 1;
      const rect = c.getBoundingClientRect();
      c.width = Math.round(rect.width * ratio);
      c.height = Math.round(rect.height * ratio);
      const ctx = c.getContext("2d")!;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#0d0d0d";
    }
    useEffect(setup, []);

    function update(v: boolean) {
      setHasInk(v);
      onChange?.(v);
    }
    function pos(e: React.PointerEvent) {
      const r = canvasRef.current!.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    function down(e: React.PointerEvent) {
      if (disabled) return;
      e.preventDefault();
      canvasRef.current!.setPointerCapture(e.pointerId);
      drawing.current = true;
      last.current = pos(e);
      const ctx = canvasRef.current!.getContext("2d")!;
      ctx.beginPath();
      ctx.arc(last.current.x, last.current.y, 1, 0, Math.PI * 2);
      ctx.fillStyle = "#0d0d0d";
      ctx.fill();
    }
    function move(e: React.PointerEvent) {
      if (!drawing.current || disabled) return;
      const p = pos(e);
      const ctx = canvasRef.current!.getContext("2d")!;
      ctx.beginPath();
      ctx.moveTo(last.current!.x, last.current!.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      last.current = p;
      if (!hasInk) update(true);
    }
    function up() {
      drawing.current = false;
      last.current = null;
    }
    function clear() {
      const c = canvasRef.current;
      if (!c) return;
      c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
      update(false);
    }
    useImperativeHandle(ref, () => ({
      clear,
      toDataUrl: () => (hasInk && canvasRef.current ? canvasRef.current.toDataURL("image/png") : null),
    }));

    return (
      <div>
        <canvas
          ref={canvasRef}
          aria-label="Signature area — draw your signature"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onPointerLeave={up}
          className={`h-40 w-full touch-none rounded-md border border-border bg-foreground ${disabled ? "cursor-not-allowed opacity-50" : "cursor-crosshair"}`}
        />
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>{hasInk ? "Signature captured" : "Draw your signature above"}</span>
          <button type="button" onClick={clear} disabled={disabled} className="font-semibold uppercase tracking-wider text-gold hover:underline disabled:opacity-50">
            Clear
          </button>
        </div>
      </div>
    );
  },
);
