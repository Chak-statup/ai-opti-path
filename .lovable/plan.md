## Goal

Three focused changes on `/evaluator`, no model/formula/number changes:

1. Outcome pathway uses scenario **cards** (like Risk profile) instead of the dropdown.
2. The step progress bar moves from a horizontal strip on top to a **vertical bar on the right**, so the plot sits centered between the left control rail and the right journey bar.
3. Remove the **empty space above the spider chart** on Risk profile.

---

### 1. Scenario cards in Outcome pathway

- In the causal rail controls (`src/routes/evaluator.tsx`, the `exp-rail-controls` block), remove the `ScenarioPresets variant="dropdown"` field.
- Add the card variant `ScenarioPresets` (same as Risk/Tipping) at the top of the `exp-main` causal section — above the chart in both Trajectories and Pathway views — matching how Risk profile renders it. Same `presets`, `activePreset`, `applyPreset` — behavior unchanged.

### 2. Vertical journey bar on the right

New page shell layout so the plot is flanked on both sides:

```text
┌──────────┬────────────────────────┬───────────┐
│ CONTROLS │        PLOT            │  JOURNEY  │
│  rail    │   (centered, hero)     │  01 ▪     │
│ (left)   │                        │  02 ▪     │
│          │                        │  03 ▪     │
└──────────┴────────────────────────┴───────────┘
```

- Wrap the stage content + journey nav in a flex/grid container. Move the `exp-journey` `<nav>` to the right side and restyle it as a vertical rail: steps stacked top-to-bottom, the connector line running vertically, same numbered dots and active/done states.
- Applies across all stages (causal, risk, tipping, mitigate, recommend) so the journey bar is consistently on the right.
- Below ~900px it collapses back to a horizontal bar on top (existing responsive breakpoint) so mobile stays usable.

**Technical:** `src/styles.css` — repoint `.exp-journey` from `display:flex` (row) to a vertical column with `flex-direction:column`; swap the `::before` connector from horizontal to vertical; give the outer wrapper a grid with a fixed right column (~150–170px). `src/routes/evaluator.tsx` — restructure the JSX so `exp-journey` renders inside the right column alongside the main content instead of as a full-width strip.

### 3. Trim whitespace above the radar

- `.exp-radar-layout` currently vertically centers (`align-items:center`), which pushes the shorter radar column down relative to the taller text column, creating a gap above the chart. Change to `align-items:start`.
- Tighten the radar container top padding/margin so the chart starts right under the title.

---

### Guardrails
- No changes to `model.ts`, formulas, numbers, or copy wording.
- All colors via existing `--exp-*` tokens.
- Scenario switching, metric/view toggles, sliders, readout, PNG export unchanged.
- Verify: cards switch scenarios in Outcome pathway; journey bar sits vertical on the right with plot centered; radar starts flush under its title; layout reflows cleanly on narrow screens.

### Recommendation
Proceed with all three. #1 and #3 are low-risk. #2 is the largest change but purely layout/CSS; keeping the ~900px fallback to a top horizontal bar avoids breaking mobile.
