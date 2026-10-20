import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { IconButton } from "../ui/Button";
import { SmileIcon } from "../ui/Icons";

/** Os mais usados numa secretaria. Os demais ficam no painel do sistema (Win + . ou o teclado do celular). */
export const QUICK_EMOJIS = [
  "😀", "😂", "😊", "😍", "🥰", "😉", "😎", "🤔",
  "😅", "😢", "😮", "😴", "🙏", "👍", "👎", "👏",
  "🙌", "💪", "👋", "🤝", "❤️", "💜", "🎉", "🎂",
  "✅", "❌", "⚠️", "❗", "❓", "⭐", "🔥", "💡",
  "📌", "📎", "📅", "📝", "📄", "📚", "☕", "🍰",
];

const GRID_STEPS: Partial<Record<string, number>> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 8, ArrowUp: -8 };

interface EmojiPickerProps {
  onPick: (emoji: string) => void;
  disabled?: boolean;
}

/** Botão que abre uma grade de emojis; escolher um coloca no texto, no lugar do cursor. */
export function EmojiPicker({ onPick, disabled = false }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora.
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    rootRef.current?.querySelector<HTMLButtonElement>("[data-emoji]")?.focus();
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      setOpen(false);
      rootRef.current?.querySelector<HTMLButtonElement>("[data-emoji-toggle]")?.focus();
      return;
    }
    // Setas andam pela grade (8 por linha).
    const step = GRID_STEPS[event.key];
    if (!step) return;
    const buttons = Array.from(rootRef.current?.querySelectorAll<HTMLButtonElement>("[data-emoji]") ?? []);
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = buttons[index + step];
    if (index === -1 || !next) return;
    event.preventDefault();
    next.focus();
  }

  return (
    <div ref={rootRef} className="relative" onKeyDown={handleKeyDown}>
      <IconButton
        data-emoji-toggle
        aria-label="Inserir emoji"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        disabled={disabled}
        className="!h-11 !w-11 shrink-0 disabled:opacity-50"
        onClick={() => setOpen((value) => !value)}
      >
        <SmileIcon />
      </IconButton>
      {open && (
        <div
          id={panelId}
          role="group"
          aria-label="Emojis"
          className="absolute bottom-full left-0 z-20 mb-2 w-[min(19rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-2 shadow-xl"
        >
          <div className="grid grid-cols-8 gap-0.5">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                data-emoji
                aria-label={`Emoji ${emoji}`}
                onClick={() => {
                  onPick(emoji);
                  setOpen(false);
                }}
                className="flex aspect-square items-center justify-center rounded-lg text-xl hover:bg-raised focus-visible:bg-raised"
              >
                {emoji}
              </button>
            ))}
          </div>
          <p className="mt-2 px-1 caption">
            Mais emojis: <kbd className="font-semibold">Win</kbd> + <kbd className="font-semibold">.</kbd> no
            Windows, ou o teclado do celular.
          </p>
        </div>
      )}
    </div>
  );
}
