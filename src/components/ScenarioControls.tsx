import type { Scenario, ShockType } from "@/lib/sim/types";
import { SHOCK_META, SHOCK_TYPES } from "@/lib/sim/scenario";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

interface Props {
  scenario: Scenario;
  onChange: (next: Scenario) => void;
}

export function ScenarioControls({ scenario, onChange }: Props) {
  const set = (patch: Partial<Scenario>) => onChange({ ...scenario, ...patch });

  const setShock = (
    type: ShockType,
    patch: Partial<Scenario["shocks"][ShockType]>,
  ) =>
    onChange({
      ...scenario,
      shocks: {
        ...scenario.shocks,
        [type]: { ...scenario.shocks[type], ...patch },
      },
    });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Assumptions
        </h3>
        <div className="mt-4 space-y-5">
          <SliderRow
            label="Planning horizon"
            value={`${scenario.horizonMonths} mo`}
          >
            <Slider
              min={12}
              max={18}
              step={1}
              value={[scenario.horizonMonths]}
              onValueChange={([v]) => set({ horizonMonths: v })}
            />
          </SliderRow>
          <SliderRow label="Apps live at start" value={`${scenario.startApps}`}>
            <Slider
              min={2}
              max={60}
              step={1}
              value={[scenario.startApps]}
              onValueChange={([v]) => set({ startApps: v })}
            />
          </SliderRow>
          <SliderRow
            label="Launch ambition"
            value={`${scenario.ambition.toFixed(2)}×`}
          >
            <Slider
              min={0.5}
              max={1.5}
              step={0.05}
              value={[scenario.ambition]}
              onValueChange={([v]) => set({ ambition: v })}
            />
          </SliderRow>
          <SliderRow
            label="Monthly user growth"
            value={`${Math.round(scenario.userGrowth * 100)}%`}
          >
            <Slider
              min={0.02}
              max={0.4}
              step={0.01}
              value={[scenario.userGrowth]}
              onValueChange={([v]) => set({ userGrowth: v })}
            />
          </SliderRow>
        </div>
      </div>

      <div>
        <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Shock events
        </h3>
        <div className="mt-4 space-y-4">
          {SHOCK_TYPES.map((type) => {
            const cfg = scenario.shocks[type];
            const meta = SHOCK_META[type];
            return (
              <div
                key={type}
                className="rounded-xl border border-border bg-card/60 p-3.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{meta.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Prior {Math.round(meta.prior * 100)}% likely
                    </p>
                  </div>
                  <Switch
                    checked={cfg.enabled}
                    onCheckedChange={(v) => setShock(type, { enabled: v })}
                  />
                </div>
                {cfg.enabled && (
                  <div className="mt-3 space-y-3 border-t border-border pt-3">
                    <p className="text-xs text-muted-foreground">
                      {meta.description}
                    </p>
                    <SliderRow label="Hits month" value={`${cfg.month}`} small>
                      <Slider
                        min={1}
                        max={scenario.horizonMonths}
                        step={1}
                        value={[Math.min(cfg.month, scenario.horizonMonths)]}
                        onValueChange={([v]) => setShock(type, { month: v })}
                      />
                    </SliderRow>
                    <SliderRow
                      label="Severity"
                      value={`${Math.round(cfg.magnitude * 100)}%`}
                      small
                    >
                      <Slider
                        min={0.1}
                        max={1}
                        step={0.05}
                        value={[cfg.magnitude]}
                        onValueChange={([v]) => setShock(type, { magnitude: v })}
                      />
                    </SliderRow>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SliderRow({
  label,
  value,
  children,
  small,
}: {
  label: string;
  value: string;
  children: React.ReactNode;
  small?: boolean;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className={small ? "text-xs text-muted-foreground" : "text-sm font-medium"}>
          {label}
        </span>
        <span className="font-display text-sm font-semibold tabular-nums">
          {value}
        </span>
      </div>
      {children}
    </div>
  );
}
