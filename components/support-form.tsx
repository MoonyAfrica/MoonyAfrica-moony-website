"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";

export function SupportForm() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const response = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
          type: data.get("type"),
          subject: data.get("subject"),
          message: data.get("message"),
          website: data.get("website"),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Votre demande n’a pas pu être envoyée.");
      setSuccess(true);
      setMessage("Votre demande a bien été transmise à l’équipe MOONY.");
      form.reset();
    } catch (error) {
      setSuccess(false);
      setMessage(error instanceof Error ? error.message : "Votre demande n’a pas pu être envoyée.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-[28px] border border-[#5b2f22]/10 bg-white/78 p-6 shadow-[0_24px_70px_rgba(80,42,29,.07)] sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <label><span className="mb-1.5 block text-xs font-semibold">Nom</span><input name="name" autoComplete="name" className="w-full rounded-xl border border-[#5b2f22]/12 bg-[#fffdfa] px-4 py-3.5 text-sm outline-none focus:border-[#9d4c27]/55" placeholder="Votre nom" /></label>
        <label><span className="mb-1.5 block text-xs font-semibold">Adresse e-mail *</span><input name="email" type="email" required autoComplete="email" className="w-full rounded-xl border border-[#5b2f22]/12 bg-[#fffdfa] px-4 py-3.5 text-sm outline-none focus:border-[#9d4c27]/55" placeholder="vous@exemple.com" /></label>
      </div>
      <label className="mt-4 block"><span className="mb-1.5 block text-xs font-semibold">Type de demande</span><select name="type" className="w-full rounded-xl border border-[#5b2f22]/12 bg-[#fffdfa] px-4 py-3.5 text-sm"><option value="question">Question</option><option value="request">Demande</option><option value="incident">Signaler un problème</option><option value="complaint">Réclamation</option><option value="feedback">Partager un avis</option></select></label>
      <label className="mt-4 block"><span className="mb-1.5 block text-xs font-semibold">Sujet *</span><input name="subject" required className="w-full rounded-xl border border-[#5b2f22]/12 bg-[#fffdfa] px-4 py-3.5 text-sm outline-none focus:border-[#9d4c27]/55" placeholder="Comment pouvons-nous vous aider ?" /></label>
      <label className="mt-4 block"><span className="mb-1.5 block text-xs font-semibold">Votre message *</span><textarea name="message" required rows={6} className="w-full resize-none rounded-xl border border-[#5b2f22]/12 bg-[#fffdfa] px-4 py-3.5 text-sm leading-6 outline-none focus:border-[#9d4c27]/55" placeholder="Décrivez votre demande sans inclure d’informations médicales sensibles qui ne sont pas nécessaires au traitement de votre requête." /></label>
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <label className="mt-4 flex gap-3 text-[11px] leading-5 text-[#5b2f22]/55"><input required type="checkbox" className="mt-1 h-4 w-4 accent-[#7e3518]" /><span>J’accepte que MOONY utilise les informations transmises uniquement pour traiter cette demande de service client.</span></label>
      {message ? <div className={`mt-4 flex items-start gap-2 rounded-xl px-4 py-3 text-xs ${success ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{success ? <CheckCircle2 size={15} className="mt-0.5 shrink-0" /> : null}<span>{message}</span></div> : null}
      <button disabled={loading} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#7e3518] px-6 py-3.5 text-sm font-semibold text-white disabled:opacity-50">{loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Envoyer ma demande</button>
    </form>
  );
}
