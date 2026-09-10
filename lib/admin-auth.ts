import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE = "moony_control_center";

function envPassword() {
  return process.env.ADMIN_CONTROL_CENTER_PASSWORD ?? "";
}

function envSecret() {
  return process.env.ADMIN_CONTROL_CENTER_SECRET ?? "";
}

export function isAdminAuthConfigured() {
  return Boolean(envPassword() && envSecret());
}

export function createAdminSessionToken() {
  const password = envPassword();
  const secret = envSecret();
  if (!password || !secret) return null;
  return createHmac("sha256", secret).update(`moony-control-center:${password}`).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function validateAdminPassword(candidate: string) {
  const expected = envPassword();
  if (!expected || !candidate) return false;
  return safeEqual(candidate, expected);
}

function readCookie(header: string | null, name: string) {
  if (!header) return "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return "";
}

export function isAdminRequest(request: Request) {
  const expected = createAdminSessionToken();
  if (!expected) return false;
  const actual = readCookie(request.headers.get("cookie"), ADMIN_COOKIE);
  return Boolean(actual && safeEqual(actual, expected));
}
