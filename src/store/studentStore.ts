import { create } from "zustand";
import type { StudentRecord } from "../types/student";
import { fetchStudents } from "./studentApi";

interface StudentState {
  students: StudentRecord[];
  status: "idle" | "loading" | "ready" | "error";
  /** Carrega o cadastro da escola (uma vez; chame de novo para tentar outra vez após erro). */
  load: (schoolId: string) => Promise<void>;
}

export const useStudentStore = create<StudentState>((set, get) => ({
  students: [],
  status: "idle",

  load: async (schoolId) => {
    if (get().status === "loading" || get().status === "ready") return;
    set({ status: "loading" });
    const result = await fetchStudents(schoolId);
    if (result.error !== null) return set({ status: "error" });
    set({ status: "ready", students: result.data });
  },
}));
