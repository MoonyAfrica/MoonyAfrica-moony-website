"use client";

import { FormEvent, useMemo, useState } from "react";
import { ArrowLeft, KeyRound, Loader2, LockKeyhole, MailCheck } from "lucide-react";
import { MoonyLogo } from "@/components/moony-logo";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [challengeId, setChallengeId] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [code, setCode] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const waitingForCode = Boolean(challengeId);
  const expiryLabel = useMemo(() => {
    if (!expiresAt) return "10 minutes";
    try { return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date(expiresAt)); } catch { return "10 minutes"; }
  }, [expiresAt]);

  async function submitCredentials(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Connexion impossible.");
      if (data.mfaRequired) {
        setChallengeId(data.challengeId || "");
        setMaskedEmail(data.email || email);
        setExpiresAt(data.expiresAt || "");
        setCode("");
        return;
      }
      window.location.href = "/admin";
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Connexion impossible.");
    } finally {
      setLoading(false);
    }
  }

  async function submitCode(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/session/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, code }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Vérification impossible.");
      window.location.href = "/admin";
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Vérification impossible.");
    } finally {
      setLoading(false);
    }
  }

  function restart() {
    setChallengeId("");
    setMaskedEmail("");
    setExpiresAt("");
    setCode("");
    setMessage("");
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_left,#f2d9c7,transparent_35%),linear-gradient(135deg,#fbf7f2,#f5e9df)] px-5 text-[#4b271d]">
      <section className="w-full max-w-md rounded-[30px] border border-[#5b2f22]/10 bg-white/85 p-8 shadow-[0_28px_100px_rgba(74,35,23,.12)] backdrop-blur-xl sm:p-10">
        <MoonyLogo compact />
        <div className="mt-10 grid h-12 w-12 place-items-center rounded-2xl bg-[#f1ddd0] text-[#813617]">
          {waitingForCode ? <MailCheck size={22} /> : <LockKeyhole size={22} />}
        </div>

        {waitingForCode ? (
          <>
            <h1 className="moony-serif mt-5 text-4xl">Vérification</h1>
            <p className="mt-2 text-sm leading-6 text-[#5b2f22]/55">Un code à 6 chiffres a été envoyé à <strong className="font-semibold text-[#5b2f22]/75">{maskedEmail}</strong>. Il reste valable jusqu’à {expiryLabel}.</p>
            <form onSubmit={submitCode} className="mt-7 space-y-4">
              <label className="block text-xs font-semibold">Code de sécurité</label>
              <div className="relative">
                <KeyRound size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5b2f22]/35" />
                <input autoFocus inputMode="numeric" pattern="[0-9]*" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} autoComplete="one-time-code" className="w-full rounded-xl border border-[#5b2f22]/12 bg-[#fffdfa] py-3.5 pl-11 pr-4 text-center text-xl font-semibold tracking-[.34em] outline-none focus:border-[#9d4c27]/60" placeholder="000000" />
              </div>
              {message ? <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{message}</p> : null}
              <button disabled={loading || code.length !== 6} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#7e3518] px-5 py-3.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{loading ? <Loader2 className="animate-spin" size={15} /> : null}{loading ? "Vérification…" : "Valider le code"}</button>
              <button type="button" onClick={restart} className="inline-flex w-full items-center justify-center gap-2 py-2 text-xs text-[#5b2f22]/55"><ArrowLeft size={13} />Revenir à la connexion</button>
            </form>
          </>
        ) : (
          <>
            <h1 className="moony-serif mt-5 text-4xl">Control Center</h1>
            <p className="mt-2 text-sm leading-6 text-[#5b2f22]/55">Connectez-vous à l’espace privé de gestion du site MOONY Africa.</p>
            <form onSubmit={submitCredentials} className="mt-7 space-y-4">
              <label className="block text-xs font-semibold">Adresse e-mail</label>
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" className="w-full rounded-xl border border-[#5b2f22]/12 bg-[#fffdfa] px-4 py-3.5 outline-none focus:border-[#9d4c27]/60" placeholder="vous@moonyafrica.com" />
              <label className="block text-xs font-semibold">Mot de passe</label>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" className="w-full rounded-xl border border-[#5b2f22]/12 bg-[#fffdfa] px-4 py-3.5 outline-none focus:border-[#9d4c27]/60" placeholder="••••••••••••" />
              {message ? <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{message}</p> : null}
              <button disabled={loading || !password} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#7e3518] px-5 py-3.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{loading ? <Loader2 className="animate-spin" size={15} /> : null}{loading ? "Connexion…" : "Se connecter"}</button>
            </form>
            <p className="mt-6 text-[11px] leading-5 text-[#5b2f22]/40">Les membres de l’équipe utilisent leur e-mail et leur mot de passe. Le mot de passe fondateur historique reste disponible comme accès de secours si le champ e-mail est laissé vide.</p>
          </>
        )}
      </section>
    </main>
  );
}
