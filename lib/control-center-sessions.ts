import { randomUUID } from "node:crypto";
import { adminSessionMaxAgeSeconds } from "@/lib/admin-auth";

export function deviceLabelFromRequest(request: Request) {
  const ua = request.headers.get("user-agent") ?? "";
  const browser = /Edg\//i.test(ua) ? "Edge" : /Chrome\//i.test(ua) ? "Chrome" : /Firefox\//i.test(ua) ? "Firefox" : /Safari\//i.test(ua) ? "Safari" : "Navigateur";
  const os = /iPhone|iPad|iPod/i.test(ua) ? "iOS" : /Android/i.test(ua) ? "Android" : /Mac OS X|Macintosh/i.test(ua) ? "macOS" : /Windows/i.test(ua) ? "Windows" : /Linux/i.test(ua) ? "Linux" : "Appareil";
  return `${browser} · ${os}`;
}

export async function createStoredAdminSession(supabase: any, userId: string, request: Request, mustChangePassword = false) {
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + adminSessionMaxAgeSeconds() * 1000).toISOString();
  const { error } = await supabase.from("control_center_sessions").insert({
    id,
    user_id: userId,
    expires_at: expiresAt,
    device_label: deviceLabelFromRequest(request),
    metadata: { must_change_password: mustChangePassword },
  });
  if (error) return null;
  return { id, expiresAt };
}

export async function revokeUserSessions(supabase: any, userId: string, exceptSessionId?: string | null) {
  const now = new Date().toISOString();
  let query = supabase.from("control_center_sessions").update({ revoked_at: now }).eq("user_id", userId).is("revoked_at", null);
  if (exceptSessionId) query = query.neq("id", exceptSessionId);
  const { error } = await query;
  return !error;
}

export async function revokeSession(supabase: any, sessionId: string, userId?: string) {
  const now = new Date().toISOString();
  let query = supabase.from("control_center_sessions").update({ revoked_at: now }).eq("id", sessionId).is("revoked_at", null);
  if (userId) query = query.eq("user_id", userId);
  const { error } = await query;
  return !error;
}
