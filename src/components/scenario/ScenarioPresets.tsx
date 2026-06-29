// One-click scenario presets that set the levers and context together.
import type { ScenarioPreset } from "@/lib/scenario/model";

export function ScenarioPresets({
  presets,
  activeId,
  onSelect,
}: {
  presets: ScenarioPreset[];
  activeId: string | null;
  onSelect: (p: ScenarioPreset) => void;
}) {
  return (
    <div className="exp-presets" role="group" aria-label="Scenario presets">
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
  );
}
