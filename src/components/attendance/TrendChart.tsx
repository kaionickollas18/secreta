import { useId, useState, type PointerEvent } from "react";
import type { DayPoint } from "../../types/attendance";
import { formatDay, formatNumber } from "../../utils/attendance";

interface TrendChartProps {
  points: DayPoint[];
}

const W = 720;
const H = 260;
const PAD = { top: 16, right: 16, bottom: 28, left: 36 };
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function niceMax(value: number): number {
  if (value <= 4) return 4;
  const step = value <= 20 ? 5 : value <= 50 ? 10 : 20;
  return Math.ceil(value / step) * step;
}

/** Faltas por dia (área) com média móvel de 7 dias (linha). */
export function TrendChart({ points }: TrendChartProps) {
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return <p className="text-sm text-muted">Sem dados suficientes.</p>;

  const max = niceMax(Math.max(...points.map((p) => p.absences)));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (i / (points.length - 1)) * innerW;
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;

  const line = (pick: (p: DayPoint) => number) =>
    points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(pick(p)).toFixed(1)}`).join(" ");
  const area = `${line((p) => p.absences)} L${x(points.length - 1)},${PAD.top + innerH} L${x(0)},${PAD.top + innerH} Z`;

  const ticks = [0, 1, 2, 3, 4].map((t) => (max / 4) * t);
  // Marca o primeiro dia de chamada de cada mês no eixo X.
  const monthTicks = points
    .map((p, i) => ({ p, i }))
    .filter(({ p, i }) => i === 0 || p.date.slice(0, 7) !== points[i - 1]?.date.slice(0, 7));

  function handleMove(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    const index = Math.round(((ratio * W - PAD.left) / innerW) * (points.length - 1));
    setHover(Math.min(points.length - 1, Math.max(0, index)));
  }

  const active = hover === null ? undefined : points[hover];

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-4 text-xs text-muted">
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-4 rounded-sm bg-accent/60" aria-hidden="true" />
          Faltas por dia
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-4 rounded bg-magenta" aria-hidden="true" />
          Média móvel de 7 dias
        </span>
      </div>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full touch-pan-y"
          role="img"
          aria-label="Gráfico de faltas por dia somadas em todas as turmas selecionadas. Os dados estão na tabela abaixo."
          onPointerMove={handleMove}
          onPointerLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y(t)}
                y2={y(t)}
                stroke="rgba(167,139,250,0.12)"
                strokeDasharray={t === 0 ? undefined : "3 4"}
              />
              <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#A8A3C7">
                {Math.round(t)}
              </text>
            </g>
          ))}
          {monthTicks.map(({ p, i }) => (
            <text key={p.date} x={x(i)} y={H - 8} fontSize="11" fill="#A8A3C7">
              {MONTHS[Number(p.date.slice(5, 7)) - 1]}
            </text>
          ))}
          <path d={area} fill={`url(#${gradientId})`} />
          <path d={line((p) => p.absences)} fill="none" stroke="#C4B5FD" strokeWidth="2" strokeLinejoin="round" />
          <path d={line((p) => p.average)} fill="none" stroke="#E879F9" strokeWidth="2" strokeLinejoin="round" />
          {hover !== null && active && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} stroke="rgba(255,255,255,0.35)" />
              <circle cx={x(hover)} cy={y(active.absences)} r="4" fill="#C4B5FD" stroke="#1A1530" strokeWidth="2" />
              <circle cx={x(hover)} cy={y(active.average)} r="4" fill="#E879F9" stroke="#1A1530" strokeWidth="2" />
            </g>
          )}
        </svg>
        {hover !== null && active && (
          <div
            className="pointer-events-none absolute top-2 z-10 rounded-xl border border-line bg-raised px-3 py-2 text-xs shadow-card"
            style={{
              left: `${(x(hover) / W) * 100}%`,
              transform: `translateX(${hover > points.length / 2 ? "-105%" : "5%"})`,
            }}
          >
            <p className="font-semibold">{formatDay(active.date)}</p>
            <p className="text-muted">Faltas: {active.absences}</p>
            <p className="text-muted">Média 7 dias: {formatNumber(active.average)}</p>
          </div>
        )}
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-muted hover:text-ink">Ver dados do gráfico</summary>
        <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-line">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">Faltas por dia</caption>
            <thead className="sticky top-0 bg-raised">
              <tr>
                <th scope="col" className="px-3 py-2">Data</th>
                <th scope="col" className="px-3 py-2">Faltas</th>
                <th scope="col" className="px-3 py-2">Média 7 dias</th>
              </tr>
            </thead>
            <tbody>
              {[...points].reverse().map((p) => (
                <tr key={p.date} className="border-t border-line">
                  <td className="px-3 py-1.5">{formatDay(p.date)}</td>
                  <td className="px-3 py-1.5">{p.absences}</td>
                  <td className="px-3 py-1.5">{formatNumber(p.average)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
