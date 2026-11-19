import { create } from "zustand";
import type { GradeRow, Term } from "../types/grade";
import type { GradeData } from "../utils/grades";
import {
  fetchClassGrades,
  fetchGradeData,
  fetchStudentGrades,
  removeReinforcement,
  saveReinforcement,
} from "./gradeApi";

const EMPTY: GradeData = {
  classrooms: [],
  subjects: [],
  students: [],
  imports: [],
  reinforcement: [],
};

type Status = "idle" | "loading" | "ready" | "error";

/** Notas carregadas sob demanda: a lista, ou o andamento da carga. */
export type Loaded = GradeRow[] | "loading" | "error";

/** Chave das notas de uma turma num bimestre. */
export const classKey = (classroomId: string, term: Term): string =>
  `${classroomId}:${term}`;

interface GradeState {
  /** Turmas, disciplinas, alunos e envios do ano (leve: é o que a página baixa ao abrir). */
  data: GradeData;
  status: Status;
  schoolYear: number | null;
  /** Notas de cada turma aberta, por `classKey`. */
  classes: Record<string, Loaded>;
  /** Notas de um aluno nos quatro bimestres (boletim), por id. */
  students: Record<string, Loaded>;
  /** Carrega o ano (de novo quando `force`, depois de um envio; aí as notas também recarregam). */
  load: (schoolId: string, schoolYear: number, force?: boolean) => Promise<void>;
  /** Notas de uma turma no bimestre (uma vez; `retry` tenta de novo depois de erro). */
  loadClass: (
    schoolId: string,
    classroomId: string,
    term: Term,
    retry?: boolean,
  ) => Promise<void>;
  loadStudent: (schoolId: string, studentId: string, retry?: boolean) => Promise<void>;
  /** Põe o aluno no reforço (ou troca o motivo). Devolve a mensagem de erro, ou `null`. */
  addToReinforcement: (
    schoolId: string,
    studentId: string,
    note: string,
  ) => Promise<string | null>;
  removeFromReinforcement: (studentId: string) => Promise<string | null>;
}

export const useGradeStore = create<GradeState>((set, get) => ({
  data: EMPTY,
  status: "idle",
  schoolYear: null,
  classes: {},
  students: {},

  load: async (schoolId, schoolYear, force = false) => {
    const { status, schoolYear: loaded } = get();
    if (!force && (status === "loading" || (status === "ready" && loaded === schoolYear)))
      return;
    set({
      status: "loading",
      schoolYear,
      ...(force || loaded !== schoolYear ? { classes: {}, students: {} } : {}),
    });
    const result = await fetchGradeData(schoolId, schoolYear);
    if (result.error !== null) return set({ status: "error" });
    set({ status: "ready", data: result.data });
  },

  loadClass: async (schoolId, classroomId, term, retry = false) => {
    const key = classKey(classroomId, term);
    const current = get().classes[key];
    if (
      current === "loading" ||
      Array.isArray(current) ||
      (current === "error" && !retry)
    )
      return;
    set((state) => ({ classes: { ...state.classes, [key]: "loading" } }));
    const result = await fetchClassGrades(schoolId, classroomId, term);
    set((state) => ({
      classes: { ...state.classes, [key]: result.error !== null ? "error" : result.data },
    }));
  },

  loadStudent: async (schoolId, studentId, retry = false) => {
    const current = get().students[studentId];
    if (
      current === "loading" ||
      Array.isArray(current) ||
      (current === "error" && !retry)
    )
      return;
    set((state) => ({ students: { ...state.students, [studentId]: "loading" } }));
    const result = await fetchStudentGrades(schoolId, studentId);
    set((state) => ({
      students: {
        ...state.students,
        [studentId]: result.error !== null ? "error" : result.data,
      },
    }));
  },

  addToReinforcement: async (schoolId, studentId, note) => {
    const result = await saveReinforcement(schoolId, studentId, note);
    if (result.error !== null) return result.error;
    const entry = result.data;
    set((state) => ({
      data: {
        ...state.data,
        reinforcement: [
          ...state.data.reinforcement.filter((item) => item.studentId !== studentId),
          entry,
        ],
      },
    }));
    return null;
  },

  removeFromReinforcement: async (studentId) => {
    const error = await removeReinforcement(studentId);
    if (error) return error;
    set((state) => ({
      data: {
        ...state.data,
        reinforcement: state.data.reinforcement.filter(
          (item) => item.studentId !== studentId,
        ),
      },
    }));
    return null;
  },
}));
