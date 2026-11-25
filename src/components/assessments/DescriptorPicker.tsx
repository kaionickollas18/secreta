import type { Descriptor } from "../../types/assessment";
import { CloseIcon } from "../ui/Icons";

interface DescriptorPickerProps {
  /** Nº da questão (para os rótulos acessíveis). */
  question: number;
  options: readonly Descriptor[];
  selected: readonly string[];
  onChange: (codes: string[]) => void;
}

/** Descritores de uma questão: selos removíveis + lista para acrescentar. */
export function DescriptorPicker({ question, options, selected, onChange }: DescriptorPickerProps) {
  const byCode = new Map(options.map((d) => [d.code, d]));
  const available = options.filter((d) => !selected.includes(d.code));

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      {selected.map((code) => {
        const descriptor = byCode.get(code);
        return (
          <span
            key={code}
            title={descriptor?.text ?? "Descritor fora da matriz escolhida"}
            className={`inline-flex min-h-[32px] items-center gap-1 rounded-full pl-2.5 pr-1 text-xs font-semibold ${
              descriptor ? "bg-accent-soft text-accent-light" : "bg-prio-medium-tint text-prio-medium"
            }`}
          >
            {code}
            <button
              type="button"
              onClick={() => onChange(selected.filter((c) => c !== code))}
              aria-label={`Tirar o descritor ${code} da questão ${question}`}
              className="inline-flex h-6 w-6 items-center justify-center rounded-full hover:bg-raised"
            >
              <CloseIcon />
            </button>
          </span>
        );
      })}
      {available.length > 0 && (
        <select
          aria-label={`Acrescentar descritor à questão ${question}`}
          value=""
          onChange={(e) => {
            if (e.target.value) onChange([...selected, e.target.value]);
          }}
          className="glass min-h-[36px] min-w-0 max-w-full flex-1 rounded-full px-2 text-xs sm:max-w-[16rem]"
        >
          <option value="">{selected.length ? "+ descritor" : "Escolher descritor…"}</option>
          {available.map((d) => (
            <option key={d.code} value={d.code}>
              {d.code} — {d.text.length > 90 ? `${d.text.slice(0, 88)}…` : d.text}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
