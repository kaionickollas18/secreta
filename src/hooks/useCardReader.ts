import { useCallback, useState } from "react";
import type { Assessment, SheetSource } from "../types/assessment";
import { createId } from "../utils/id";
import { imageFileToCards, isPdf, pdfPages, type CardImage } from "../utils/omr/imageSource";
import { readAnswerCard, type CardReading } from "../utils/omr/omrReader";
import { pendingFromReading, type PendingSheet } from "../utils/sheetReview";

export interface ReadProgress {
  /** Ex.: "Página 3 de 12". */
  label: string;
  done: number;
  total: number;
}

export interface ReadOutcome {
  pending: PendingSheet[];
  /** O que não pôde ser lido, para a pessoa saber o que refazer. */
  failures: string[];
}

/** Deixa a tela respirar entre um cartão e outro (a leitura roda na thread principal). */
const breathe = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Lê uma imagem candidata e transforma em cartão pendente, se for desta avaliação. */
export function readCandidate(
  image: CardImage,
  assessment: Assessment,
  source: SheetSource,
): { pending: PendingSheet } | { reading: Exclude<CardReading, { status: "read" }> } {
  const reading = readAnswerCard(image.gray, (code) => (code === assessment.code ? assessment : undefined));
  if (reading.status !== "read") return { reading };
  return {
    pending: pendingFromReading(reading, {
      id: createId(),
      label: image.label,
      source,
      image: { src: image.preview, width: image.gray.width, height: image.gray.height },
    }),
  };
}

/** Lê fotos e PDFs de cartões, um por vez, mostrando o andamento. */
export function useCardReader(assessment: Assessment | null) {
  const [progress, setProgress] = useState<ReadProgress | null>(null);

  const readFiles = useCallback(
    async (files: readonly File[]): Promise<ReadOutcome> => {
      const outcome: ReadOutcome = { pending: [], failures: [] };
      if (!assessment) return outcome;
      try {
        for (const [index, file] of files.entries()) {
          setProgress({ label: file.name, done: index, total: files.length });
          await breathe();
          if (isPdf(file)) {
            for await (const page of pdfPages(file)) {
              setProgress({ label: `${file.name}: página ${page.page} de ${page.pages}`, done: index, total: files.length });
              let found = 0;
              for (const candidate of page.candidates) {
                await breathe();
                const result = readCandidate(candidate, assessment, "pdf");
                if ("pending" in result) {
                  outcome.pending.push(result.pending);
                  found += 1;
                } else if (result.reading.status !== "no-card") {
                  outcome.failures.push(`${candidate.label}: ${result.reading.message}`);
                  found += 1;
                }
              }
              if (found === 0) outcome.failures.push(`${file.name}, página ${page.page}: nenhum cartão encontrado.`);
            }
            continue;
          }
          // Foto: primeiro a imagem inteira; se não achar cartão e for uma folha em pé, as metades.
          const [whole, ...halves] = await imageFileToCards(file);
          if (!whole) continue;
          const first = readCandidate(whole, assessment, "image");
          if ("pending" in first) {
            outcome.pending.push(first.pending);
            continue;
          }
          let found = false;
          for (const half of halves) {
            await breathe();
            const result = readCandidate(half, assessment, "image");
            if ("pending" in result) {
              outcome.pending.push(result.pending);
              found = true;
            }
          }
          if (!found) outcome.failures.push(`${file.name}: ${first.reading.message}`);
        }
      } catch (error) {
        outcome.failures.push(error instanceof Error ? error.message : "Não foi possível ler o arquivo.");
      } finally {
        setProgress(null);
      }
      return outcome;
    },
    [assessment],
  );

  return { progress, readFiles };
}
