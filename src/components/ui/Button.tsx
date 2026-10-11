import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "depth";

/** Efeito 3D: borda inferior grossa que "afunda" ao clicar. */
const DEPTH =
  "border-b-4 active:translate-y-[3px] active:border-b-[1px] hover:brightness-110 transition-[transform,filter]";

const VARIANTS: Record<Variant, string> = {
  primary: `bg-gradient-to-r from-accent to-fuchsia-600 text-white shadow-glow border-b-fuchsia-900 ${DEPTH}`,
  depth: `bg-gradient-to-b from-raised to-surface text-accent-light border border-line border-b-[#0a0716] shadow-card hover:text-white ${DEPTH}`,
  secondary: "border border-line bg-raised/60 text-ink hover:bg-raised",
  ghost: "text-muted hover:bg-raised hover:text-ink",
  danger: "bg-rose-500 text-white hover:bg-rose-600",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

function buttonClasses(variant: Variant, className: string): string {
  return `inline-flex min-h-[40px] items-center justify-center gap-2 rounded-md px-3.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`;
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

export function IconButton({
  className = "",
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-md text-muted transition-colors hover:bg-raised hover:text-ink ${className}`}
      {...rest}
    />
  );
}
