/** `new`: item que acabou de aparecer · `moved`: item conhecido que mudou de estado. */
export type Arrival = "new" | "moved" | null;

/** Repetições da mesma observação dentro deste intervalo devolvem a mesma resposta. */
const REPEAT_MS = 1000;

/**
 * Descobre quais itens de uma lista merecem a animação de chegada.
 *
 * Antes de `prime()` (a primeira carga da tela) tudo é registrado em silêncio, para a
 * página não "piscar" inteira ao abrir. Depois disso, um id inédito é `new` e um id cujo
 * estado mudou (ex.: tarefa que trocou de coluna) é `moved`. Reaparecer com o mesmo estado
 * (ex.: ao limpar um filtro) não conta como chegada.
 */
export function createArrivalTracker(now: () => number = Date.now) {
  const seen = new Map<string, { state: string; arrival: Arrival; at: number }>();
  let primed = false;

  return {
    /** A partir daqui as mudanças passam a ser anunciadas. */
    prime() {
      primed = true;
    },
    /** Esquece tudo (troca de usuário, testes). */
    reset() {
      seen.clear();
      primed = false;
    },
    observe(id: string, state: string): Arrival {
      const previous = seen.get(id);
      const at = now();
      // O React pode renderizar duas vezes seguidas: a segunda leitura repete a primeira.
      if (previous && previous.state === state && at - previous.at < REPEAT_MS) {
        return previous.arrival;
      }
      let arrival: Arrival = null;
      if (primed) {
        if (!previous) arrival = "new";
        else if (previous.state !== state) arrival = "moved";
      }
      seen.set(id, { state, arrival, at });
      return arrival;
    },
  };
}

/** Tarefas do quadro: o estado observado é a coluna. */
export const taskArrivals = createArrivalTracker();
/** Mensagens do mural: só interessa se é nova. */
export const messageArrivals = createArrivalTracker();

/** O usuário pediu menos movimento no sistema operacional. */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
}
