import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { focusRing } from "@/components/members/portal-ui";

type Props = {
  src: string;
  onCancel: () => void;
  onApply: (blob: Blob) => void;
  size?: number; // output size in px (square)
  busy?: boolean;
};

const FRAME = 320; // displayed crop square in CSS px

export default function AvatarCropper({ src, onCancel, onApply, size = 512, busy }: Props) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [minZoom, setMinZoom] = useState(1);
  const dragging = useRef<{ x: number; y: number } | null>(null);

  // Load image, fit-cover into frame as base scale
  useEffect(() => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => {
      const base = Math.max(FRAME / i.width, FRAME / i.height);
      setImg(i);
      setMinZoom(base);
      setZoom(base);
      setOffset({ x: 0, y: 0 });
    };
    i.src = src;
  }, [src]);

  function clampOffset(next: { x: number; y: number }, z: number) {
    if (!img) return next;
    const w = img.width * z;
    const h = img.height * z;
    const maxX = Math.max(0, (w - FRAME) / 2);
    const maxY = Math.max(0, (h - FRAME) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y)),
    };
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture(e.pointerId);
    dragging.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current) return;
    setOffset(clampOffset({ x: e.clientX - dragging.current.x, y: e.clientY - dragging.current.y }, zoom));
  }
  function onPointerUp() {
    dragging.current = null;
  }

  function onZoomChange(v: number) {
    setZoom(v);
    setOffset((o) => clampOffset(o, v));
  }

  function nudge(dx: number, dy: number) {
    setOffset((current) => clampOffset({ x: current.x + dx, y: current.y + dy }, zoom));
  }

  async function apply() {
    if (!img) return;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Map: frame-center is at (img.width*zoom/2 + offset.x, ...) from image top-left in scaled coords.
    // Source rect in original image coords:
    const srcSize = FRAME / zoom;
    const cx = img.width / 2 - offset.x / zoom;
    const cy = img.height / 2 - offset.y / zoom;
    const sx = cx - srcSize / 2;
    const sy = cy - srcSize / 2;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, sx, sy, srcSize, srcSize, 0, 0, size, size);
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.9));
    if (blob) onApply(blob);
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onCancel(); }}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-2xl border-border bg-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-gold">Crop avatar</p>
        <DialogTitle className="mt-1 font-display text-xl font-bold text-foreground">Square the frame</DialogTitle>
        <DialogDescription className="mt-1 text-xs text-muted-foreground">Drag to reposition, use the move buttons, and slide to zoom.</DialogDescription>

        <div
          className="mx-auto mt-5 overflow-hidden rounded-full border border-border bg-black"
          style={{ width: FRAME, height: FRAME, touchAction: "none", cursor: dragging.current ? "grabbing" : "grab" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          role="img"
          aria-label="Avatar crop preview"
        >
          {img && (
            <div
              className="relative h-full w-full select-none"
              style={{ touchAction: "none" }}
            >
              <img
                src={src}
                alt=""
                draggable={false}
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: img.width * zoom,
                  height: img.height * zoom,
                  transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                  maxWidth: "none",
                  userSelect: "none",
                  pointerEvents: "none",
                }}
              />
            </div>
          )}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2" aria-label="Reposition avatar">
          <span />
          <button type="button" onClick={() => nudge(0, -10)} className={`min-h-11 rounded-md border border-border text-sm text-foreground ${focusRing}`}>Move up</button>
          <span />
          <button type="button" onClick={() => nudge(-10, 0)} className={`min-h-11 rounded-md border border-border text-sm text-foreground ${focusRing}`}>Move left</button>
          <button type="button" onClick={() => setOffset({ x: 0, y: 0 })} className={`min-h-11 rounded-md border border-border text-sm text-foreground ${focusRing}`}>Centre</button>
          <button type="button" onClick={() => nudge(10, 0)} className={`min-h-11 rounded-md border border-border text-sm text-foreground ${focusRing}`}>Move right</button>
          <span />
          <button type="button" onClick={() => nudge(0, 10)} className={`min-h-11 rounded-md border border-border text-sm text-foreground ${focusRing}`}>Move down</button>
        </div>

        <div className="mt-5">
          <label htmlFor="avatar-zoom" className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Zoom</label>
          <input
            id="avatar-zoom"
            type="range"
            min={minZoom}
            max={minZoom * 4}
            step={0.01}
            value={zoom}
            onChange={(e) => onZoomChange(parseFloat(e.target.value))}
            className={`mt-2 w-full accent-gold ${focusRing}`}
          />
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className={`min-h-11 rounded-md border border-border px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground disabled:opacity-60 ${focusRing}`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={!img || busy}
            className={`min-h-11 rounded-md bg-gold px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110 disabled:opacity-60 ${focusRing}`}
          >
            {busy ? "Uploading…" : "Apply & upload"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
