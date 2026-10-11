interface SkeletonProps {
  /** Tamanho e forma do bloco (ex.: "h-24 rounded-2xl"). */
  className?: string;
}

/**
 * Bloco no lugar de um conteúdo que ainda está chegando. É decorativo: quem usa leitor de
 * tela recebe o aviso de carregamento por um texto `role="status"` ao lado.
 */
export function Skeleton({ className = "" }: SkeletonProps) {
  return <div aria-hidden="true" className={`animate-pulse bg-raised/60 ${className}`} />;
}
