import { SUBJECT_LABELS } from "../../constants/descriptors";
import type { Assessment, RosterEntry } from "../../types/assessment";
import { encodeCardCode } from "../../utils/omr/cardCode";
import {
  BUBBLE_RADIUS,
  CARD_HEIGHT,
  CARD_WIDTH,
  CODE_CELL,
  CODE_CELLS,
  cardLayout,
  GRID_HEADER_Y,
  MARKER_SIZE,
  MARKERS,
} from "../../utils/omr/cardLayout";

interface AnswerCardProps {
  assessment: Assessment;
  /** Aluno do cartão nominal; `null` = cartão em branco (o aluno é escolhido na correção). */
  student: RosterEntry | null;
  schoolName: string;
}

const formatDate = (iso: string): string => {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : "";
};

/**
 * Cartão-resposta em SVG, em milímetros reais (210 × 148). Usa a mesma geometria do leitor
 * óptico (`cardLayout`): não mova nada aqui sem mover lá.
 */
export function AnswerCard({ assessment, student, schoolName }: AnswerCardProps) {
  const layout = cardLayout(assessment.questions.length, assessment.alternatives);
  const bits = encodeCardCode(assessment.code, student?.slot ?? 0);
  const label = student ? `Cartão-resposta de ${student.name}` : "Cartão-resposta em branco";

  return (
    <svg
      viewBox={`0 0 ${CARD_WIDTH} ${CARD_HEIGHT}`}
      width={`${CARD_WIDTH}mm`}
      height={`${CARD_HEIGHT}mm`}
      role="img"
      aria-label={label}
      className="answer-card block h-auto w-full max-w-full bg-white"
      fontFamily="Arial, Helvetica, sans-serif"
    >
      <rect x={0} y={0} width={CARD_WIDTH} height={CARD_HEIGHT} fill="#fff" />
      {MARKERS.map((m, i) => (
        <rect key={i} x={m.x - MARKER_SIZE / 2} y={m.y - MARKER_SIZE / 2} width={MARKER_SIZE} height={MARKER_SIZE} fill="#000" />
      ))}
      {CODE_CELLS.map((c, i) =>
        bits[i] ? (
          <rect key={i} x={c.x - CODE_CELL / 2} y={c.y - CODE_CELL / 2} width={CODE_CELL} height={CODE_CELL} fill="#000" />
        ) : null,
      )}

      {/* Cabeçalho (abaixo da faixa branca de referência do papel, em y ≈ 16,5 mm). */}
      <text x={18} y={22.5} fontSize={3} fill="#333">
        {schoolName || "Escola"}
      </text>
      <text x={192} y={22.5} fontSize={3} fill="#333" textAnchor="end">
        Avaliação nº {assessment.code}
      </text>
      <text x={18} y={28.5} fontSize={4.4} fontWeight="bold" fill="#000">
        {assessment.title || "Avaliação"}
      </text>
      <text x={18} y={34} fontSize={3.1} fill="#222">
        {`${SUBJECT_LABELS[assessment.subject]} · Turma ${assessment.className} · ${formatDate(assessment.date)}`}
      </text>
      <text x={18} y={41.5} fontSize={3.4} fill="#000">
        Aluno(a):
      </text>
      <text x={34} y={41.5} fontSize={3.6} fontWeight="bold" fill="#000">
        {student?.name ?? ""}
      </text>
      <line x1={33} y1={42.6} x2={student ? 150 : 192} y2={42.6} stroke="#777" strokeWidth={0.2} />
      {student && (
        <text x={192} y={41.5} fontSize={3.1} fill="#333" textAnchor="end">
          {student.rollNumber ? `Nº ${student.rollNumber}` : ""}
        </text>
      )}

      {/* Letras sobre cada coluna e as bolhas. */}
      {layout.columns.map((column, c) => (
        <g key={c}>
          {column.header.map((h) => (
            <text key={h.choice} x={h.x} y={GRID_HEADER_Y + 1} fontSize={3.2} fontWeight="bold" textAnchor="middle" fill="#000">
              {h.choice}
            </text>
          ))}
        </g>
      ))}
      {layout.numbers.map((n) => (
        <text key={n.question} x={n.x} y={n.y + 1.1} fontSize={3.1} fontWeight="bold" textAnchor="middle" fill="#000">
          {n.question + 1}
        </text>
      ))}
      {layout.bubbles.map((b) => (
        <g key={`${b.question}-${b.choice}`}>
          <circle cx={b.x} cy={b.y} r={BUBBLE_RADIUS} fill="none" stroke="#444" strokeWidth={0.25} />
          <text x={b.x} y={b.y + 0.8} fontSize={2.2} textAnchor="middle" fill="#a0a0a0">
            {b.choice}
          </text>
        </g>
      ))}

      <text x={CARD_WIDTH / 2} y={144.5} fontSize={2.5} fill="#555" textAnchor="middle">
        Pinte toda a bolha da resposta com caneta preta ou azul. Uma resposta por questão. Não rasure nem dobre o cartão.
      </text>
    </svg>
  );
}
