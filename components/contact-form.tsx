"use client";

import { FormEvent, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, LoaderCircle } from "lucide-react";

const needs = [
  ["demonstration", "Demander une démonstration"],
  ["rappel", "Être rappelé par un commercial"],
  ["professionnel", "Devenir professionnel partenaire"],
  ["entreprise", "Découvrir l’offre entreprise"],
  ["partenariat", "Proposer un partenariat"],
  ["presse", "Demande presse"],
  ["carriere", "Carrière / candidature"],
  ["confidentialite", "Question confidentialité & sécurité"],
  ["protections", "Protections réutilisables"],
  ["autre", "Autre demande"],
] as const;

export function ContactForm() {
  const params = useSearchParams();
  const initialNeed = useMemo(() => {
    const requested = params.get("objet")?.toLowerCase();
    return needs.some(([value]) => value === requested) ? requested! : "demonstration";
  }, [params]);

  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setError("");

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Une erreur est survenue.");
      setStatus("success");
      form.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="grid min-h-[560px] place-items-center rounded-[28px] border border-[#5b2f22]/10 bg-white/75 p-8 text-center shadow-[0_20px_60px_rgba(93,48,31,.06)]">
        <div className="max-w-sm"><CheckCircle2 className="mx-auto text-emerald-700" size={44} strokeWidth={1.4} /><h2 className="moony-serif mt-5 text-4xl">Merci.</h2><p className="mt-3 text-sm leading-6 text-[#5b2f22]/66">Votre demande a bien été enregistrée. L’équipe MOONY pourra la retrouver dans le Control Center et revenir vers vous.</p><button onClick={() => setStatus("idle")} className="mt-6 rounded-full border border-[#5b2f22]/25 px-6 py-3 text-sm font-medium">Envoyer une autre demande</button></div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-[28px] border border-[#5b2f22]/10 bg-white/75 p-7 shadow-[0_20px_60px_rgba(93,48,31,.06)] sm:p-10">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block"><span className="mb-2 block text-xs text-[#5b2f22]/55">Prénom *</span><input name="firstName" required autoComplete="given-name" placeholder="Awa" className="w-full rounded-xl border border-[#5b2f22]/12 bg-[#fffdfa] px-4 py-3.5 outline-none focus:border-[#9d4c27]" /></label>
        <label className="block"><span className="mb-2 block text-xs text-[#5b2f22]/55">Nom *</span><input name="lastName" required autoComplete="family-name" placeholder="Diop" className="w-full rounded-xl border border-[#5b2f22]/12 bg-[#fffdfa] px-4 py-3.5 outline-none focus:border-[#9d4c27]" /></label>
        <label className="block"><span className="mb-2 block text-xs text-[#5b2f22]/55">Email *</span><input name="email" required type="email" autoComplete="email" placeholder="awa@entreprise.com" className="w-full rounded-xl border border-[#5b2f22]/12 bg-[#fffdfa] px-4 py-3.5 outline-none focus:border-[#9d4c27]" /></label>
        <label className="block"><span className="mb-2 block text-xs text-[#5b2f22]/55">Téléphone</span><input name="phone" autoComplete="tel" placeholder="+221 …" className="w-full rounded-xl border border-[#5b2f22]/12 bg-[#fffdfa] px-4 py-3.5 outline-none focus:border-[#9d4c27]" /></label>
        <label className="block"><span className="mb-2 block text-xs text-[#5b2f22]/55">Entreprise</span><input name="company" autoComplete="organization" placeholder="Nom de l’organisation" className="w-full rounded-xl border border-[#5b2f22]/12 bg-[#fffdfa] px-4 py-3.5 outline-none focus:border-[#9d4c27]" /></label>
        <label className="block"><span className="mb-2 block text-xs text-[#5b2f22]/55">Fonction</span><input name="roleTitle" autoComplete="organization-title" placeholder="Votre fonction" className="w-full rounded-xl border border-[#5b2f22]/12 bg-[#fffdfa] px-4 py-3.5 outline-none focus:border-[#9d4c27]" /></label>
      </div>

      <label className="mt-5 block"><span className="mb-2 block text-xs text-[#5b2f22]/55">Votre besoin</span><select name="need" defaultValue={initialNeed} className="w-full rounded-xl border border-[#5b2f22]/12 bg-[#fffdfa] px-4 py-3.5 outline-none focus:border-[#9d4c27]">{needs.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="mt-5 block"><span className="mb-2 block text-xs text-[#5b2f22]/55">Message</span><textarea name="message" className="min-h-36 w-full rounded-xl border border-[#5b2f22]/12 bg-[#fffdfa] px-4 py-3.5 outline-none focus:border-[#9d4c27]" placeholder="Parlez-nous de votre projet…" /></label>
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <label className="mt-5 flex gap-3 text-xs leading-5 text-[#5b2f22]/60"><input required type="checkbox" className="mt-1" />J’accepte que MOONY utilise ces informations pour répondre à ma demande. Ces informations sont traitées comme des données de contact et non comme des données de santé.</label>

      {status === "error" ? <p className="mt-5 rounded-xl bg-[#f8e2df] px-4 py-3 text-sm text-[#7b2f22]">{error}</p> : null}
      <button disabled={status === "sending"} type="submit" className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#7e3518] px-8 py-4 text-sm font-medium text-white disabled:cursor-wait disabled:opacity-60">{status === "sending" ? <LoaderCircle className="animate-spin" size={16} /> : null}{status === "sending" ? "Envoi…" : "Envoyer ma demande"}</button>
    </form>
  );
}
