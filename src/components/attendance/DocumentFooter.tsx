import { formatDay } from "../../utils/attendance";

interface DocumentFooterProps {
  /** Nome de quem emite. */
  issuedBy: string;
  /** Data de emissão (YYYY-MM-DD). */
  issuedOn: string;
}

/** Rodapé dos documentos oficiais em PDF: quem emitiu, a regra das situações e a assinatura. */
export function DocumentFooter({ issuedBy, issuedOn }: DocumentFooterProps) {
  return (
    <footer className="doc-footer">
      <div className="doc-footer-text">
        <p>
          Emitido em {formatDay(issuedOn)} por {issuedBy}.
        </p>
        <p className="doc-muted">
          A frequência considera os dias de chamada registrados para a turma no período. Situação: Regular, até 15% de
          faltas; Atenção, de 15% a 25%; Crítico, mais de 25%.
        </p>
      </div>
      <div className="doc-signature">
        <p>Secretaria Escolar</p>
        <p className="doc-muted">Assinatura e carimbo</p>
      </div>
    </footer>
  );
}
