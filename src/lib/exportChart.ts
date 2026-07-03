// High-resolution PNG export for the SVG diagrams. Clones the target <svg>,
// resolves the --exp-* design tokens to concrete colours (otherwise the
// rasterised copy is blank), draws it onto a hi-dpi canvas over a light
// background, and stamps a footer band with the STAT-UP logo and a copyright
// line. Pure presentation utility; no model logic.
import logoLight from "@/assets/statup-logo.png.asset.json";

interface ExportOpts {
  filename: string;
  title?: string;
}

// Every design token the diagrams reference. Resolved from the live element so
// the export matches the current theme's palette (rendered on white regardless).
const TOKENS = [
  "--exp-ink",
  "--exp-muted",
  "--exp-bg",
  "--exp-surface",
  "--exp-border",
  "--exp-grid",
  "--exp-axis",
  "--exp-marker",
  "--exp-font",
  "--exp-open",
  "--exp-hybrid",
  "--exp-frontier",
  "--exp-accent-1",
  "--exp-accent-2",
  "--exp-accent-3",
];

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function downloadChartPng(svgEl: SVGSVGElement, opts: ExportOpts) {
  const { filename, title } = opts;

  // Resolve tokens against the live element (falls back to :root).
  const cs = getComputedStyle(svgEl);
  const rootCs = getComputedStyle(document.documentElement);
  const resolved: Record<string, string> = {};
  for (const t of TOKENS) {
    resolved[t] = (cs.getPropertyValue(t) || rootCs.getPropertyValue(t)).trim();
  }

  // Determine intrinsic size from the viewBox (falls back to bounding box).
  const vb = svgEl.viewBox.baseVal;
  const rect = svgEl.getBoundingClientRect();
  const w = vb && vb.width ? vb.width : rect.width || 1200;
  const h = vb && vb.height ? vb.height : rect.height || 700;

  // Clone and force explicit sizing + resolved token values on the root.
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("width", String(w));
  clone.setAttribute("height", String(h));
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.removeAttribute("style");
  const styleDecl = TOKENS.map((t) => `${t}:${resolved[t]}`).join(";");
  clone.setAttribute("style", styleDecl);

  const svgString = new XMLSerializer().serializeToString(clone);
  const svgUrl =
    "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgString);
  const svgImg = await loadImage(svgUrl);

  // Layout of the export canvas.
  const scale = 3;
  const pad = 28;
  const titleH = title ? 44 : 16;
  const footerH = 96;
  const cw = w + pad * 2;
  const ch = h + pad * 2 + titleH + footerH;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(cw * scale);
  canvas.height = Math.round(ch * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);

  // Light background for deck-ready exports.
  const bg = "#ffffff";
  const ink = resolved["--exp-ink"] || "#1b1f24";
  const muted = resolved["--exp-muted"] || "#6b7280";
  const border = resolved["--exp-border"] || "#e5e7eb";
  const font = (resolved["--exp-font"] || "Figtree, sans-serif").replace(/"/g, "");

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, cw, ch);

  // Optional title.
  if (title) {
    ctx.fillStyle = ink;
    ctx.font = `600 20px ${font}`;
    ctx.textBaseline = "top";
    ctx.fillText(title, pad, pad);
  }

  // The diagram.
  ctx.drawImage(svgImg, pad, pad + titleH, w, h);

  // Footer divider.
  const footerTop = pad + titleH + h + 20;
  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, footerTop);
  ctx.lineTo(cw - pad, footerTop);
  ctx.stroke();

  // Logo (left) + copyright (right).
  const year = new Date().getFullYear();
  const copyright = `\u00A9 ${year} STAT-UP \u00B7 For demonstration purposes only.`;

  try {
    const logo = await loadImage(logoLight.url);
    const logoH = 34;
    const logoW = (logo.width / logo.height) * logoH;
    ctx.drawImage(logo, pad, footerTop + 22, logoW, logoH);
  } catch {
    ctx.fillStyle = ink;
    ctx.font = `700 22px ${font}`;
    ctx.textBaseline = "middle";
    ctx.fillText("STAT-UP", pad, footerTop + 40);
  }

  ctx.fillStyle = muted;
  ctx.font = `400 13px ${font}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "right";
  ctx.fillText(copyright, cw - pad, footerTop + 40);
  ctx.textAlign = "left";

  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".png") ? filename : `${filename}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
