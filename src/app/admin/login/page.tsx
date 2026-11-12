import type { Metadata } from "next";
import { BrandLockup } from "@/components/brand";
/* eslint-disable @next/next/no-img-element */
import { AdminLoginForm } from "@/components/admin/login-form";
import { BRAND } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin sign in" };

export default async function AdminLoginPage({ searchParams }: PageProps<"/admin/login">) {
  const { next } = await searchParams;
  return (
    <main className="grid min-h-dvh flex-1 lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-ink p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-brand-600" />
        <div className="flex items-center gap-4">
          <img src={BRAND.mtnLogo} alt="MTN" className="h-12 w-auto rounded-lg" />
          <span className="rounded-lg bg-white px-3 py-1.5">
            <img src={BRAND.dragnetLogo} alt="Dragnet" className="h-11 w-auto" />
          </span>
        </div>
        <div>
          <h1 className="text-4xl leading-tight font-bold tracking-tight text-balance">{BRAND.awardName.replace("-", "\u2011")}</h1>
          <p className="mt-4 max-w-md text-zinc-400">
            Manage scholars and institutions, send reminders, and follow results by ceremony region.
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-brand-300 uppercase">Admin console</p>
          <p className="mt-2 text-xs text-zinc-500">
            {BRAND.programName} · Powered by {BRAND.poweredByFull}
          </p>
        </div>
      </div>
      <div className="flex flex-col justify-center px-4 py-12 sm:px-10">
        <div className="mx-auto w-full max-w-sm">
          <BrandLockup />
          <h2 className="mt-10 text-2xl font-bold tracking-tight">Sign in</h2>
          <p className="mt-1.5 text-sm text-zinc-600">Administrators only.</p>
          <AdminLoginForm next={typeof next === "string" ? next : ""} />
        </div>
      </div>
    </main>
  );
}
