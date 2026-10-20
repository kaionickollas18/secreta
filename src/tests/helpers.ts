import type { Profile } from "../types/auth";
import type { Member } from "../types/directory";
import type { Task } from "../types/task";

let counter = 0;

export function makeTask(overrides: Partial<Task> = {}): Task {
  counter += 1;
  return {
    id: `task-${counter}`,
    title: `Tarefa ${counter}`,
    status: "todo",
    priority: "medium",
    assignees: [],
    completionRequested: false,
    position: counter,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makeMember(overrides: Partial<Member> & Pick<Member, "id" | "fullName">): Member {
  return {
    role: "assistant",
    schoolId: "school-1",
    lastName: overrides.fullName.split(" ").pop() ?? "",
    email: `${overrides.id}@escola.com`,
    active: true,
    ...overrides,
  };
}

/** Equipe de exemplo: a secretária Rita Lopes e os auxiliares Ana Souza e Beto Dias. */
export const TEAM: Member[] = [
  makeMember({ id: "sec", fullName: "Rita Lopes", role: "secretary" }),
  makeMember({ id: "ana", fullName: "Ana Souza" }),
  makeMember({ id: "beto", fullName: "Beto Dias" }),
];

export const SECRETARY: Profile = {
  id: "sec",
  role: "secretary",
  schoolId: "school-1",
  fullName: "Rita Lopes",
  lastName: "Lopes",
};

export const ASSISTANT: Profile = {
  id: "ana",
  role: "assistant",
  schoolId: "school-1",
  fullName: "Ana Souza",
  lastName: "Souza",
};

export const TEACHER: Profile = {
  id: "caio",
  role: "teacher",
  schoolId: "school-1",
  fullName: "Caio Mendes",
  lastName: "Mendes",
};
