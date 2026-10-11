import { assigneeColor } from "../../utils/assignees";

interface AssigneeBadgeProps {
  /** Id do perfil (define a cor). */
  id: string;
  /** Sobrenome exibido. */
  name: string;
}

/** Etiqueta "@Sobrenome" colorida que destaca quem deve fazer a tarefa. */
export function AssigneeBadge({ id, name }: AssigneeBadgeProps) {
  const { badge, avatar } = assigneeColor(id);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2.5 text-xs font-semibold ${badge}`}
      title={`Responsável: ${name}`}
    >
      <span
        aria-hidden="true"
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${avatar}`}
      >
        {name.charAt(0)}
      </span>
      @{name}
    </span>
  );
}
