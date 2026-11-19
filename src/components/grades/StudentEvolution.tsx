import { useState } from "react";
import { formatScore, PASSING_MD } from "../../utils/grades";

const TERM_LABELS = ["1º bim", "2º bim", "3º bim", "4º bim"];

/** Área do gráfico (unidades do viewBox; o SVG estica na largura). */
const W = 320;
const H = 150;
const PAD = { top: 14, right: 12, bottom: 26, left: 30 };
const plotW = W - PAD.left - PAD.right;
const plotH = H - PAD.top - PAD.bottom;
const xOf = (i: number) => PAD.left + (plotW / 3) * i;

interface Hover {
  index: number;
}

/**
 * Média geral por bimestre: uma linha só (o título nomeia a série, sem legenda), com a
 * média mínima (6,0) marcada. Passar o mouse ou tocar num bimestre mostra o valor.
 */
export function AverageChart({ averages }: { averages: (number | null)[] }) {
  const [hover, setHover] = useState<Hover | null>(null);
  const yOf = (md: number) => PAD.top + plotH - (md / 10) * plotH;
  const points = averages
    .map((md, i) => (md === null ? null : { i, x: xOf(i), y: yOf(md), md }))
    .filter((p): p is { i: number; x: number; y: number; md: number } => p !== null);
  const active = hover ? points.find((p) => p.i === hover.index) : undefined;

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-sm font-semibold">Média geral por bimestre</figcaption>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full overflow-visible"
          role="img"
          aria-label={`Média geral por bimestre: ${averages
            .map(
              (md, i) =>
                `${TERM_LABELS[i]} ${md === null ? "sem nota" : formatScore(md)}`,
            )
            .join(", ")}`}
          onMouseLeave={() => setHover(null)}
        >
          {[0, 5, 10].map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={yOf(tick)}
                y2={yOf(tick)}
                className="stroke-line"
                strokeWidth="1"
              />
              <text
                x={PAD.left - 6}
                y={yOf(tick) + 3.5}
                textAnchor="end"
                className="fill-muted text-[10px]"
              >
                {tick}
              </text>
            </g>
          ))}
          {/* Média mínima para aprovar. */}
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={yOf(PASSING_MD)}
            y2={yOf(PASSING_MD)}
            className="stroke-prio-urgent"
            strokeWidth="1"
            strokeDasharray="4 3"
          />
          <text
            x={W - PAD.right}
            y={yOf(PASSING_MD) - 4}
            textAnchor="end"
            className="fill-muted text-[10px]"
          >
            mínima 6,0
          </text>
          {TERM_LABELS.map((label, i) => (
            <text
              key={label}
              x={xOf(i)}
              y={H - 8}
              textAnchor="middle"
              className="fill-muted text-[10px]"
            >
              {label}
            </text>
          ))}
          {active && (
            <line
              x1={active.x}
              x2={active.x}
              y1={PAD.top}
              y2={PAD.top + plotH}
              className="stroke-line"
              strokeWidth="1"
            />
          )}
          {points.length > 1 && (
            <polyline
              points={points.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              className="stroke-accent"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          {points.map((p) => (
            <circle
              key={p.i}
              cx={p.x}
              cy={p.y}
              r={4.5}
              className={`stroke-surface ${p.md < PASSING_MD ? "fill-prio-urgent" : "fill-accent"}`}
              strokeWidth="2"
            />
          ))}
          {/* Alvos de toque maiores que o ponto. */}
          {points.map((p) => (
            <rect
              key={`hit-${p.i}`}
              x={p.x - plotW / 6}
              y={PAD.top}
              width={plotW / 3}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setHover({ index: p.i })}
              onClick={() => setHover({ index: p.i })}
            />
          ))}
        </svg>
        {active && (
          <div
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg bg-ink px-2 py-1 text-xs text-canvas shadow-card"
            style={{
              left: `${(active.x / W) * 100}%`,
              top: `${(active.y / H) * 100}%`,
              marginTop: -8,
            }}
          >
            {TERM_LABELS[active.i]}: <strong>{formatScore(active.md)}</strong>
          </div>
        )}
      </div>
    </figure>
  );
}

/** Faltas por bimestre (soma de todas as matérias): barras com o valor em cima. */
export function AbsenceChart({ absences }: { absences: (number | null)[] }) {
  const max = Math.max(1, ...absences.map((value) => value ?? 0));
  const barW = 30;
  const yOf = (value: number) => PAD.top + plotH - (value / max) * plotH;

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-sm font-semibold">Faltas por bimestre</figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full overflow-visible"
        role="img"
        aria-label={`Faltas por bimestre: ${absences
          .map(
            (value, i) =>
              `${TERM_LABELS[i]} ${value === null ? "sem lançamento" : value}`,
          )
          .join(", ")}`}
      >
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={PAD.top + plotH}
          y2={PAD.top + plotH}
          className="stroke-line"
          strokeWidth="1"
        />
        {absences.map((value, i) => {
          const x = xOf(i) - barW / 2;
          const top = yOf(value ?? 0);
          const height = PAD.top + plotH - top;
          return (
            <g key={i}>
              {value !== null && height > 0 && (
                // Ponta arredondada só em cima: a base fica presa no eixo.
                <path
                  d={`M${x},${PAD.top + plotH} V${top + 4} Q${x},${top} ${x + 4},${top} H${x + barW - 4} Q${x + barW},${top} ${x + barW},${top + 4} V${PAD.top + plotH} Z`}
                  className="fill-muted/60"
                >
                  <title>{`${TERM_LABELS[i]}: ${value} faltas`}</title>
                </path>
              )}
              <text
                x={xOf(i)}
                y={top - 5}
                textAnchor="middle"
                className="fill-ink text-[11px] font-semibold"
              >
                {value ?? "–"}
              </text>
              <text
                x={xOf(i)}
                y={H - 8}
                textAnchor="middle"
                className="fill-muted text-[10px]"
              >
                {TERM_LABELS[i]}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
