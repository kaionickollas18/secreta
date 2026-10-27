import type { ReactNode } from "react";
import type { EventKind } from "../../types/calendar";
import {
  BooksIcon,
  ClipboardIcon,
  FlagIcon,
  FolderIcon,
  HourglassIcon,
  NotebookIcon,
  SunIcon,
} from "../ui/Icons";

interface KindStyle {
  icon: ReactNode;
  /**
   * Cor pastel que preenche o quadro do dia (e o quadrinho do ícone). Vazio nas duas entregas:
   * elas são dias comuns, marcados só pela pasta colorida.
   */
  fill: string;
  /** Cor do ícone e do nome sobre o fundo do tema (mais escura no claro, pastel no escuro). */
  text: string;
  /** Contorno do item no detalhe do dia. */
  edge: string;
  /** Cor do ícone dentro de um dia preenchido por outro evento (as pastas mantêm a cor). */
  onFill?: string;
}

/**
 * Aparência de cada tipo de evento. Feriado preenche em vermelho pastel, recesso em amarelo
 * pastel e os quatro eventos pedagógicos e administrativos em verde pastel (distinguem-se
 * pelo ícone). O nome do tipo sempre acompanha a cor em texto.
 */
export const KIND_STYLES: Record<EventKind, KindStyle> = {
  holiday: { icon: <FlagIcon />, fill: "bg-red-300", text: "text-red-700 dark:text-red-300", edge: "border-red-300/60 dark:border-red-300/40" },
  recess: { icon: <SunIcon />, fill: "bg-yellow-200", text: "text-yellow-800 dark:text-yellow-200", edge: "border-yellow-400/60 dark:border-yellow-200/40" },
  planning: { icon: <ClipboardIcon />, fill: "bg-emerald-200", text: "text-emerald-700 dark:text-emerald-200", edge: "border-emerald-400/60 dark:border-emerald-200/40" },
  meeting: { icon: <NotebookIcon />, fill: "bg-emerald-200", text: "text-emerald-700 dark:text-emerald-200", edge: "border-emerald-400/60 dark:border-emerald-200/40" },
  training: { icon: <BooksIcon />, fill: "bg-emerald-200", text: "text-emerald-700 dark:text-emerald-200", edge: "border-emerald-400/60 dark:border-emerald-200/40" },
  council: { icon: <HourglassIcon />, fill: "bg-emerald-200", text: "text-emerald-700 dark:text-emerald-200", edge: "border-emerald-400/60 dark:border-emerald-200/40" },
  semec: { icon: <FolderIcon />, fill: "", text: "text-orange-700 dark:text-orange-400", edge: "border-orange-400/40", onFill: "text-orange-700" },
  grades: { icon: <FolderIcon />, fill: "", text: "text-pink-700 dark:text-pink-400", edge: "border-pink-400/40", onFill: "text-pink-700" },
};

/** Texto escuro usado sobre os preenchimentos pastel. */
export const ON_FILL = "text-slate-900";

/** Se o dia tem vários eventos, vale a cor do primeiro desta ordem. */
const FILL_ORDER: readonly EventKind[] = ["holiday", "recess", "planning", "meeting", "training", "council"];

/** Cor que preenche o dia, dados os tipos de evento que caem nele ("" = sem preenchimento). */
export function dayFill(kinds: EventKind[]): string {
  const winner = FILL_ORDER.find((kind) => kinds.includes(kind));
  return winner ? KIND_STYLES[winner].fill : "";
}

interface KindIconProps {
  kind: EventKind;
  /** Tamanho do ícone (classes de altura e largura). */
  size?: string;
  /** Sobre um preenchimento pastel o ícone fica escuro; fora dele, na cor do tipo. */
  onFill?: boolean;
}

/** Ícone decorativo do tipo de evento. */
export function KindIcon({ kind, size = "h-[18px] w-[18px]", onFill = false }: KindIconProps) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 ${size} ${
        onFill ? (KIND_STYLES[kind].onFill ?? ON_FILL) : KIND_STYLES[kind].text
      } [&>svg]:h-full [&>svg]:w-full`}
    >
      {KIND_STYLES[kind].icon}
    </span>
  );
}

/** Quadrinho preenchido com a cor do tipo e o ícone dentro (legenda, detalhe do dia, formulário). */
export function KindChip({ kind, className = "h-7 w-7" }: { kind: EventKind; className?: string }) {
  const { fill } = KIND_STYLES[kind];
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-md ${fill || "bg-raised"} ${className}`}
    >
      <KindIcon kind={kind} size="h-[64%] w-[64%]" onFill={fill !== ""} />
    </span>
  );
}
