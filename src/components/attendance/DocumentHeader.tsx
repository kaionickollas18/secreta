import type { SchoolIdentity } from "../../types/school";
import { formatDay } from "../../utils/attendance";
import { formatCep } from "../../utils/schoolIdentity";

interface DocumentHeaderProps {
  identity: SchoolIdentity;
  title: string;
  /** Data de emissão (YYYY-MM-DD). */
  issuedOn: string;
}

/** Cabeçalho dos documentos oficiais em PDF: logo e identificação da escola, título e emissão. */
export function DocumentHeader({ identity, title, issuedOn }: DocumentHeaderProps) {
  // Duas linhas sob o nome: a identificação legal e, abaixo, onde a escola fica.
  const legal = [identity.inep && `INEP: ${identity.inep}`, identity.decree].filter(Boolean).join(" · ");
  const place = [identity.address, identity.cep && `CEP: ${formatCep(identity.cep)}`].filter(Boolean).join(" · ");

  return (
    <header className="doc-card doc-header">
      {identity.logoUrl && <img src={identity.logoUrl} alt="" className="doc-logo" />}
      <div className="doc-school">
        <p className="doc-school-name">{identity.officialName || "Escola"}</p>
        {legal && <p className="doc-muted">{legal}</p>}
        {place && <p className="doc-muted">{place}</p>}
      </div>
      <div className="doc-title-block">
        <span className="doc-pill doc-pill-accent">Documento oficial</span>
        <h1 className="doc-title">{title}</h1>
        <p className="doc-muted">Emitido em {formatDay(issuedOn)}</p>
      </div>
    </header>
  );
}
