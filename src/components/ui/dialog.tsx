"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** Prevent closing (Esc / backdrop / X) while something is in progress. */
  locked?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
};

const widths = { sm: "sm:max-w-md", md: "sm:max-w-lg", lg: "sm:max-w-2xl", xl: "sm:max-w-4xl" };

/** Accessible modal built on the native <dialog> element. Renders as a bottom sheet on phones. */
export function Dialog({ open, onClose, title, description, children, footer, locked, size = "md" }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const lockedRef = useRef(locked);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    lockedRef.current = locked;
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      if (!lockedRef.current) onCloseRef.current();
    };
    dialog.addEventListener("cancel", onCancel);
    return () => dialog.removeEventListener("cancel", onCancel);
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby="dialog-title"
      onClick={(e) => {
        if (e.target === ref.current && !locked) onClose();
      }}
      className={cn(
        "m-auto w-full max-w-[calc(100%-2rem)] overflow-visible bg-transparent p-0 text-ink backdrop:bg-transparent",
        "max-sm:mb-0 max-sm:max-w-full",
        widths[size],
      )}
    >
      <div
        className={cn(
          "flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5",
          "max-sm:max-h-[92dvh] max-sm:rounded-b-none",
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-100 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id="dialog-title" className="text-lg font-semibold tracking-tight">
              {title}
            </h2>
            {description && <div className="mt-1 text-sm text-zinc-500">{description}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={locked}
            className="-mr-2 grid size-9 shrink-0 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-ink disabled:opacity-40"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>
        {children && <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>}
        {footer && (
          <div className="flex flex-col-reverse gap-2 border-t border-zinc-100 bg-zinc-50/60 px-5 py-4 sm:flex-row sm:justify-end sm:px-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </dialog>
  );
}
