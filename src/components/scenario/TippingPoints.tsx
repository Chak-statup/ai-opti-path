// Tipping-point threshold cards: value vs critical line, marker, and a
// plain-language "what happens past here" rule.
import type { TippingPoint } from "@/lib/scenario/model";

export function TippingPoints({ points }: { points: TippingPoint[] }) {
  const crossed = points.filter((p) => p.crossed).length;
  return (
    <div className="exp-tp-wrap">
      <div className={`exp-tp-summary ${crossed > 0 ? "alert" : ""}`}>
        <span className="exp-tp-count">{crossed}</span>
        <span>of {points.length} thresholds crossed</span>
        <span className="exp-tp-summary-note">
          {crossed === 0
            ? "The system sits within stable limits under this scenario."
            : "Past a threshold, the dynamic reinforces itself and is hard to reverse without a structural change."}
        </span>
      </div>
      <div className="exp-tp-grid">
        {points.map((p) => {
          const pct = Math.max(0, Math.min(100, p.value));
          return (
            <div key={p.key} className={`exp-tp-card ${p.crossed ? "crossed" : ""}`}>
              <div className="exp-tp-head">
                <span className="exp-tp-label">{p.label}</span>
                <span className={`exp-tp-state ${p.crossed ? "crossed" : "ok"}`}>
                  {p.crossed ? "Crossed" : "OK"}
                </span>
              </div>
              <div className="exp-tp-value">
                {Math.round(p.value)}
                <span className="exp-tp-of">/ 100</span>
              </div>
              <div className="exp-tp-bar">
                <div
                  className={`exp-tp-fill ${p.crossed ? "crossed" : ""}`}
                  style={{ width: `${pct}%` }}
                />
                <div className="exp-tp-marker" style={{ left: `${p.threshold}%` }} />
              </div>
              <div className="exp-tp-scale">
                <span>0</span>
                <span className="exp-tp-thresh">
                  {p.belowIsBad ? "floor" : "tipping point"} {p.threshold}
                </span>
                <span>100</span>
              </div>
              <p className="exp-tp-explain">{p.explanation}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
