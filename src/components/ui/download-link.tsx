import type { ReactNode } from "react";
import { buttonClasses } from "./button";

/** Plain anchor for file downloads (CSV exports). Client-side <Link> navigation doesn't apply to files. */
export function DownloadLink({
  href,
  children,
  variant = "secondary",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "dark";
}) {
  return (
    <a href={href} download className={buttonClasses(variant, "md")}>
      {children}
    </a>
  );
}
