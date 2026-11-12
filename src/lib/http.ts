import "server-only";
import { headers } from "next/headers";
import { getAdmin, type CurrentAdmin } from "./auth";

export async function getRequestMeta(): Promise<{ ip: string | null; userAgent: string | null }> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || h.get("x-real-ip")?.trim() || null;
  const userAgent = h.get("user-agent")?.slice(0, 400) ?? null;
  return { ip, userAgent };
}

export function jsonError(message: string, status = 400, extra?: Record<string, unknown>) {
  return Response.json({ ok: false, error: message, ...extra }, { status });
}

/** Rejects cross-site browser requests to state-changing API routes. */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // non-browser clients; the admin cookie is still required
  try {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/**
 * Guard for admin route handlers. Returns the admin, or a Response to return immediately.
 */
export async function guardAdminApi(
  request: Request,
): Promise<{ admin: CurrentAdmin; response?: never } | { admin?: never; response: Response }> {
  if (request.method !== "GET" && !isSameOrigin(request)) {
    return { response: jsonError("Cross-site request blocked.", 403) };
  }
  const admin = await getAdmin();
  if (!admin) return { response: jsonError("Your session has expired. Please sign in again.", 401) };
  return { admin };
}
