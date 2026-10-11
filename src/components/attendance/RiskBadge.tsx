import type { RiskLevel } from "../../types/attendance";

const STYLES: Record<RiskLevel, { label: string; icon: string; classes: string }> = {
  critical: { label: "Crítico", icon: "▲", classes: "bg-prio-urgent-tint text-prio-urgent" },
  warning: { label: "Atenção", icon: "●", classes: "bg-prio-medium-tint text-prio-medium" },
  ok: { label: "Regular", icon: "✓", classes: "bg-prio-low-tint text-prio-low" },
};

/** Status sempre com ícone + texto, nunca só cor. */
export function RiskBadge({ risk }: { risk: RiskLevel }) {
  const { label, icon, classes } = STYLES[risk];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${classes}`}
    >
      <span aria-hidden="true">{icon}</span>
      {label}
    </span>
  );
}
