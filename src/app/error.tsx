"use client";

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid flex-1 place-items-center px-4 py-24 text-center">
      <div className="max-w-md">
        <p className="text-sm font-semibold text-brand-600">Something went wrong</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">We hit an unexpected problem</h1>
        <p className="mt-2 text-zinc-600">
          Please try again. If this keeps happening, wait a minute and refresh the page.
        </p>
        {error.digest && <p className="mt-3 font-mono text-xs text-zinc-400">Ref: {error.digest}</p>}
        <Button variant="dark" className="mt-6" onClick={reset}>
          <RotateCcw className="size-4" /> Try again
        </Button>
      </div>
    </main>
  );
}
