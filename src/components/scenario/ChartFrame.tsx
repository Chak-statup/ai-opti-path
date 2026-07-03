// Wraps a diagram and provides a "Download PNG" button that exports the
// rendered <svg> as a high-resolution image with STAT-UP branding.
import { useRef, useState, type ReactNode } from "react";
import { downloadChartPng } from "@/lib/exportChart";

export function ChartFrame({
  filename,
  title,
  children,
}: {
  filename: string;
  title?: string;
  children: ReactNode;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleDownload() {
    const svg = wrapRef.current?.querySelector("svg");
    if (!svg) return;
    setBusy(true);
    try {
      await downloadChartPng(svg as SVGSVGElement, { filename, title });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="exp-chartframe">
      <div className="exp-chartframe-bar">
        <button
          type="button"
          className="exp-download-btn"
          onClick={handleDownload}
          disabled={busy}
          aria-label="Download this diagram as a PNG image"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 3v12m0 0l-4-4m4 4l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          {busy ? "Preparing…" : "Download PNG"}
        </button>
      </div>
      <div ref={wrapRef}>{children}</div>
    </div>
  );
}
