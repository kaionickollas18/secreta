import { useState } from "react";
import { assigneeColor } from "../../utils/assignees";

interface AvatarProps {
  /** Id da pessoa: define a cor quando não há foto. */
  id: string;
  /** Nome exibido: a inicial aparece quando não há foto. */
  name: string;
  /** Endereço da foto de perfil. */
  url?: string;
  /** Tamanho e tipografia do círculo (ex.: "h-10 w-10 text-sm"). */
  className?: string;
}

/**
 * Círculo com a foto da pessoa ou, sem foto (ou se ela não carregar), a inicial sobre a cor
 * dela. É decorativo: o nome sempre aparece em texto ao lado.
 */
export function Avatar({ id, name, url, className = "h-10 w-10 text-sm" }: AvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showPhoto = Boolean(url) && failedUrl !== url;

  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold ${className} ${
        showPhoto ? "bg-raised" : assigneeColor(id).avatar
      }`}
    >
      {showPhoto ? (
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
          onError={() => setFailedUrl(url ?? null)}
        />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </span>
  );
}
