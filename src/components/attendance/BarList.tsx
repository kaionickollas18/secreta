interface BarItem {
  label: string;
  value: number;
  /** Texto exibido ao fim da barra. */
  display: string;
  /** Texto do tooltip nativo. */
  hint?: string;
}

interface BarListProps {
  items: BarItem[];
  /** Descrição acessível da lista. */
  label: string;
}

/** Barras horizontais finas, ordenadas pelo chamador. Uma única cor: o comprimento carrega o dado. */
export function BarList({ items, label }: BarListProps) {
  const max = Math.max(...items.map((i) => i.value), 0);
  return (
    <ul aria-label={label} className="space-y-2.5">
      {items.map((item) => (
        <li
          key={item.label}
          title={item.hint}
          className="group grid grid-cols-[4.5rem_1fr_auto] items-center gap-3 text-sm"
        >
          <span className="truncate">{item.label}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-canvas/80">
            <span
              className="block h-full rounded-full bg-gradient-to-r from-accent to-accent-light transition-[filter] group-hover:brightness-125"
              style={{ width: `${max === 0 ? 0 : (item.value / max) * 100}%` }}
            />
          </span>
          <span className="w-10 text-right tabular-nums text-muted">{item.display}</span>
        </li>
      ))}
    </ul>
  );
}
