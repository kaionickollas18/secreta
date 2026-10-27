import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "depth";

/*
 * Botões no padrão da Apple: cápsula, cor sólida e um leve "afundar" ao tocar.
 * Principal em azul; "depth" é o azul suave (ação de destaque que não é a principal).
 */
const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent-strong text-white hover:brightness-110",
  depth: "bg-accent-soft text-accent-light hover:bg-accent/20",
  secondary: "bg-raised/80 text-ink hover:bg-raised",
  ghost: "text-muted hover:bg-raised hover:text-ink",
  danger: "bg-[#D70015] text-white hover:brightness-110",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

function buttonClasses(variant: Variant, className: string): string {
  return `inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition-[background-color,color,filter,transform] duration-100 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 ${VARIANTS[variant]} ${className}`;
}

export function Button({ variant = "secondary", className = "", type = "button", ...rest }: ButtonProps) {
  return <button type={type} className={buttonClasses(variant, className)} {...rest} />;
}

interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: Variant;
}

/** Link com a aparência de um botão (navegação entre páginas). */
export function ButtonLink({ variant = "secondary", className = "", ...rest }: ButtonLinkProps) {
  return <a className={buttonClasses(variant, className)} {...rest} />;
}

/** Editar é verde e excluir é vermelho em todo o sistema (o rótulo acessível diz a ação). */
export const EDIT_BUTTON = "!text-prio-low hover:!bg-prio-low-tint";
export const DELETE_BUTTON = "!text-prio-urgent hover:!bg-prio-urgent-tint";

export function IconButton({
  className = "",
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-raised hover:text-ink ${className}`}
      {...rest}
    />
  );
}
