import { SUBJECT_LABELS } from "../constants/descriptors";
import { teachingTip, type TeachingTip } from "../constants/teachingTips";
import type { AnswerSheet, Assessment, Choice } from "../types/assessment";
import {
  classHistory,
  classSummary,
  descriptorStats,
  questionStats,
  studentResults,
  type ClassSummary,
  type DescriptorStat,
  type QuestionStat,
  type StudentResult,
} from "./assessmentAnalytics";
import { formatPercent } from "./assessments";

/*
 * Devolutiva pedagógica: o resultado da avaliação dito como um pedagogo diria ao professor
 * regente — o que retomar primeiro, com quais alunos, como, e o que a turma já domina.
 * Funções puras: tudo vem do gabarito e dos cartões corrigidos.
 */

/** Quantos descritores entram como prioridade de retomada. */
const MAX_PRIORITIES = 5;
/** Abaixo disto (acerto da turma no descritor) a habilidade precisa ser retomada. */
const NEEDS_WORK = 0.7;
/** Acima disto o aluno pode ajudar os colegas (monitor). */
const ADVANCED = 0.7;

export interface DistractorNote {
  question: number;
  key: Choice;
  choice: Choice;
  /** Parte da turma que marcou o distrator (0 a 1). */
  share: number;
}

export interface Priority {
  rank: number;
  stat: DescriptorStat;
  tip: TeachingTip;
  /** Alunos que acertaram menos da metade das questões deste descritor. */
  students: string[];
  distractors: DistractorNote[];
}

export interface StudentFocus {
  name: string;
  slot: number;
  percent: number;
  correct: number;
  scored: number;
  blank: number;
  /** Códigos dos descritores não consolidados, do mais fraco ao menos fraco. */
  gaps: string[];
}

export interface PedagogicalReport {
  title: string;
  subtitle: string;
  summary: ClassSummary;
  /** Leitura geral da turma, em parágrafos. */
  overview: string[];
  priorities: Priority[];
  /** Descritores que a turma já consolidou (≥ 70%). */
  strengths: DescriptorStat[];
  groups: {
    critical: StudentFocus[];
    developing: StudentFocus[];
    advanced: StudentFocus[];
  };
  /** Questões para corrigir e discutir em sala. */
  questionsToRevisit: QuestionStat[];
  nextSteps: string[];
  /** Questões sem descritor (a análise fica incompleta). */
  untagged: number[];
}

const pct = (value: number) => formatPercent(value);
const listNames = (names: string[]): string =>
  names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function focusOf(result: StudentResult): StudentFocus {
  return {
    name: result.sheet.studentName,
    slot: result.sheet.slot,
    percent: result.score.percent,
    correct: result.score.correct,
    scored: result.score.scored,
    blank: result.score.outcomes.filter((o) => o === "blank").length,
    gaps: result.gaps.map((g) => g.descriptor.code),
  };
}

const formatDate = (iso: string): string => {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
};

export function buildPedagogicalReport(
  assessment: Assessment,
  sheets: readonly AnswerSheet[],
  allAssessments: readonly Assessment[] = [],
  sheetsOf: (assessmentId: string) => readonly AnswerSheet[] = () => [],
): PedagogicalReport {
  const summary = classSummary(assessment, sheets);
  const descriptors = descriptorStats(assessment, sheets);
  const questions = questionStats(assessment, sheets);
  const students = studentResults(assessment, sheets);
  const subject = SUBJECT_LABELS[assessment.subject];

  // ── Prioridades: descritores abaixo de 70%, do mais errado ao menos errado ──
  const priorities: Priority[] = descriptors
    .filter((d) => d.attempts > 0 && d.hitRate < NEEDS_WORK)
    .slice(0, MAX_PRIORITIES)
    .map((stat, i) => ({
      rank: i + 1,
      stat,
      tip: teachingTip(stat.descriptor),
      students: students
        .filter((s) => s.gaps.some((g) => g.descriptor.code === stat.descriptor.code))
        .map((s) => s.sheet.studentName),
      distractors: questions
        .filter((q) => stat.questions.includes(q.number) && q.topDistractor && q.topDistractor.share >= 0.25)
        .map((q) => ({
          question: q.number,
          key: q.key,
          choice: (q.topDistractor as NonNullable<QuestionStat["topDistractor"]>).choice,
          share: (q.topDistractor as NonNullable<QuestionStat["topDistractor"]>).share,
        })),
    }));

  const strengths = descriptors.filter((d) => d.attempts > 0 && d.hitRate >= NEEDS_WORK).reverse();

  // ── Alunos ──
  const critical = students.filter((s) => s.critical).map(focusOf);
  const developing = students
    .filter((s) => !s.critical && s.score.percent < ADVANCED)
    .map(focusOf);
  const advanced = students
    .filter((s) => !s.critical && s.score.percent >= ADVANCED)
    .map(focusOf)
    .sort((a, b) => b.percent - a.percent);

  // ── Leitura geral ──
  const overview: string[] = [];
  const absent = summary.missing.length;
  overview.push(
    `A avaliação "${assessment.title || "sem título"}" de ${subject} foi corrigida para ${plural(summary.applied, "aluno", "alunos")} da turma ${assessment.className}` +
      (summary.rosterSize ? ` (de ${summary.rosterSize} na lista${absent ? `; ${plural(absent, "ficou", "ficaram")} sem cartão` : ""})` : "") +
      `. A média de acertos foi ${pct(summary.mean)}, com mediana de ${pct(summary.median)}, em ${plural(summary.scoredQuestions, "questão válida", "questões válidas")}.`,
  );
  if (summary.mean < 0.5)
    overview.push(
      "O resultado mostra que a maior parte da turma ainda não consolidou as habilidades avaliadas. A retomada precisa ser coletiva, com a turma inteira, antes de avançar no conteúdo.",
    );
  else if (summary.mean < 0.7)
    overview.push(
      "O resultado é intermediário: uma parte da turma já domina as habilidades, outra parte precisa de retomada direcionada. Vale combinar a retomada coletiva dos pontos mais frágeis com o trabalho em grupos.",
    );
  else
    overview.push(
      "A turma consolidou a maior parte das habilidades avaliadas. O foco agora é atender quem ficou para trás e aprofundar com os demais.",
    );
  const history = classHistory(assessment, allAssessments, sheetsOf).filter((h) => h.assessmentId !== assessment.id);
  const previous = [...history].reverse().find((h) => h.date <= assessment.date);
  if (previous) {
    const diff = Math.round((summary.mean - previous.mean) * 100);
    overview.push(
      diff === 0
        ? `A média ficou igual à da avaliação anterior ("${previous.title}", ${formatDate(previous.date)}).`
        : `Em relação à avaliação anterior ("${previous.title}", ${formatDate(previous.date)}), a média ${diff > 0 ? "subiu" : "caiu"} ${Math.abs(diff)} ${Math.abs(diff) === 1 ? "ponto" : "pontos"} percentuais (${pct(previous.mean)} → ${pct(summary.mean)}).`,
    );
  }
  if (summary.applied > 0) {
    const parts = [
      `${plural(critical.length, "aluno está", "alunos estão")} abaixo de ${pct(assessment.criticalThreshold)} e ${critical.length === 1 ? "precisa" : "precisam"} de acompanhamento próximo`,
      `${plural(developing.length, "está", "estão")} em desenvolvimento`,
      `${plural(advanced.length, "já domina", "já dominam")} a maior parte (70% ou mais)`,
    ];
    overview.push(`Na distribuição: ${parts.join("; ")}.`);
  }
  if (summary.blankRate >= 0.1)
    overview.push(
      `Chamou atenção o número de questões em branco (${pct(summary.blankRate)} das respostas). Vale verificar o tempo de prova, a leitura dos enunciados e a familiaridade dos alunos com o cartão-resposta.`,
    );

  // ── Questões para retomar em sala ──
  const questionsToRevisit = questions.filter((q) => q.errorRate >= 0.5).slice(0, 6);

  // ── Encaminhamentos ──
  const nextSteps: string[] = [];
  if (priorities.length > 0) {
    const top = priorities.slice(0, 3).map((p) => p.stat.descriptor.code);
    nextSteps.push(
      `Retomar com a turma ${top.length === 1 ? "o descritor" : "os descritores"} ${listNames(top)} nas próximas duas semanas, usando as estratégias sugeridas em cada prioridade.`,
    );
  } else if (summary.applied > 0) {
    nextSteps.push("Nenhum descritor ficou abaixo de 70% na turma: seguir o planejamento e aprofundar os conteúdos.");
  }
  if (questionsToRevisit.length > 0)
    nextSteps.push(
      `Corrigir e discutir em sala as questões ${listNames(questionsToRevisit.map((q) => String(q.number)))}, pedindo que os alunos expliquem por que escolheram cada alternativa (o distrator mais marcado mostra o raciocínio que precisa ser desfeito).`,
    );
  if (critical.length > 0)
    nextSteps.push(
      `Planejar atendimento individual ou em pequeno grupo para ${plural(critical.length, "aluno", "alunos")} em situação crítica, começando por ${listNames(critical.slice(0, 3).map((s) => s.name))}. Avaliar com a coordenação a inclusão na turma de reforço.`,
    );
  if (priorities.some((p) => p.students.length >= 2))
    nextSteps.push("Organizar grupos de estudo pelos descritores (listas abaixo de cada prioridade), em vez de grupos por nota.");
  if (advanced.length > 0 && (critical.length > 0 || developing.length > 0))
    nextSteps.push(
      `Aproveitar ${advanced.length === 1 ? "o aluno" : "os alunos"} com melhor desempenho (${listNames(advanced.slice(0, 4).map((s) => s.name))}) como ${advanced.length === 1 ? "monitor" : "monitores"} nas atividades em grupo, com desafios de aprofundamento.`,
    );
  if (absent > 0)
    nextSteps.push(`Aplicar a avaliação a quem ficou sem cartão: ${listNames(summary.missing.slice(0, 8))}${absent > 8 ? ` e mais ${absent - 8}` : ""}.`);
  if (summary.applied > 0)
    nextSteps.push("Reaplicar itens dos mesmos descritores em uma avaliação curta, daqui a 3 a 4 semanas, para medir o avanço.");

  return {
    title: `Devolutiva pedagógica · ${subject}`,
    subtitle: `${assessment.title || "Avaliação"} · Turma ${assessment.className} · ${formatDate(assessment.date)}`,
    summary,
    overview,
    priorities,
    strengths,
    groups: { critical, developing, advanced },
    questionsToRevisit,
    nextSteps,
    untagged: assessment.questions.filter((q) => q.key !== null && q.descriptorCodes.length === 0).map((q) => q.number),
  };
}
