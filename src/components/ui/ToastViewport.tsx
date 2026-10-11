import { useEffect } from "react";
import { useToastStore, type Toast } from "../../store/toastStore";
import { Button } from "./Button";

const TONE: Record<Toast["tone"], string> = {
  success: "border-l-prio-low",
  error: "border-l-prio-urgent",
  info: "border-l-accent",
};

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss);

  useEffect(() => {
    const timer = window.setTimeout(() => dismiss(toast.id), toast.onAction ? 7000 : 4000);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.onAction, dismiss]);

  return (
    <div
      className={`flex items-center gap-3 glass rounded-2xl border-l-4 bg-raised px-4 py-3 text-sm text-white shadow-card ${TONE[toast.tone]}`}
    >
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
