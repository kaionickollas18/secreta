import { describe, expect, it } from "vitest";
import { createArrivalTracker } from "../utils/arrivals";

/** Relógio controlado: cada observação acontece 2 s depois da anterior, salvo indicação. */
function setup() {
  let time = 0;
  const tracker = createArrivalTracker(() => time);
  return {
    tracker,
    later: (ms = 2000) => {
      time += ms;
    },
  };
}

describe("chegada de itens (animação do cartão que pousa)", () => {
  it("a primeira carga da tela não anima nada", () => {
    const { tracker } = setup();
    expect(tracker.observe("a", "todo")).toBeNull();
    expect(tracker.observe("b", "review")).toBeNull();
  });

  it("depois da carga, um item inédito é novo", () => {
    const { tracker, later } = setup();
    tracker.observe("a", "todo");
    tracker.prime();
    later();
    expect(tracker.observe("b", "todo")).toBe("new");
  });

  it("uma tarefa que muda de coluna chegou; reordenar ou reaparecer não conta", () => {
    const { tracker, later } = setup();
    tracker.observe("a", "review");
    tracker.prime();
    later();
    expect(tracker.observe("a", "done")).toBe("moved");
    later();
    // Mesmo estado de novo (ex.: o filtro escondeu e mostrou o cartão).
    expect(tracker.observe("a", "done")).toBeNull();
  });

  it("uma mudança feita antes da carga terminar fica registrada sem animar", () => {
    const { tracker, later } = setup();
    tracker.observe("a", "todo");
    later();
    expect(tracker.observe("a", "review")).toBeNull();
    tracker.prime();
    later();
    expect(tracker.observe("a", "review")).toBeNull();
  });

  it("renderizações repetidas em seguida recebem a mesma resposta", () => {
    const { tracker, later } = setup();
    tracker.prime();
    expect(tracker.observe("a", "todo")).toBe("new");
    later(50);
    expect(tracker.observe("a", "todo")).toBe("new");
    later(2000);
    expect(tracker.observe("a", "todo")).toBeNull();
  });

  it("reset volta ao estado inicial", () => {
    const { tracker, later } = setup();
    tracker.prime();
    tracker.observe("a", "todo");
    tracker.reset();
    later();
    expect(tracker.observe("a", "done")).toBeNull();
  });
});
