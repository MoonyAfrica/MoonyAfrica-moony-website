import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE = "moony_control_center";

export type AdminPermission =
  | "*"
  | "site.read" | "site.write"
  | "content.read" | "content.write"
  | "crm.read" | "crm.write"
  | "appointments.read" | "appointments.write"
  | "marketing.read" | "marketing.write"
  | "support.read" | "support.write"
  | "analytics.read"
  | "seo.read" | "seo.write"
  | "settings.read" | "settings.write"
  | "team.manage"
  | "audit.read";

export type AdminSession = {
  sub: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
  exp: number;
  legacy?: boolean;
  mfa?: boolean;
};

function envPassword() { return process.env.ADMIN_CONTROL_CENTER_PASSWORD ?? ""; }
function envSecret() { return process.env.ADMIN_CONTROL_CENTER_SECRET ?? ""; }

export function adminSessionMaxAgeSeconds() {
  const raw = Number(process.env.CONTROL_CENTER_SESSION_HOURS ?? "4");
  const hours = Number.isFinite(raw) ? Math.min(12, Math.max(1, raw)) : 4;
  return Math.round(hours * 60 * 60);
}

export function isGlobalMfaRequired() {
  return String(process.env.CONTROL_CENTER_REQUIRE_MFA ?? "").toLowerCase() === "true";
}

export function isAdminAuthConfigured() {
  return Boolean(envSecret() && (envPassword() || (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)));
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function signature(payload: string) {
  const secret = envSecret();
  if (!secret) return "";
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createAdminSessionToken(input: Omit<AdminSession, "exp"> & { exp?: number }) {
  if (!envSecret()) return null;
  const session: AdminSession = { ...input, exp: input.exp ?? Math.floor(Date.now() / 1000) + adminSessionMaxAgeSeconds() };
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function verifyAdminSessionToken(token: string): AdminSession | null {
  const [payload, actualSignature] = token.split(".");
  if (!payload || !actualSignature) return null;
  const expectedSignature = signature(payload);
  if (!expectedSignature || !safeEqual(actualSignature, expectedSignature)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AdminSession;
    if (!session?.sub || !session?.role || !Array.isArray(session.permissions) || !session.exp) return null;
    if (session.exp <= Math.floor(Date.now() / 1000)) return null;
    return session;
  } catch {
    return null;
  }
}

export function validateAdminPassword(candidate: string) {
  const expected = envPassword();
  if (!expected || !candidate) return false;
  return safeEqual(candidate, expected);
}

export function hashAdminPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyAdminPassword(password: string, encoded: string) {
  const [algorithm, salt, expected] = encoded.split("$");
  if (algorithm !== "scrypt" || !salt || !expected || !password) return false;
  try {
    const actual = scryptSync(password, salt, 64).toString("hex");
    return safeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function hashMfaCode(challengeId: string, code: string) {
  const secret = envSecret();
  if (!secret) return "";
  return createHmac("sha256", secret).update(`mfa:${challengeId}:${code}`).digest("base64url");
}

export function verifyMfaCode(challengeId: string, code: string, expectedHash: string) {
  const actual = hashMfaCode(challengeId, code);
  return Boolean(actual && expectedHash && safeEqual(actual, expectedHash));
}

export function hashPasswordResetToken(challengeId: string, token: string) {
  const secret = envSecret();
  if (!secret) return "";
  return createHmac("sha256", secret).update(`password-reset:${challengeId}:${token}`).digest("base64url");
}

export function verifyPasswordResetToken(challengeId: string, token: string, expectedHash: string) {
  const actual = hashPasswordResetToken(challengeId, token);
  return Boolean(actual && expectedHash && safeEqual(actual, expectedHash));
}

function readCookie(header: string | null, name: string) {
  if (!header) return "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return "";
}

export function getAdminSession(request: Request) {
  const token = readCookie(request.headers.get("cookie"), ADMIN_COOKIE);
  return token ? verifyAdminSessionToken(token) : null;
}

export function isAdminRequest(request: Request) { return Boolean(getAdminSession(request)); }

export function hasAdminPermission(session: AdminSession | null, permission?: AdminPermission) {
  if (!session) return false;
  if (!permission) return true;
  return session.permissions.includes("*") || session.permissions.includes(permission);
}

export function legacyFounderSession(): Omit<AdminSession, "exp"> {
  return {
    sub: "legacy-founder",
    email: process.env.ADMIN_CONTROL_CENTER_EMAIL ?? "founder@moonyafrica.com",
    name: "MOONY Founder",
    role: "founder",
    permissions: ["*"],
    legacy: true,
    mfa: false,
  };
}
