// One-click ENVIRONMENT scenarios. A scenario changes only the outside world
// (prices, regulation, delivered quality); your strategy levers stay where
// you set them. The strategy itself (the Lean/Balanced/Premium tier and the
// four sliders) is YOUR decision, in the rail on the left.
import type { ScenarioPreset } from "@/lib/scenario/model";

export function ScenarioPresets({
  presets,
  activeId,
  onSelect,
  variant = "cards",
}: {
  presets: ScenarioPreset[];
  activeId: string | null;
  onSelect: (p: ScenarioPreset) => void;
  variant?: "cards" | "dropdown";
}) {
  if (variant === "dropdown") {
    const active = presets.find((p) => p.id === activeId);
    return (
      <div className="exp-scenario-select" role="group" aria-label="Environment scenarios">
        <label className="exp-scenario-select-label" htmlFor="exp-scenario-dd">
          Scenario
        </label>
        <select
          id="exp-scenario-dd"
          className="exp-scenario-dd"
          value={activeId ?? ""}
          onChange={(e) => {
            const p = presets.find((x) => x.id === e.target.value);
            if (p) onSelect(p);
          }}
        >
          {activeId === null && <option value="">Custom (edited)</option>}
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        {active && <span className="exp-scenario-select-blurb">{active.blurb}</span>}
      </div>
    );
  }

  return (
    <div role="group" aria-label="Environment scenarios">
      <div className="exp-presets-title">
        Environment scenarios: the world changes; your strategy stays put
      </div>
      <div className="exp-presets">
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`exp-preset ${activeId === p.id ? "active" : ""}`}
            aria-pressed={activeId === p.id}
            onClick={() => onSelect(p)}
          >
            <span className="exp-preset-label">{p.label}</span>
            <span className="exp-preset-blurb">{p.blurb}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
