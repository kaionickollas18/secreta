interface LogoMarkProps {
  className?: string;
}

/**
 * Símbolo da marca: um S feito de cinco cartões (como os de um quadro kanban) e o ponto
 * amarelo do lembrete que acabou de chegar. Os cartões usam a cor do texto (`currentColor`).
 */
export function LogoMark({ className = "h-6 w-auto" }: LogoMarkProps) {
  return (
    <svg viewBox="0 0 134 182" className={className} fill="currentColor" aria-hidden="true" focusable="false">
      <rect width="98" height="33" rx="9" />
      <circle cx="120" cy="17" r="14" className="fill-pencil" />
      <rect y="42" width="32" height="24" rx="7" />
      <rect y="75" width="134" height="32" rx="9" />
      <rect x="102" y="116" width="32" height="24" rx="7" />
      <rect y="149" width="134" height="33" rx="9" />
    </svg>
  );
}

interface LogoProps {
  /** `horizontal`: símbolo ao lado do nome. `stacked`: símbolo em cima, com a frase da marca. */
  layout?: "horizontal" | "stacked";
  className?: string;
}

/** Símbolo + nome. É decorativo: quem usa fornece o texto acessível (ex.: um `sr-only`). */
export function Logo({ layout = "horizontal", className = "" }: LogoProps) {
  if (layout === "stacked") {
    return (
      <span aria-hidden="true" className={`flex flex-col items-center text-ink ${className}`}>
        <LogoMark className="h-16 w-auto" />
        <span className="mt-3 text-4xl font-bold leading-none tracking-tighter">secreta</span>
        <span className="mt-2 text-sm font-normal tracking-normal text-muted">
          a secretaria escolar, organizada.
        </span>
      </span>
    );
  }
  return (
    <span aria-hidden="true" className={`inline-flex items-center gap-2.5 text-ink ${className}`}>
      <LogoMark className="h-[1.15em] w-auto" />
      <span className="font-bold leading-none tracking-tighter">secreta</span>
    </span>
  );
}
