/**
 * Executa `run` só quando a página está de fato na frente do usuário.
 *
 * O navegador pode preparar uma página em segundo plano antes do clique (pré-carregamento).
 * Efeitos que registram algo que a pessoa "viu" (como marcar mensagens como lidas) não podem
 * acontecer nesse momento: esperam a página ser mostrada. Devolve como cancelar a espera.
 */
export function whenPageShown(run: () => void): () => void {
  const doc = document as Document & { prerendering?: boolean };
  if (!doc.prerendering) {
    run();
    return () => {};
  }
  document.addEventListener("prerenderingchange", run, { once: true });
  return () => document.removeEventListener("prerenderingchange", run);
}
