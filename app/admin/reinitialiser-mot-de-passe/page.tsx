"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { MoonyLogo } from "@/components/moony-logo";

export default function ResetPasswordPage() {
  const [id, setId] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setId(params.get("id") ?? "");
    setToken(params.get("token") ?? "");
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (password.length < 12) { setError("Le mot de passe doit contenir au moins 12 caractères."); return; }
    if (password !== confirmPassword) { setError("Les deux mots de passe ne correspondent pas."); return; }
    setLoading(true);
    const response = await fetch("/api/admin/password-reset/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, token, password }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) setError(data.error ?? "Impossible de réinitialiser le mot de passe.");
    else setDone(true);
    setLoading(false);
  }

  const validLink = Boolean(id && token);

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_left,#f2d9c7,transparent_35%),linear-gradient(135deg,#fbf7f2,#f5e9df)] px-5 text-[#4b271d]">
      <section className="w-full max-w-md rounded-[30px] border border-[#5b2f22]/10 bg-white/90 p-8 shadow-[0_28px_100px_rgba(74,35,23,.12)] backdrop-blur-xl sm:p-10">
        <MoonyLogo compact />
        <div className="mt-10 grid h-12 w-12 place-items-center rounded-2xl bg-[#f1ddd0] text-[#813617]">{done?<CheckCircle2 size={22}/>:<KeyRound size={22}/>}</div>
        <h1 className="moony-serif mt-5 text-4xl">{done?"Mot de passe modifié":"Nouveau mot de passe"}</h1>
        {done ? (
          <>
            <p className="mt-3 text-sm leading-6 text-[#5b2f22]/55">Votre mot de passe a été réinitialisé. Connectez-vous à nouveau ; si la double authentification est activée, un nouveau code vous sera demandé.</p>
            <Link href="/admin/login" className="mt-7 inline-flex w-full items-center justify-center rounded-full bg-[#7e3518] px-5 py-3.5 text-sm font-semibold text-white">Retour à la connexion</Link>
          </>
        ) : validLink ? (
          <form onSubmit={submit} className="mt-7 space-y-4">
            <p className="text-sm leading-6 text-[#5b2f22]/55">Choisissez un mot de passe d’au moins 12 caractères. Le lien de récupération ne peut être utilisé qu’une seule fois.</p>
            <label className="block text-xs font-semibold">Nouveau mot de passe<input required minLength={12} type="password" autoComplete="new-password" value={password} onChange={event=>setPassword(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#5b2f22]/12 bg-[#fffdfa] px-4 py-3.5 text-sm outline-none focus:border-[#9d4c27]/60"/></label>
            <label className="block text-xs font-semibold">Confirmer le mot de passe<input required minLength={12} type="password" autoComplete="new-password" value={confirmPassword} onChange={event=>setConfirmPassword(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#5b2f22]/12 bg-[#fffdfa] px-4 py-3.5 text-sm outline-none focus:border-[#9d4c27]/60"/></label>
            {error?<p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs leading-5 text-red-800">{error}</p>:null}
            <button disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#7e3518] px-5 py-3.5 text-sm font-semibold text-white disabled:opacity-50">{loading?<Loader2 className="animate-spin" size={15}/>:<KeyRound size={15}/>}Enregistrer le nouveau mot de passe</button>
          </form>
        ) : (
          <>
            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">Ce lien est incomplet ou invalide. Demandez un nouveau lien de récupération.</p>
            <Link href="/admin/mot-de-passe-oublie" className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-[#7e3518] px-5 py-3.5 text-sm font-semibold text-white">Demander un nouveau lien</Link>
          </>
        )}
      </section>
    </main>
  );
}
