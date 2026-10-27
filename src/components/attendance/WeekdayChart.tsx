import type { WeekdayStat } from "../../types/attendance";
import { formatNumber } from "../../utils/attendance";

interface WeekdayChartProps {
  stats: WeekdayStat[];
}

/** Colunas finas com a média de faltas por dia da semana. O dia mais alto ganha destaque. */
export function WeekdayChart({ stats }: WeekdayChartProps) {
  const max = Math.max(...stats.map((s) => s.avgAbsences), 0);
  return (
    <ul aria-label="Média de faltas por dia da semana" className="flex h-44 items-end gap-3">
      {stats.map((stat) => {
        const isPeak = max > 0 && stat.avgAbsences === max;
        return (
          <li
            key={stat.weekday}
            title={`${stat.label}-feira: média de ${formatNumber(stat.avgAbsences)} faltas por dia (${stat.days} dias)`}
            className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5"
          >
            <span className="text-xs tabular-nums text-muted">{formatNumber(stat.avgAbsences)}</span>
            <span
              className={`w-full max-w-[2.5rem] rounded-t-md transition-[filter] group-hover:brightness-110 ${
                isPeak ? "bg-accent" : "bg-accent/35"
              }`}
              style={{ height: `${max === 0 ? 0 : (stat.avgAbsences / max) * 100 * 0.78}%` }}
            />
            <span className="text-xs text-muted">{stat.label.slice(0, 3)}</span>
          </li>
        );
      })}
    </ul>
  );
}
