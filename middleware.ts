import { NextRequest, NextResponse } from "next/server";

const COOKIE = "moony_control_center";

type EdgeSession = {
  sub?: string;
  role?: string;
  permissions?: string[];
  exp?: number;
};

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(padded);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

function decodePayload(value: string) {
  const bytes = decodeBase64Url(value);
  return new TextDecoder().decode(bytes);
}

async function verifySession(token: string): Promise<EdgeSession | null> {
  const secret = process.env.ADMIN_CONTROL_CENTER_SECRET ?? "";
  if (!secret) return null;
  const [payload, providedSignature] = token.split(".");
  if (!payload || !providedSignature) return null;

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const expected = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
    const provided = decodeBase64Url(providedSignature);
    if (expected.length !== provided.length) return null;
    let mismatch = 0;
    for (let index = 0; index < expected.length; index += 1) mismatch |= expected[index] ^ provided[index];
    if (mismatch !== 0) return null;

    const session = JSON.parse(decodePayload(payload)) as EdgeSession;
    if (!session.sub || !session.role || !Array.isArray(session.permissions) || !session.exp) return null;
    if (session.exp <= Math.floor(Date.now() / 1000)) return null;
    return session;
  } catch {
    return null;
  }
}

function requiredPermissions(pathname: string): string[] | null {
  if (pathname === "/admin" || pathname.startsWith("/admin/mon-compte")) return null;
  if (pathname.startsWith("/admin/equipe")) return ["team.manage"];
  if (pathname.startsWith("/admin/journal-activite")) return ["audit.read"];
  if (pathname.startsWith("/admin/crm")) return ["crm.read"];
  if (pathname.startsWith("/admin/rendez-vous")) return ["appointments.read"];
  if (pathname.startsWith("/admin/service-client")) return ["support.read"];
  if (pathname.startsWith("/admin/marketing") || pathname.startsWith("/admin/newsletters") || pathname.startsWith("/admin/popups")) return ["marketing.read"];
  if (pathname.startsWith("/admin/analytics")) return ["analytics.read"];
  if (pathname.startsWith("/admin/seo")) return ["seo.read"];
  if (pathname.startsWith("/admin/medias") || pathname.startsWith("/admin/ressources") || pathname.startsWith("/admin/articles") || pathname.startsWith("/admin/a-propos") || pathname.startsWith("/admin/temoignages") || pathname.startsWith("/admin/partenaires")) return ["content.read"];
  if (pathname.startsWith("/admin/site-design") || pathname.startsWith("/admin/navigation") || pathname.startsWith("/admin/pages") || pathname.startsWith("/admin/historique")) return ["site.read"];
  if (pathname.startsWith("/admin/parametres")) return ["settings.read", "site.read", "seo.read"];
  return null;
}

function hasAnyPermission(session: EdgeSession, permissions: string[] | null) {
  if (!permissions?.length) return true;
  const owned = session.permissions ?? [];
  return owned.includes("*") || permissions.some((permission) => owned.includes(permission));
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname === "/admin/login" || pathname.startsWith("/admin/acces-refuse")) return NextResponse.next();

  const token = request.cookies.get(COOKIE)?.value ?? "";
  const session = token ? await verifySession(token) : null;
  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    url.searchParams.set("returnTo", `${pathname}${request.nextUrl.search}`);
    const response = NextResponse.redirect(url);
    if (token) response.cookies.delete(COOKIE);
    return response;
  }

  if (!hasAnyPermission(session, requiredPermissions(pathname))) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/acces-refuse";
    url.search = "";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
