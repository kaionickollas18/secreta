export function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
        active
          ? "border-prio-low/40 bg-prio-low-tint text-prio-low"
          : "border-line bg-raised/60 text-muted"
      }`}
    >
      {active ? "Ativo" : "Desativado"}
    </span>
  );
}
