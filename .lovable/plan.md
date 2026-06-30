
# Causal pathway redesign + Problem-tab icons

Two visual upgrades, both presentation-only (no model math changes).

## Part A — Causal pathway diagram (`CausalDiagram.tsx` + styles)

### Remove
- The four gray column bands (`var(--exp-grid)` rectangles).
- The four column caption pills: "decision & levers", "causal maps", "dynamics", "outcome".

### Add: lever "influence regions" (the headline change)
Each of the four decisions gets its own soft, rounded, color-tinted region that visually encloses the nodes it drives, so a first-time viewer instantly sees "this lever moves these things." Concept:

```text
 ┌── 04 Scaling ─────────┐
 │   Q*      Δm          │──────► χ (churn) ──┐
 └───────────────────────┘                    ├─► N(t) ──► Π
 ┌── 03 In-house build ──┐     m (margin) ────┘
 │   drives χ + m        │
 └───────────────────────┘
 ┌ 02 Vendor ┐  shock ──────────────────────────► Π
 └───────────┘
 ┌ 01 Platform reach ┐ ── scales ── N(t)
 └───────────────────┘
```

- Region 04 **Scaling** encloses `Q*` and `Δm` (your example — driven together).
- Region 03 **In-house build** highlights its drive into `χ` and `m`.
- Region 02 **Vendor independence** ties to the `shock` node.
- Region 01 **Platform reach** ties to `N(t)`.
- Each region: rounded translucent fill in its axis color, a thin matching border, and a small numbered chip (01–04) + short label on the region edge. Colors reuse the existing decision/axis tokens, kept muted.

### Add: risk shading
- Nodes currently carrying pressure (the "bad" state) get a distinct **red-tinted halo / soft glow** behind the card, not just a colored border — so risk reads at a glance. This applies live: e.g. when `χ` (churn), `shock`, or a negative `Π` cross into the bad band, their halo appears/intensifies.
- A single compact legend row stays: "reinforcing link / pressure / thicker = stronger", plus a new "shaded = risk under pressure" swatch.

### Polish for "more elaborate / better"
- Slightly larger node cards, more breathing room, cleaner curved edges (keep existing bezier + animated flow dashes).
- Keep native SVG `<text>` labels (mobile-safe, current approach) — no KaTeX-in-foreignObject regression.
- The `exp-axis-map` legend block below the diagram is now partly redundant with on-diagram region labels; I'll keep a slimmed version (or fold it into the diagram) so nothing is lost.

### What does NOT change
- All node math, edge intensities, colors-by-state logic, and `CausalState` stay identical. This is layout + new region/halo overlays only.

## Part B — Problem tab icons (`ProblemFrame.tsx` + styles)

Add a distinctive icon to each of the four axis cards (01–04). Goal: modern, technical, structural — not the generic "sparkle/robot/brain" AI look. Plan to use **custom hand-drawn line SVGs** (thin stroke, geometric, matching the diagram's restrained style) rather than off-the-shelf rounded icons:

| Axis | Icon concept |
|---|---|
| 01 Platform ecosystem | nested app tiles / stacked panels radiating outward (reach) |
| 02 Vendor choice | a single trunk splitting into multiple plug endpoints (one vendor vs many) |
| 03 Build vs buy | a blueprint bracket / module being assembled vs a sealed box |
| 04 Scaling strategy | a throttle/dial sweeping up a stepped ramp |

- Mono-stroke, `currentColor`, ~28px, sit in the card header next to the number.
- Subtle hover treatment consistent with existing card styling.

## Open question before build
For Part B icons: do you want **(a)** custom line SVGs as described (most control, on-brand, non-generic), or **(b)** curated Lucide icons chosen to look technical (faster, but slightly more "standard")? My recommendation is (a).
