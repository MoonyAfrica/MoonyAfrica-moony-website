"use client";

import { FormEvent, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { MoonyLogo } from "@/components/moony-logo";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Connexion impossible.");
      window.location.href = "/admin";
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Connexion impossible.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_left,#f2d9c7,transparent_35%),linear-gradient(135deg,#fbf7f2,#f5e9df)] px-5 text-[#4b271d]">
      <section className="w-full max-w-md rounded-[30px] border border-[#5b2f22]/10 bg-white/85 p-8 shadow-[0_28px_100px_rgba(74,35,23,.12)] backdrop-blur-xl sm:p-10">
        <MoonyLogo compact />
        <div className="mt-10 grid h-12 w-12 place-items-center rounded-2xl bg-[#f1ddd0] text-[#813617]"><LockKeyhole size={22} /></div>
        <h1 className="moony-serif mt-5 text-4xl">Control Center</h1>
        <p className="mt-2 text-sm leading-6 text-[#5b2f22]/55">Connectez-vous à l’espace privé de gestion du site MOONY Africa.</p>
        <form onSubmit={submit} className="mt-7">
          <label className="block text-xs font-semibold">Mot de passe administrateur</label>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" className="mt-2 w-full rounded-xl border border-[#5b2f22]/12 bg-[#fffdfa] px-4 py-3.5 outline-none focus:border-[#9d4c27]/60" placeholder="••••••••••••" />
          {message ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{message}</p> : null}
          <button disabled={loading || !password} className="mt-5 w-full rounded-full bg-[#7e3518] px-5 py-3.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{loading ? "Connexion…" : "Se connecter"}</button>
        </form>
        <p className="mt-6 text-[11px] leading-5 text-[#5b2f22]/40">La session est conservée dans un cookie HTTP-only. Le mot de passe n’est jamais envoyé au navigateur après authentification.</p>
      </section>
    </main>
  );
}
