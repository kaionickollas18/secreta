import { describe, expect, it } from "vitest";
import { chatHref, peerFromSearch } from "../utils/chat";
import {
  applyMention,
  encodeMentions,
  mentionsUser,
  mentionTrigger,
  parseMessage,
  suggestMentions,
  type MentionOption,
} from "../utils/mentions";
import { taskFromSearch, taskHref } from "../utils/tasks";

const SOUZA: MentionOption = { kind: "user", id: "ana", label: "Souza", hint: "Ana Souza" };
const SILVANA: MentionOption = { kind: "user", id: "sil", label: "Silvana", hint: "Silvana Reis" };
const BOLETO: MentionOption = { kind: "task", id: "t1", label: "Pagar boleto", hint: "A Fazer" };
const OPTIONS = [SOUZA, SILVANA, BOLETO];

describe("marcações: digitação", () => {
  it("percebe @ e # no começo ou depois de espaço, mas não no meio de um e-mail", () => {
    expect(mentionTrigger("Oi @So", 6)).toEqual({ sigil: "@", query: "So", start: 3 });
    expect(mentionTrigger("#", 1)).toEqual({ sigil: "#", query: "", start: 0 });
    expect(mentionTrigger("ana@escola", 10)).toBeNull();
    expect(mentionTrigger("@Souza já", 9)).toBeNull();
  });

  it("sugere só o tipo certo, sem acento, e o que começa igual vem antes", () => {
    const at = (query: string) => suggestMentions(OPTIONS, { sigil: "@", query, start: 0 });
    expect(at("s").map((o) => o.id)).toEqual(["ana", "sil"]);
    expect(at("reis").map((o) => o.id)).toEqual(["sil"]);
    expect(suggestMentions(OPTIONS, { sigil: "#", query: "BOLE", start: 0 })).toEqual([BOLETO]);
  });

  it("troca o que foi digitado pela marcação e põe o cursor depois dela", () => {
    const trigger = mentionTrigger("Fala @so tudo bem", 8);
    expect(trigger).not.toBeNull();
    if (!trigger) return;
    expect(applyMention("Fala @so tudo bem", trigger, 8, SOUZA)).toEqual({ text: "Fala @Souza tudo bem", caret: 12 });
  });
});

describe("marcações: envio e leitura", () => {
  it("codifica só as marcações escolhidas e inteiras", () => {
    const text = "@Souza e @Silvana, vejam #Pagar boleto hoje";
    expect(encodeMentions(text, [SOUZA, BOLETO])).toBe(
      "@[Souza](u:ana) e @Silvana, vejam #[Pagar boleto](t:t1) hoje",
    );
    // "@Silva" não pega o começo de "@Silvana".
    const silva: MentionOption = { kind: "user", id: "x", label: "Silva" };
    expect(encodeMentions("@Silvana", [silva])).toBe("@Silvana");
    // Apagou a marcação antes de enviar: nada muda.
    expect(encodeMentions("sem marcação", [SOUZA])).toBe("sem marcação");
  });

  it("um rótulo com colchetes não quebra o código", () => {
    const odd: MentionOption = { kind: "task", id: "t2", label: "Ata [rascunho]" };
    const encoded = encodeMentions("#Ata rascunho", [odd]);
    expect(parseMessage(encoded)).toEqual([{ kind: "task", id: "t2", label: "Ata rascunho" }]);
  });

  it("separa texto e marcações, e sabe quem foi marcado", () => {
    const body = "Oi @[Souza](u:ana), veja #[Pagar boleto](t:t1).";
    expect(parseMessage(body)).toEqual([
      { kind: "text", text: "Oi " },
      { kind: "user", id: "ana", label: "Souza" },
      { kind: "text", text: ", veja " },
      { kind: "task", id: "t1", label: "Pagar boleto" },
      { kind: "text", text: "." },
    ]);
    expect(mentionsUser(body, "ana")).toBe(true);
    expect(mentionsUser(body, "beto")).toBe(false);
    expect(parseMessage("texto comum 😀")).toEqual([{ kind: "text", text: "texto comum 😀" }]);
  });
});

describe("endereços de conversa e de tarefa", () => {
  it("monta e lê o colega e a tarefa do endereço, recusando valores estranhos", () => {
    expect(chatHref("ana")).toBe("mensagens.html?com=ana");
    expect(peerFromSearch("?com=ana")).toBe("ana");
    expect(peerFromSearch("?com=<script>")).toBeNull();
    expect(taskHref("t1")).toBe("index.html?tarefa=t1");
    expect(taskFromSearch("?tarefa=t1")).toBe("t1");
    expect(taskFromSearch("")).toBeNull();
  });
});
