import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-line px-4 py-8 text-center">
      <p className="text-sm font-semibold">{title}</p>
      {description && <p className="max-w-[38ch] text-sm leading-relaxed text-muted">{description}</p>}
      {action}
    </div>
  );
}
