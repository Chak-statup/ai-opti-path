# Plot-first evaluator + diagram downloads

Three changes, none of which alter the model, the formulas, or the wording of any existing content. Everything is layout, a toggle, and an export utility.

## 1. Make the plot the hero; sliders in a collapsible sidebar; scenarios in a dropdown

Today `/evaluator` renders a fixed two-column grid (`.exp-body`: 230px rail + main) for the Causal / Risk / Tipping stages, with scenario presets as a row of cards above the chart. The rail competes with the plot for attention.

Changes (in `src/routes/evaluator.tsx` and `src/styles.css`):

- **Collapsible sidebar.** Add a `railOpen` state (default open on desktop, closed on narrow screens). Wrap the existing `<aside class="exp-rail">` so it can slide/collapse, and add a slim toggle button ("Controls" with a chevron) pinned at the edge of the main area. When collapsed, the plot dashboard takes the full width. No slider markup or copy changes — the whole existing rail (four decisions, environment, readout) just moves inside the collapsible container.
- **Grid becomes responsive to the toggle.** `.exp-body` switches between `230px 1fr` (open) and `1fr` (collapsed) via a modifier class. The chart/diagram area is always the dominant, neatly-centered element.
- **Scenarios as a dropdown.** Replace the `ScenarioPresets` card row with a compact labeled dropdown ("Scenario:") that lists the same presets and calls the same `applyPreset`. The active preset stays reflected in the selected value. `ScenarioPresets.tsx` gets a new compact `variant="dropdown"` (default keeps the card layout so nothing else breaks); the evaluator uses the dropdown variant. Same presets, same behavior, same content.
- The Trajectories / Pathway subtabs and the metric tabs stay exactly where they are, directly above the plot, so the plot is the first and most prominent thing on the page.

Flow preserved: default stage stays `causal`, default subview stays `charts` (Trajectories), the journey stepper, FABs, and all other stages are untouched.

## 2. Causal diagram: toggle to hide the small sub-text under node labels

In `CausalDiagram.tsx` every node renders a title glyph plus one or two small sub-lines (`nodeSub`, the delta/detail line). 

- Add a `showDetail` boolean prop. When `false`, render only the node title glyph (the variable, e.g. `Q`, `N(t)`, `Π`) and skip the `nodeSub` and second sub-line `<text>` elements. Vertically center the glyph when details are hidden.
- In `evaluator.tsx`, add a toggle button in the Pathway view header ("Show values" / "Variables only") wired to a `causalDetail` state, passed into `<CausalDiagram showDetail={...} />`. Default keeps current behavior (details shown).

## 3. High-res PNG download with STAT-UP logo + copyright, for every diagram

Add one shared utility and one small reusable wrapper, then attach a download button to each diagram (Trajectory LineChart, RadarChart, CausalDiagram).

- **`src/lib/exportChart.ts`** — `downloadChartPng(svgEl, { filename, title })`:
  1. Clone the target `<svg>`, inline the computed values of the CSS custom properties it uses (`--exp-*` tokens resolve to real colors so the export isn't blank), and set explicit width/height.
  2. Serialize to a data URL, draw onto a canvas at ~3× device scale for high resolution.
  3. Draw a footer band with the STAT-UP logo (loaded from the existing `statup-logo` asset URL) and a copyright line: `© {year} STAT-UP · For demonstration purposes only.`
  4. Trigger a `.png` download via a temporary anchor.
- **`src/components/scenario/ChartFrame.tsx`** — wraps a diagram, holds a `ref` to the rendered `<svg>`, and renders a small "Download PNG" button (top-right) that calls the utility. Styling uses existing tokens.
- Wrap the three diagrams in `ChartFrame` in `evaluator.tsx`. The LineChart/RadarChart/CausalDiagram components themselves need no internal change (the frame finds the `<svg>` via ref), keeping their markup intact.

## Technical notes
- All new colors/styles use existing `--exp-*` semantic tokens; no raw hex in components.
- Pure frontend/presentation work: no changes to `src/lib/scenario/model.ts`, no data, no formulas, no copy.
- `standalone/` is left as-is unless you want it synced afterward (can be a follow-up).
- Verify by loading `/evaluator`: sidebar collapses/expands, scenario dropdown switches environments, causal toggle hides sub-text, and each diagram downloads a crisp PNG with logo + copyright.

## Open question
For the download, should the exported PNG use a **light background regardless of theme** (best for pasting into decks), or match the current light/dark theme? Default plan: always light background for consistency in reports.