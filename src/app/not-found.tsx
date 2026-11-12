import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/brand";
import { buttonClasses } from "@/components/ui/button";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="grid flex-1 place-items-center px-4 py-20 text-center">
        <div>
          <p className="text-sm font-semibold text-brand-600">404</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Page not found</h1>
          <p className="mt-2 text-zinc-600">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
          <Link href="/" className={buttonClasses("dark", "md", "mt-6")}>
            Go to the voting page
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
