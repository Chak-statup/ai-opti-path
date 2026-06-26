import { useEffect, useRef } from "react";
import type { Agent } from "@/lib/sim/abm";

function cssVar(name: string): string {
  if (typeof window === "undefined") return "#888";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function AgentCanvas({ agents, tick }: { agents: Agent[]; tick: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const size = canvas.clientWidth;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    const pad = 14;
    const span = size - pad * 2;
    const px = (v: number) => pad + v * span;

    const colors = {
      adopted: cssVar("--quality"),
      atRisk: cssVar("--cost"),
      churned: cssVar("--risk"),
      unaware: cssVar("--muted-foreground"),
      edge: cssVar("--border"),
    };

    const byId = new Map(agents.map((a) => [a.id, a] as const));

    // Edges between adopted agents (network contagion paths).
    ctx.strokeStyle = colors.edge;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 0.5;
    for (const a of agents) {
      if (a.state !== "adopted") continue;
      for (const nId of a.neighbors) {
        const n = byId.get(nId);
        if (n && n.state === "adopted" && n.id > a.id) {
          ctx.beginPath();
          ctx.moveTo(px(a.x), px(a.y));
          ctx.lineTo(px(n.x), px(n.y));
          ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;

    for (const a of agents) {
      let c = colors.unaware;
      let r = 2.4;
      if (a.state === "adopted") {
        c = a.atRiskFlag ? colors.atRisk : colors.adopted;
        r = 3.4;
      } else if (a.state === "churned") {
        c = colors.churned;
        r = 3;
      }
      ctx.beginPath();
      ctx.fillStyle = c;
      ctx.globalAlpha = a.state === "unaware" ? 0.4 : 1;
      ctx.arc(px(a.x), px(a.y), r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }, [agents, tick]);

  return (
    <canvas
      ref={ref}
      className="aspect-square w-full rounded-2xl border border-border bg-card"
    />
  );
}
