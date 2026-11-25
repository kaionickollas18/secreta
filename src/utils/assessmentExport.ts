import { MATRIX_LABELS, SUBJECT_LABELS } from "../constants/descriptors";
import type { AnswerSheet, Assessment } from "../types/assessment";
import { descriptorStats, LEVEL_LABELS, questionStats, studentResults } from "./assessmentAnalytics";
import { choicesFor, descriptorLookup, scoreSheet } from "./assessments";

/*
 * Planilhas dos resultados (CSV no padrão do Excel em português: separador ";", vírgula decimal,
 * UTF-8 com BOM). Servem para a escola cruzar e montar os próprios relatórios.
 */

type Cell = string | number | null;

const SEP = ";";

function cell(value: Cell): string {
  if (value === null) return "";
  if (typeof value === "number") return String(Math.round(value * 10) / 10).replace(".", ",");
  // Texto digitado (nomes, títulos) não pode virar fórmula na planilha (= + - @).
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(rows: Cell[][]): string {
  return "﻿" + rows.map((row) => row.map(cell).join(SEP)).join("\r\n") + "\r\n";
}

const percent = (value: number): number => value * 100;

/** Uma linha por aluno: nota, situação, descritores não consolidados e a resposta de cada questão. */
export function studentsSheet(assessment: Assessment, sheets: readonly AnswerSheet[]): Cell[][] {
  const results = [...studentResults(assessment, sheets)].sort((a, b) => a.sheet.slot - b.sheet.slot);
  const header: Cell[] = ["Nº", "Aluno", "Acertos", "Questões válidas", "% de acerto", "Em branco", "Situação", "Descritores não consolidados"];
  for (const q of assessment.questions) header.push(`Q${q.number}`, `Q${q.number} certa`);
  const rows: Cell[][] = [header];
  for (const r of results) {
    const row: Cell[] = [
      r.sheet.slot,
      r.sheet.studentName,
      r.score.correct,
      r.score.scored,
      percent(r.score.percent),
      r.score.outcomes.filter((o) => o === "blank").length,
      r.critical ? "Situação crítica" : r.score.percent >= 0.7 ? "Consolidado" : "Em desenvolvimento",
      r.gaps.map((g) => g.descriptor.code).join(", "),
    ];
    r.score.outcomes.forEach((outcome, i) => {
      row.push(r.sheet.answers[i] ?? "", outcome === "annulled" ? "" : outcome === "right" ? 1 : 0);
    });
    rows.push(row);
  }
  return rows;
}

/** Uma linha por descritor: desempenho da turma e quem não consolidou. */
export function descriptorsSheet(assessment: Assessment, sheets: readonly AnswerSheet[]): Cell[][] {
  // Na planilha, os nomes seguem a ordem da lista (nº), não a nota.
  const students = [...studentResults(assessment, sheets)].sort((a, b) => a.sheet.slot - b.sheet.slot);
  const rows: Cell[][] = [["Código", "Descritor", "Tema", "Questões", "Respostas certas", "Respostas", "% de acerto", "Nível", "Alunos que não consolidaram"]];
  for (const d of descriptorStats(assessment, sheets)) {
    rows.push([
      d.descriptor.code,
      d.descriptor.text,
      d.descriptor.topic,
      d.questions.join(", "),
      d.correct,
      d.attempts,
      percent(d.hitRate),
      LEVEL_LABELS[d.level],
      students
        .filter((s) => s.gaps.some((g) => g.descriptor.code === d.descriptor.code))
        .map((s) => s.sheet.studentName)
        .join(", "),
    ]);
  }
  return rows;
}

/** Uma linha por questão: gabarito, acerto e quantos marcaram cada alternativa. */
export function questionsSheet(assessment: Assessment, sheets: readonly AnswerSheet[]): Cell[][] {
  const choices = choicesFor(assessment.alternatives);
  const stats = new Map(questionStats(assessment, sheets).map((q) => [q.number, q]));
  const rows: Cell[][] = [["Questão", "Gabarito", "Descritores", "% de acerto", "% de erro", "Em branco", ...choices.map((c) => `Marcaram ${c}`), "Distrator mais marcado"]];
  for (const q of assessment.questions) {
    const stat = stats.get(q.number);
    rows.push([
      q.number,
      q.key ?? "Anulada",
      q.descriptorCodes.join(", "),
      stat ? percent(stat.hitRate) : null,
      stat ? percent(stat.errorRate) : null,
      stat?.blank ?? null,
      ...choices.map((c) => stat?.counts[c] ?? null),
      stat?.topDistractor?.choice ?? "",
    ]);
  }
  return rows;
}

/**
 * Dados completos, uma linha por resposta (aluno × questão): o formato para tabela dinâmica e
 * para juntar várias avaliações numa planilha só.
 */
export function responsesSheet(assessment: Assessment, sheets: readonly AnswerSheet[]): Cell[][] {
  const lookup = descriptorLookup(assessment);
  const rows: Cell[][] = [
    ["Avaliação", "Data", "Turma", "Ano", "Disciplina", "Matriz", "Nº", "Aluno", "Questão", "Gabarito", "Resposta", "Resultado", "Acertou", "Descritor", "Descrição do descritor", "Tema"],
  ];
  for (const sheet of [...sheets].sort((a, b) => a.slot - b.slot)) {
    const score = scoreSheet(assessment, sheet);
    assessment.questions.forEach((q, i) => {
      const outcome = score.outcomes[i];
      const result = outcome === "right" ? "Certo" : outcome === "wrong" ? "Errado" : outcome === "blank" ? "Em branco" : "Anulada";
      const codes = q.descriptorCodes.length ? q.descriptorCodes : [""];
      // Questão com dois descritores vira duas linhas (uma por descritor), para somar por descritor.
      for (const code of codes) {
        const d = code ? lookup.get(code) : undefined;
        rows.push([
          assessment.title,
          assessment.date,
          assessment.className,
          assessment.grade,
          SUBJECT_LABELS[assessment.subject],
          MATRIX_LABELS[assessment.matrix],
          sheet.slot,
          sheet.studentName,
          q.number,
          q.key ?? "",
          sheet.answers[i] ?? "",
          result,
          outcome === "annulled" ? null : outcome === "right" ? 1 : 0,
          code,
          d?.text ?? "",
          d?.topic ?? "",
        ]);
      }
    });
  }
  return rows;
}

/** Nome de arquivo seguro: "Simulado 1 - 8 ano A - alunos.csv". */
export function exportFileName(assessment: Assessment, part: string): string {
  const base = `${assessment.title || "Avaliação"} - ${assessment.className || "turma"} - ${part}`;
  return `${base.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim()}.csv`;
}
