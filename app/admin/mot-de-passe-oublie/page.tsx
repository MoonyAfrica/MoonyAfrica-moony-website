"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowLeft, Loader2, Mail, Send } from "lucide-react";
import { MoonyLogo } from "@/components/moony-logo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true); setError(""); setMessage("");
    const response = await fetch("/api/admin/password-reset/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) setError(data.error ?? "Impossible d’envoyer l’e-mail de récupération.");
    else setMessage(data.message ?? "Si un compte correspond à cette adresse, un e-mail vient d’être envoyé.");
    setLoading(false);
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_left,#f2d9c7,transparent_35%),linear-gradient(135deg,#fbf7f2,#f5e9df)] px-5 text-[#4b271d]">
      <section className="w-full max-w-md rounded-[30px] border border-[#5b2f22]/10 bg-white/90 p-8 shadow-[0_28px_100px_rgba(74,35,23,.12)] backdrop-blur-xl sm:p-10">
        <MoonyLogo compact />
        <div className="mt-10 grid h-12 w-12 place-items-center rounded-2xl bg-[#f1ddd0] text-[#813617]"><Mail size={22}/></div>
        <h1 className="moony-serif mt-5 text-4xl">Mot de passe oublié</h1>
        <p className="mt-2 text-sm leading-6 text-[#5b2f22]/55">Saisissez l’adresse e-mail de votre compte Control Center. Le lien de récupération reste valable 20 minutes.</p>
        <form onSubmit={submit} className="mt-7 space-y-4">
          <label className="block text-xs font-semibold">Adresse e-mail<input required type="email" value={email} onChange={event=>setEmail(event.target.value)} autoComplete="email" className="mt-1.5 w-full rounded-xl border border-[#5b2f22]/12 bg-[#fffdfa] px-4 py-3.5 text-sm outline-none focus:border-[#9d4c27]/60" placeholder="vous@moonyafrica.com"/></label>
          {message ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs leading-5 text-emerald-800">{message}</p> : null}
          {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs leading-5 text-red-800">{error}</p> : null}
          <button disabled={loading || !email} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#7e3518] px-5 py-3.5 text-sm font-semibold text-white disabled:opacity-50">{loading?<Loader2 className="animate-spin" size={15}/>:<Send size={15}/>}Envoyer le lien</button>
        </form>
        <Link href="/admin/login" className="mt-6 inline-flex items-center gap-2 text-xs text-[#5b2f22]/55"><ArrowLeft size={13}/>Retour à la connexion</Link>
      </section>
    </main>
  );
}
