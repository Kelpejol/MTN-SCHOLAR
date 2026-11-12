import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "dark" | "link";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 focus-visible:ring-brand-600/40",
  dark: "bg-ink text-white shadow-sm hover:bg-zinc-800 active:bg-black focus-visible:ring-zinc-900/30",
  secondary:
    "bg-white text-ink border border-zinc-300 shadow-xs hover:bg-zinc-50 hover:border-zinc-400 focus-visible:ring-zinc-900/15",
  ghost: "text-zinc-700 hover:bg-zinc-100 hover:text-ink focus-visible:ring-zinc-900/15",
  danger:
    "bg-white text-brand-700 border border-brand-200 hover:bg-brand-50 hover:border-brand-300 focus-visible:ring-brand-600/30",
  link: "text-brand-600 hover:text-brand-700 underline-offset-4 hover:underline px-0 h-auto",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm gap-1.5 rounded-lg",
  md: "h-11 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-5 text-base gap-2 rounded-xl",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
};

export const buttonClasses = (variant: Variant = "primary", size: Size = "md", className?: string) =>
  cn(
    "inline-flex items-center justify-center font-semibold whitespace-nowrap transition-colors select-none",
    "focus-visible:outline-none focus-visible:ring-4 disabled:pointer-events-none disabled:opacity-50",
    variant !== "link" && sizes[size],
    variant === "link" && "text-sm font-medium",
    variants[variant],
    className,
  );

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, disabled, className, children, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses(variant, size, className)}
      {...props}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  );
});
