export function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
        active
          ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-200"
          : "border-line bg-raised/60 text-muted"
      }`}
    >
      {active ? "Ativo" : "Desativado"}
    </span>
  );
}
