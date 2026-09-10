import { NextResponse } from "next/server";
import { ADMIN_COOKIE, createAdminSessionToken, isAdminAuthConfigured, isAdminRequest, validateAdminPassword } from "@/lib/admin-auth";

export async function GET(request: Request) {
  return NextResponse.json({ configured: isAdminAuthConfigured(), authenticated: isAdminRequest(request) });
}

export async function POST(request: Request) {
  if (!isAdminAuthConfigured()) {
    return NextResponse.json({ error: "L’authentification du Control Center n’est pas configurée." }, { status: 503 });
  }

  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  if (!validateAdminPassword(body.password ?? "")) {
    return NextResponse.json({ error: "Mot de passe incorrect." }, { status: 401 });
  }

  const token = createAdminSessionToken();
  if (!token) return NextResponse.json({ error: "Configuration incomplète." }, { status: 503 });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 10,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
