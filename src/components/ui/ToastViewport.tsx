import { useEffect } from "react";
import { useToastStore, type Toast } from "../../store/toastStore";
import { Button } from "./Button";
import { AlertIcon, CheckIcon, InfoIcon } from "./Icons";

/** O tipo do aviso aparece por ícone e cor, nunca só pela cor. */
const TONE: Record<Toast["tone"], { edge: string; icon: string; Icon: () => JSX.Element }> = {
  success: { edge: "border-prio-low/50", icon: "text-prio-low", Icon: CheckIcon },
  error: { edge: "border-prio-urgent/70", icon: "text-prio-urgent", Icon: AlertIcon },
  info: { edge: "border-accent/60", icon: "text-accent-light", Icon: InfoIcon },
};

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss);

  useEffect(() => {
    const timer = window.setTimeout(() => dismiss(toast.id), toast.onAction ? 7000 : 4000);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.onAction, dismiss]);

  const { edge, icon, Icon } = TONE[toast.tone];

  return (
    <div
      className={`flex animate-toast-in items-center gap-3 glass rounded-2xl bg-raised px-4 py-3 text-sm text-white shadow-card ${edge}`}
    >
      <span className={`shrink-0 ${icon}`}>
        <Icon />
      </span>
      <span className="flex-1">{toast.message}</span>
      {toast.actionLabel && toast.onAction && (
        <Button
          variant="ghost"
          className="min-h-[32px] !text-white underline hover:!bg-white/10"
          onClick={() => {
            toast.onAction?.();
            dismiss(toast.id);
          }}
        >
          {toast.actionLabel}
        </Button>
      )}
    </div>
  );
}

export function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-20 z-50 md:bottom-4 mx-auto flex w-full max-w-md flex-col gap-2 px-4 [&>*]:pointer-events-auto"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
