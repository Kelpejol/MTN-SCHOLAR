import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export const inputClasses = (invalid?: boolean, className?: string) =>
  cn(
    "block h-11 w-full min-w-0 max-w-full rounded-xl border bg-white px-3.5 text-[15px] text-ink placeholder:text-zinc-400",
    "transition-[border-color,box-shadow] outline-none",
    "focus:border-ink focus:ring-4 focus:ring-zinc-900/10",
    "disabled:bg-zinc-50 disabled:text-zinc-500 disabled:cursor-not-allowed",
    invalid
      ? "border-brand-500 focus:border-brand-600 focus:ring-brand-600/15"
      : "border-zinc-300 hover:border-zinc-400",
    className,
  );

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ className, invalid, ...props }, ref) {
    return <input ref={ref} aria-invalid={invalid || undefined} className={inputClasses(invalid, className)} {...props} />;
  },
);

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }
>(function Select({ className, invalid, children, ...props }, ref) {
  return (
    <div className="relative">
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={inputClasses(invalid, cn("appearance-none pr-10", className))}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
    </div>
  );
});

export function Label({
  htmlFor,
  children,
  optional,
  className,
}: {
  htmlFor?: string;
  children: ReactNode;
  optional?: boolean;
  className?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={cn("mb-1.5 flex items-baseline gap-2 text-sm font-medium text-ink", className)}>
      {children}
      {optional && <span className="text-xs font-normal text-zinc-400">Optional</span>}
    </label>
  );
}

export function FieldError({ id, children }: { id?: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-sm text-brand-700">
      {children}
    </p>
  );
}

export function FieldHint({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="mt-1.5 text-xs text-zinc-500">
      {children}
    </p>
  );
}
