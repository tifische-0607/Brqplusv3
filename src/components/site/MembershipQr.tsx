import { useId } from "react";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";

export const QR_URLS = {
  personal: "https://v3.brqplus.ai/membership/personal?src=qr",
  corporate: "https://v3.brqplus.ai/membership/corporate?src=qr",
} as const;
const QR_DARK = "#111111";
const QR_LIGHT = "#ffffff";

type Kind = keyof typeof QR_URLS;

export function MembershipQr({ kind, size = 140, caption, className = "" }: { kind: Kind; size?: number; caption?: string; className?: string }) {
  const id = useId().replace(/:/g, "");
  const url = QR_URLS[kind];
  const label = kind === "personal" ? "Personal" : "Corporate";
  const alt = `QR code to apply for ${label} membership`;

  function download() {
    const canvas = document.getElementById(`qr-dl-${id}`) as HTMLCanvasElement | null;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `brq-${kind}-membership-qr.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <figure className={`flex flex-col items-center gap-2 ${className}`} style={{ width: size + 24 }}>
      <div className="rounded-xl bg-foreground p-3">
        <QRCodeSVG value={url} size={size} level="H" fgColor={QR_DARK} bgColor={QR_LIGHT} role="img" aria-label={alt} title={alt} />
      </div>
      <QRCodeCanvas id={`qr-dl-${id}`} value={url} size={1024} level="H" marginSize={4} fgColor={QR_DARK} bgColor={QR_LIGHT} className="hidden" aria-hidden />
      {caption && <figcaption className="text-center text-xs text-foreground">{caption}</figcaption>}
      <p className="break-all text-center text-[10px] leading-tight text-muted-foreground">{url}</p>
      <button type="button" onClick={download} className="text-[11px] font-semibold uppercase tracking-wider text-gold hover:underline">Download</button>
    </figure>
  );
}
