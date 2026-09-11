import { NextRequest, NextResponse } from "next/server";

const COOKIE = "moony_control_center";
const PUBLIC_ADMIN_PATHS = [
  "/admin/login",
  "/admin/acces-refuse",
  "/admin/mot-de-passe-oublie",
  "/admin/reinitialiser-mot-de-passe",
];
const PUBLIC_ADMIN_API_PATHS = [
  "/api/admin/session/mfa",
  "/api/admin/password-reset/request",
  "/api/admin/password-reset/confirm",
];

type EdgeSession = {
  sub?: string;
  role?: string;
  permissions?: string[];
  exp?: number;
  sid?: string;
  legacy?: boolean;
  mustChangePassword?: boolean;
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

function secure(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "same-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("Content-Security-Policy", "frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  return response;
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

async function storedSessionIsActive(session: EdgeSession) {
  if (session.legacy || !session.sid) return true;
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!baseUrl || !serviceKey) return true;

  try {
    const endpoint = new URL("/rest/v1/control_center_sessions", baseUrl);
    endpoint.searchParams.set("select", "id,user_id,expires_at,revoked_at");
    endpoint.searchParams.set("id", `eq.${session.sid}`);
    endpoint.searchParams.set("user_id", `eq.${session.sub}`);
    endpoint.searchParams.set("revoked_at", "is.null");
    endpoint.searchParams.set("limit", "1");
    const response = await fetch(endpoint, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      cache: "no-store",
    });
    if (!response.ok) return true;
    const rows = await response.json() as Array<{ expires_at?: string }>;
    if (!rows.length) return false;
    const expiresAt = rows[0]?.expires_at ? new Date(rows[0].expires_at).getTime() : 0;
    return expiresAt > Date.now();
  } catch {
    return true;
  }
}

function requiredPermissions(pathname: string): string[] | null {
  if (pathname === "/admin" || pathname.startsWith("/admin/mon-compte") || pathname.startsWith("/admin/activite")) return null;
  if (pathname.startsWith("/admin/equipe")) return ["team.manage"];
  if (pathname.startsWith("/admin/journal-activite")) return ["audit.read"];
  if (pathname.startsWith("/admin/crm") || pathname.startsWith("/admin/opportunites") || pathname.startsWith("/admin/propositions") || pathname.startsWith("/admin/onboarding") || pathname.startsWith("/admin/readiness") || pathname.startsWith("/admin/clients") || pathname.startsWith("/admin/scoring") || pathname.startsWith("/admin/previsions") || pathname.startsWith("/admin/playbooks")) return ["crm.read"];
  if (pathname.startsWith("/admin/rendez-vous")) return ["appointments.read"];
  if (pathname.startsWith("/admin/service-client")) return ["support.read"];
  if (pathname.startsWith("/admin/marketing") || pathname.startsWith("/admin/newsletters") || pathname.startsWith("/admin/popups")) return ["marketing.read"];
  if (pathname.startsWith("/admin/analytics")) return ["analytics.read"];
  if (pathname.startsWith("/admin/seo")) return ["seo.read"];
  if (pathname.startsWith("/admin/automatisations")) return ["settings.read"];
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

function isPublicPath(pathname: string, method: string) {
  if (PUBLIC_ADMIN_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) return true;
  if (PUBLIC_ADMIN_API_PATHS.includes(pathname)) return true;
  if (pathname === "/api/admin/session" && method !== "GET") return true;
  return false;
}

function unauthenticated(request: NextRequest, isApi: boolean, clearCookie = false) {
  if (isApi) {
    const response = NextResponse.json({ error: "Session administrateur requise ou expirée." }, { status: 401 });
    if (clearCookie) response.cookies.delete(COOKIE);
    return secure(response);
  }
  const url = request.nextUrl.clone();
  url.pathname = "/admin/login";
  url.search = "";
  url.searchParams.set("returnTo", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  const response = NextResponse.redirect(url);
  if (clearCookie) response.cookies.delete(COOKIE);
  return secure(response);
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isApi = pathname.startsWith("/api/admin/");
  if (isPublicPath(pathname, request.method)) return secure(NextResponse.next());

  const token = request.cookies.get(COOKIE)?.value ?? "";
  const session = token ? await verifySession(token) : null;
  if (!session) return unauthenticated(request, isApi, Boolean(token));

  const storedActive = await storedSessionIsActive(session);
  if (!storedActive) return unauthenticated(request, isApi, true);

  if (session.mustChangePassword) {
    const allowedPage = pathname.startsWith("/admin/mon-compte");
    const allowedApi = pathname === "/api/admin/account" || pathname.startsWith("/api/admin/account/sessions");
    if (!allowedPage && !allowedApi) {
      if (isApi) return secure(NextResponse.json({ error: "Vous devez choisir un mot de passe personnel avant de continuer.", mustChangePassword: true }, { status: 428 }));
      const url = request.nextUrl.clone();
      url.pathname = "/admin/mon-compte";
      url.search = "?security=change-password";
      return secure(NextResponse.redirect(url));
    }
  }

  if (!isApi && !hasAnyPermission(session, requiredPermissions(pathname))) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/acces-refuse";
    url.search = "";
    url.searchParams.set("from", pathname);
    return secure(NextResponse.redirect(url));
  }

  return secure(NextResponse.next());
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};