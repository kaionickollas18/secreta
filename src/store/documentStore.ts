import { create } from "zustand";
import type { DeliveryInput, DocumentInput, OfficialDocument } from "../types/officialDocument";
import type { ApiResult } from "./taskApi";
import { fetchDocuments, removeDocument, saveDocument, setDelivery } from "./documentApi";

interface DocumentState {
  documents: OfficialDocument[];
  status: "idle" | "loading" | "ready" | "error";
  load: () => Promise<void>;
  /** Cada ação devolve a mensagem de erro, ou `null` se deu certo. */
  save: (schoolId: string, input: DocumentInput, id?: string) => Promise<string | null>;
  deliver: (id: string, delivery: DeliveryInput) => Promise<string | null>;
  undoDelivery: (id: string) => Promise<string | null>;
  remove: (id: string) => Promise<string | null>;
}

export const useDocumentStore = create<DocumentState>((set) => {
  /** Troca (ou acrescenta) o documento devolvido pelo banco. */
  function apply(result: ApiResult<OfficialDocument>): string | null {
    if (result.error !== null) return result.error;
    const saved = result.data;
    set((s) => ({ documents: [...s.documents.filter((d) => d.id !== saved.id), saved] }));
    return null;
  }

  return {
    documents: [],
    status: "idle",

    load: async () => {
      set((s) => ({ status: s.status === "ready" ? "ready" : "loading" }));
      const result = await fetchDocuments();
      if (result.error !== null) return set({ status: "error" });
      set({ status: "ready", documents: result.data });
    },

    save: async (schoolId, input, id) => apply(await saveDocument(schoolId, input, id)),
    deliver: async (id, delivery) => apply(await setDelivery(id, delivery)),
    undoDelivery: async (id) => apply(await setDelivery(id, null)),

    remove: async (id) => {
      const error = await removeDocument(id);
      if (!error) set((s) => ({ documents: s.documents.filter((d) => d.id !== id) }));
      return error;
    },
  };
});
