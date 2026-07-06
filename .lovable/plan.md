# Plot-as-hero: left control sidebar, graph fills the right

Variation B. Consolidate the scattered top chrome into one persistent left sidebar built from the existing `exp-rail`, so the chart area on the right shows just a title + the graph, edge to edge. Pure layout/CSS — no model, formula, data, or copy-logic changes. Reuse the existing `.exp-*` design tokens and the existing collapsible mechanism (no shadcn sidebar, to stay consistent with the current visual system).

## What moves where

Today, above the graph, this stacks vertically (7 rows): journey blurb → "Controls & levers" button → Scenario dropdown + blurb → Trajectories/Pathway tabs → Profit/Users/Revenue/Cost tabs + chip → "TRAJECTORY, PROFIT" caption → "Net profit" title → graph.

New structure for the Trajectories/Pathway stage:

```text
┌───────────────┬─────────────────────────────────────┐
│  SIDEBAR      │  MAIN (graph is the hero)            │
│  (collapsible)│                                       │
│               │  Net profit            [Download PNG]│
│ View          │                                       │
│  [Traject.]   │   ┌─────────────────────────────┐   │
│  [Pathway]    │   │                             │   │
│               │   │        THE GRAPH            │   │
│ Metric        │   │      (fills width)          │   │
│  Profit       │   │                             │   │
│  Users        │   └─────────────────────────────┘   │
│  Revenue      │                                       │
│  Cost         │                                       │
│               │                                       │
│ Scenario ▼    │                                       │
│  (blurb)      │                                       │
│ ───────────   │                                       │
│ Your 4        │                                       │
│  decisions    │                                       │
│  (sliders)    │                                       │
│ ───────────   │                                       │
│ Cumulative    │                                       │
│  profit       │                                       │
└───────────────┴─────────────────────────────────────┘
```

## Changes

**`src/routes/evaluator.tsx`**
- Move the Scenario dropdown (`ScenarioPresets variant="dropdown"`), the Trajectories/Pathway view toggle, and the Profit/Users/Revenue/Cost metric selector OUT of `exp-main` and INTO the top of `exp-rail`, above "Your four decisions". Group them under slim labels ("View", "Metric", "Scenario"). Same handlers, same state, same presets — only their DOM location changes.
- `exp-main` keeps only: the section title (e.g. "Net profit" / "Outcome pathway …"), the Download PNG button (kept top-right of the chart), the chart/diagram itself, and the collapsible "More info +" details (unchanged).
- Remove the redundant chrome above the graph: the `exp-journey-blurb` paragraph (line 353) and the "TRAJECTORY, PROFIT" small caption. The blurb text is relocated as muted helper text at the very top of the sidebar so the explanation is still available but out of the graph's way.
- Keep the "Controls & levers" / "Hide controls" toggle as the sidebar's collapse control. Default it OPEN on desktop; when collapsed the graph spans full width. On the Risk and Tipping stages the same sidebar pattern applies (they already share `exp-rail`).

**`src/styles.css`**
- `.exp-body` becomes a real 2-column grid: sidebar (fixed, ~260–300px) + `1fr` main, with the main graph area centered and allowed to grow. Collapsed state → single `1fr` column with a slim re-open button.
- Add compact styling for the relocated controls inside the rail: `.exp-rail` gets a "View" and "Metric" segmented group styled with existing tokens; the metric tabs become a vertical or wrapped compact list to fit the narrow column.
- Make the chart wrapper (`exp-fig` / `exp-causal-wrap`) stretch to the main column width so the plot is visibly the largest element.
- Responsive: below ~900px the sidebar collapses to the top (stacked) so mobile still works.

## Guardrails
- No changes to `src/lib/scenario/model.ts`, formulas, numbers, or the wording of control notes.
- All colors via existing `--exp-*` tokens; no raw hex in components.
- Metric tabs, view toggle, scenario presets, sliders, readout, and PNG export keep identical behavior — only their placement and container styling change.
- Verify on `/evaluator`: graph sits at the top-right as the dominant element, sidebar collapses/expands, scenario/metric/view switching all still work, and the layout reflows cleanly on a narrow screen.
