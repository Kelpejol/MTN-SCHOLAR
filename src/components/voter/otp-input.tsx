"use client";

import { forwardRef, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  length?: number;
  invalid?: boolean;
  disabled?: boolean;
  describedBy?: string;
};

/**
 * One real <input> (so paste, SMS/email autofill and screen readers just work) rendered
 * as individual digit boxes.
 */
export const OtpInput = forwardRef<HTMLInputElement, Props>(function OtpInput(
  { value, onChange, onComplete, length = 6, invalid, disabled, describedBy },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const digits = value.split("");
  const activeIndex = Math.min(value.length, length - 1);

  return (
    <div className={cn("relative", invalid && "animate-shake")}>
      <div className="grid grid-cols-6 gap-2 sm:gap-2.5" aria-hidden>
        {Array.from({ length }).map((_, i) => {
          const filled = i < digits.length;
          const isActive = focused && i === activeIndex && !disabled;
          return (
            <div
              key={i}
              className={cn(
                "grid h-14 place-items-center rounded-xl border bg-white font-mono text-2xl font-semibold tabular-nums transition-all sm:h-16",
                invalid ? "border-brand-500 text-brand-700" : filled ? "border-zinc-400" : "border-zinc-300",
                isActive && !invalid && "border-ink ring-4 ring-zinc-900/10",
                disabled && "bg-zinc-50 text-zinc-400",
              )}
            >
              {digits[i] ?? (isActive ? <span className="h-7 w-0.5 animate-pulse bg-ink" /> : "")}
            </div>
          );
        })}
      </div>
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d*"
        maxLength={length}
        value={value}
        disabled={disabled}
        aria-label={`${length}-digit code`}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          const next = e.target.value.replace(/\D/g, "").slice(0, length);
          onChange(next);
          if (next.length === length) onComplete?.(next);
        }}
        className="absolute inset-0 h-full w-full cursor-text bg-transparent text-transparent caret-transparent opacity-0 outline-none selection:bg-transparent"
      />
    </div>
  );
});
