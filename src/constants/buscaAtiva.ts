import formPage1 from "../assets/busca-ativa/formulario-alerta-1.webp";
import formPage2 from "../assets/busca-ativa/formulario-alerta-2.webp";
import letterhead13108980 from "../assets/busca-ativa/papel-timbrado-13108980.webp";

/** Páginas do Formulário de Alerta da Busca Ativa Escolar (versão de out/2025), usadas como fundo. */
export const ALERT_FORM_PAGES = [formPage1, formPage2] as const;

/**
 * Papel timbrado de cada escola, pelo código INEP. Escola sem papel timbrado aqui recebe um
 * cabeçalho montado com os "Dados da escola".
 */
const LETTERHEADS: Record<string, string> = {
  "13108980": letterhead13108980,
};

export function letterheadOf(inep: string): string | undefined {
  return LETTERHEADS[inep];
}

/** Imagens que precisam estar carregadas antes de imprimir o documento de busca ativa. */
export function buscaAtivaImages(inep: string): string[] {
  const letterhead = letterheadOf(inep);
  return letterhead ? [...ALERT_FORM_PAGES, letterhead] : [...ALERT_FORM_PAGES];
}
