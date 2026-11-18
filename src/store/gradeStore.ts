import { create } from "zustand";
import type { GradeRow, Term } from "../types/grade";
import type { GradeData } from "../utils/grades";
import { fetchGradeData, fetchStudentGrades, fetchTermGrades } from "./gradeApi";

const EMPTY: GradeData = { classrooms: [], subjects: [], students: [], imports: [] };

type Status = "idle" | "loading" | "ready" | "error";

interface GradeState {
  /** Turmas, disciplinas, alunos e envios do ano. */
  data: GradeData;
  status: Status;
  schoolYear: number | null;
  /** Notas já carregadas, por bimestre. */
  terms: Partial<Record<Term, GradeRow[]>>;
  termStatus: Partial<Record<Term, Status>>;
  /** Carrega o ano (de novo quando `force`, depois de um envio; aí as notas também recarregam). */
  load: (schoolId: string, schoolYear: number, force?: boolean) => Promise<void>;
  loadTerm: (schoolId: string, term: Term) => Promise<void>;
  /** Notas de um aluno nos quatro bimestres (boletim), por id. */
  students: Record<string, GradeRow[] | "loading" | "error">;
  loadStudent: (schoolId: string, studentId: string) => Promise<void>;
}

export const useGradeStore = create<GradeState>((set, get) => ({
  data: EMPTY,
  status: "idle",
  schoolYear: null,
  terms: {},
  termStatus: {},
  students: {},

  load: async (schoolId, schoolYear, force = false) => {
    const { status, schoolYear: loaded } = get();
    if (!force && (status === "loading" || (status === "ready" && loaded === schoolYear))) return;
    set({ status: "loading", schoolYear, ...(force || loaded !== schoolYear ? { terms: {}, termStatus: {}, students: {} } : {}) });
    const result = await fetchGradeData(schoolId, schoolYear);
    if (result.error !== null) return set({ status: "error" });
    set({ status: "ready", data: result.data });
  },

  loadTerm: async (schoolId, term) => {
    const { schoolYear, termStatus } = get();
    if (schoolYear === null || termStatus[term] === "loading" || termStatus[term] === "ready") return;
    set((state) => ({ termStatus: { ...state.termStatus, [term]: "loading" } }));
    const result = await fetchTermGrades(schoolId, schoolYear, term);
    // Outro ano foi carregado no meio do caminho: descarta.
    if (get().schoolYear !== schoolYear) return;
    if (result.error !== null) {
      set((state) => ({ termStatus: { ...state.termStatus, [term]: "error" } }));
      return;
    }
    set((state) => ({
      terms: { ...state.terms, [term]: result.data },
      termStatus: { ...state.termStatus, [term]: "ready" },
    }));
  },

  loadStudent: async (schoolId, studentId) => {
    const current = get().students[studentId];
    if (current === "loading" || Array.isArray(current)) return;
    set((state) => ({ students: { ...state.students, [studentId]: "loading" } }));
    const result = await fetchStudentGrades(schoolId, studentId);
    set((state) => ({ students: { ...state.students, [studentId]: result.error !== null ? "error" : result.data } }));
  },
}));
