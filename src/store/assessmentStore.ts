import { create } from "zustand";
import type { AnswerSheet, Assessment } from "../types/assessment";
import { deleteAssessment, deleteSheet, fetchAssessments, saveAssessment, saveSheet } from "./assessmentApi";

type Status = "idle" | "loading" | "ready" | "error";

/** Gravação do gabarito em edição: na tela já mudou; aqui está o andamento no banco. */
export type DraftStatus = "idle" | "pending" | "saving" | "saved" | "error";

interface AssessmentState {
  status: Status;
  schoolId: string | null;
  assessments: Assessment[];
  sheets: AnswerSheet[];
  draftStatus: DraftStatus;
  draftError: string | null;
  load: (schoolId: string) => Promise<void>;
  /** Cria ou atualiza já. Devolve a mensagem de erro, ou `null`. */
  save: (assessment: Assessment) => Promise<string | null>;
  /**
   * Edição contínua (cada tecla do gabarito): a tela muda na hora e o banco recebe só a última
   * versão, um instante depois de parar de editar.
   */
  saveDraft: (assessment: Assessment) => void;
  /** Envia já o que estiver esperando (ao sair da página ou trocar de aba). */
  flushDraft: () => Promise<void>;
  remove: (assessmentId: string) => Promise<string | null>;
  saveSheet: (sheet: AnswerSheet) => Promise<string | null>;
  removeSheet: (sheetId: string) => Promise<string | null>;
}

const NO_SCHOOL = "Sessão sem escola. Entre de novo.";
/** Espera depois da última mudança antes de gravar o gabarito. */
export const DRAFT_DELAY_MS = 600;

let draftTimer: ReturnType<typeof setTimeout> | null = null;
let draftPending: Assessment | null = null;

const replace = (list: Assessment[], item: Assessment) => [...list.filter((a) => a.id !== item.id), item];

export const useAssessmentStore = create<AssessmentState>((set, get) => ({
  status: "idle",
  schoolId: null,
  assessments: [],
  sheets: [],
  draftStatus: "idle",
  draftError: null,

  load: async (schoolId) => {
    set({ status: "loading", schoolId });
    const result = await fetchAssessments(schoolId);
    if (result.error !== null) return set({ status: "error" });
    set({ status: "ready", assessments: result.data.assessments, sheets: result.data.sheets });
  },

  save: async (assessment) => {
    const { schoolId } = get();
    if (!schoolId) return NO_SCHOOL;
    // Uma gravação imediata vence a edição que estava esperando para a mesma avaliação.
    if (draftPending?.id === assessment.id) {
      if (draftTimer) clearTimeout(draftTimer);
      draftTimer = null;
      draftPending = null;
    }
    const result = await saveAssessment(schoolId, assessment);
    if (result.error !== null) return result.error;
    set((s) => ({ assessments: replace(s.assessments, result.data) }));
    return null;
  },

  saveDraft: (assessment) => {
    set((s) => ({ assessments: replace(s.assessments, assessment), draftStatus: "pending", draftError: null }));
    // Outra avaliação esperando: vai já, para não ser trocada pela nova.
    if (draftPending && draftPending.id !== assessment.id) void get().flushDraft();
    draftPending = assessment;
    if (draftTimer) clearTimeout(draftTimer);
    draftTimer = setTimeout(() => void get().flushDraft(), DRAFT_DELAY_MS);
  },

  flushDraft: async () => {
    if (draftTimer) clearTimeout(draftTimer);
    draftTimer = null;
    const pending = draftPending;
    draftPending = null;
    const { schoolId } = get();
    if (!pending || !schoolId) return;
    set({ draftStatus: "saving" });
    const result = await saveAssessment(schoolId, pending);
    // Se a pessoa continuou editando, a versão da tela é mais nova: não volta para a gravada.
    if (draftPending) return;
    if (result.error !== null) set({ draftStatus: "error", draftError: result.error });
    else set({ draftStatus: "saved", draftError: null });
  },

  remove: async (assessmentId) => {
    const { schoolId } = get();
    if (!schoolId) return NO_SCHOOL;
    if (draftPending?.id === assessmentId) {
      if (draftTimer) clearTimeout(draftTimer);
      draftTimer = null;
      draftPending = null;
    }
    const error = await deleteAssessment(schoolId, assessmentId);
    if (error) return error;
    set((s) => ({
      assessments: s.assessments.filter((a) => a.id !== assessmentId),
      sheets: s.sheets.filter((sheet) => sheet.assessmentId !== assessmentId),
    }));
    return null;
  },

  saveSheet: async (sheet) => {
    const { schoolId } = get();
    if (!schoolId) return NO_SCHOOL;
    // O cartão é corrigido contra o gabarito: garante que a última edição dele já está no banco.
    await get().flushDraft();
    const result = await saveSheet(schoolId, sheet);
    if (result.error !== null) return result.error;
    set((s) => ({
      sheets: [
        ...s.sheets.filter(
          (other) => other.id !== sheet.id && !(other.assessmentId === sheet.assessmentId && other.slot === sheet.slot),
        ),
        result.data,
      ],
    }));
    return null;
  },

  removeSheet: async (sheetId) => {
    const { schoolId } = get();
    if (!schoolId) return NO_SCHOOL;
    const error = await deleteSheet(schoolId, sheetId);
    if (error) return error;
    set((s) => ({ sheets: s.sheets.filter((sheet) => sheet.id !== sheetId) }));
    return null;
  },
}));

/** Cartões de uma avaliação. */
export const sheetsOf = (sheets: readonly AnswerSheet[], assessmentId: string): AnswerSheet[] =>
  sheets.filter((s) => s.assessmentId === assessmentId);
