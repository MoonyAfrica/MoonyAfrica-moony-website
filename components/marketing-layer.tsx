"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";

type MarketingElement = {
  id: string;
  name: string;
  kind: "popup" | "banner" | "form" | "campaign";
  placement: string[];
  eyebrow: string | null;
  headline: string;
  body: string | null;
  cta_label: string | null;
  cta_url: string | null;
  collect_email: boolean;
  config?: Record<string, unknown> | null;
};

function matchesPlacement(item: MarketingElement, pathname: string) {
  if (!item.placement?.length) return pathname === "/";
  return item.placement.some((placement) => placement === "*" || placement === "all" || placement === pathname || (placement.endsWith("/*") && pathname.startsWith(placement.slice(0, -1))));
}

export function MarketingLayer() {
  const pathname = usePathname();
  const [elements, setElements] = useState<MarketingElement[]>([]);
  const [popupReady, setPopupReady] = useState(false);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/marketing", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => { if (!cancelled) setElements(data.elements ?? []); })
      .catch(() => undefined);
    const timer = window.setTimeout(() => setPopupReady(true), 900);
    const hidden = window.sessionStorage.getItem("moony-dismissed-marketing");
    if (hidden) {
      try { setDismissed(JSON.parse(hidden)); } catch { /* ignore */ }
    }
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, []);

  const visible = useMemo(() => elements.filter((item) => matchesPlacement(item, pathname) && !dismissed.includes(item.id)), [elements, pathname, dismissed]);
  const banner = visible.find((item) => item.kind === "banner");
  const popup = popupReady ? visible.find((item) => item.kind === "popup") : undefined;

  function dismiss(id: string) {
    const next = [...new Set([...dismissed, id])];
    setDismissed(next);
    window.sessionStorage.setItem("moony-dismissed-marketing", JSON.stringify(next));
  }

  async function subscribe(event: FormEvent, source: string, itemId: string) {
    event.preventDefault();
    setMessage("");
    const response = await fetch("/api/newsletter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, source: `marketing:${source}`, marketingElementId: itemId }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "Inscription impossible.");
      return;
    }
    setMessage("Merci, votre inscription est confirmée.");
    setEmail("");
  }

  return (
    <>
      {banner ? (
        <div className="fixed inset-x-0 top-0 z-[70] flex min-h-10 items-center justify-center gap-4 bg-[#6d2d17] px-12 py-2 text-center text-xs text-white shadow-sm">
          <span><strong>{banner.headline}</strong>{banner.body ? ` — ${banner.body}` : ""}</span>
          {banner.cta_label && banner.cta_url ? <a href={banner.cta_url} className="underline underline-offset-4">{banner.cta_label}</a> : null}
          <button onClick={() => dismiss(banner.id)} aria-label="Fermer le bandeau" className="absolute right-4 grid h-7 w-7 place-items-center rounded-full hover:bg-white/10"><X size={14} /></button>
        </div>
      ) : null}

      {popup ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[#2d1812]/24 p-4 backdrop-blur-[2px] sm:items-center" role="dialog" aria-modal="true" aria-label={popup.name}>
          <div className="relative w-full max-w-md overflow-hidden rounded-[26px] border border-[#5b2f22]/10 bg-[#fffaf4] p-7 text-[#5b2f22] shadow-[0_35px_120px_rgba(45,24,18,.28)] sm:p-8">
            <button onClick={() => dismiss(popup.id)} aria-label="Fermer" className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-[#f4e8de] text-[#5b2f22]/60"><X size={16} /></button>
            {popup.eyebrow ? <p className="pr-12 text-[10px] font-semibold uppercase tracking-[.25em] text-[#9d4c27]">{popup.eyebrow}</p> : null}
            <h2 className="moony-serif mt-2 pr-8 text-4xl leading-[1.02]">{popup.headline}</h2>
            {popup.body ? <p className="mt-4 text-sm leading-6 text-[#5b2f22]/65">{popup.body}</p> : null}
            {popup.collect_email ? (
              <form onSubmit={(event) => subscribe(event, popup.name, popup.id)} className="mt-6">
                <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required placeholder="Votre adresse e-mail" className="w-full rounded-full border border-[#5b2f22]/14 bg-white px-5 py-3.5 text-sm outline-none focus:border-[#9d4c27]/55" />
                <button className="mt-3 w-full rounded-full bg-[#7e3518] px-5 py-3.5 text-sm font-semibold text-white">{popup.cta_label || "Je m’inscris"}</button>
                {message ? <p className="mt-3 text-center text-xs text-[#5b2f22]/60">{message}</p> : null}
              </form>
            ) : popup.cta_label && popup.cta_url ? (
              <a href={popup.cta_url} className="mt-6 inline-flex rounded-full bg-[#7e3518] px-6 py-3 text-sm font-semibold text-white">{popup.cta_label}</a>
            ) : null}
            <p className="mt-5 text-[10px] leading-4 text-[#5b2f22]/38">MOONY utilise uniquement les informations que vous choisissez de transmettre. Vous pouvez vous désinscrire à tout moment.</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
