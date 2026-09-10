import Link from "next/link";
import { Menu, X } from "lucide-react";
import { MoonyLogo } from "./moony-logo";
import { siteConfig } from "@/lib/site-config";

const items = [
  ["Accueil", "/"],
  ["Notre mission", "/notre-mission"],
  ["Notre approche", "/notre-approche"],
  ["À propos", "/a-propos"],
  ["Nos services", "/services"],
  ["Communauté", "/communaute"],
  ["Ressources", "/ressources"],
] as const;

export function PublicHeader({ active, light = false }: { active: string; light?: boolean }) {
  const ink = light ? "text-[#fff9f3]" : "text-[#5b2f22]";
  const glass = light ? "bg-[#31170f]/10" : "bg-[#fffaf4]/45";

  return (
    <header className="absolute inset-x-0 top-0 z-40">
      <div className="mx-auto flex max-w-[1660px] items-center gap-6 px-5 py-6 sm:px-8 lg:px-12">
        <Link href="/" className="shrink-0" aria-label="MOONY - Accueil">
          <MoonyLogo light={light} />
        </Link>

        <nav className={`ml-auto hidden items-center gap-7 text-[13px] xl:flex ${ink}`} aria-label="Navigation principale">
          {items.map(([label, href]) => {
            const isActive = active === label;
            return (
              <Link
                key={href}
                href={href}
                className={`relative py-2 font-medium transition-opacity hover:opacity-65 ${isActive ? "opacity-100" : "opacity-90"}`}
              >
                {label}
                {isActive ? <span className="absolute -bottom-[3px] left-1/2 h-[5px] w-[5px] -translate-x-1/2 rounded-full bg-current" /> : null}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto hidden items-center gap-3 md:flex xl:ml-8">
          <Link
            href={siteConfig.bookingUrl}
            className={`rounded-full px-6 py-3 text-[13px] font-medium transition hover:-translate-y-[1px] ${
              light ? "border border-[#f1a276]/75 bg-[#7d3218] text-white" : "bg-[#7d3218] text-white"
            }`}
          >
            Prendre rendez-vous
          </Link>
          <a
            href={siteConfig.appUrl}
            className={`rounded-full border px-6 py-3 text-[13px] font-medium transition hover:bg-white/10 ${
              light ? "border-white/60 text-white" : "border-[#5b2f22]/45 text-[#5b2f22]"
            }`}
          >
            Se connecter
          </a>
        </div>

        <details className="group relative ml-auto xl:hidden">
          <summary
            className={`grid h-11 w-11 cursor-pointer list-none place-items-center rounded-full border ${
              light ? "border-white/40 text-white" : "border-[#5b2f22]/25 text-[#5b2f22]"
            } ${glass}`}
            aria-label="Ouvrir le menu"
          >
            <Menu className="group-open:hidden" size={20} />
            <X className="hidden group-open:block" size={20} />
          </summary>
          <div className="absolute right-0 mt-3 w-[min(86vw,330px)] overflow-hidden rounded-[24px] border border-[#5b2f22]/10 bg-[#fffaf4]/95 p-4 text-[#5b2f22] shadow-[0_24px_80px_rgba(45,24,18,.18)] backdrop-blur-xl">
            <nav className="space-y-1" aria-label="Navigation mobile">
              {items.map(([label, href]) => (
                <Link key={href} href={href} className={`block rounded-xl px-4 py-3 text-sm ${active === label ? "bg-[#f0d8c6] font-semibold" : "hover:bg-[#f8eee5]"}`}>
                  {label}
                </Link>
              ))}
            </nav>
            <div className="mt-3 grid gap-2 border-t border-[#5b2f22]/10 pt-3">
              <Link href={siteConfig.bookingUrl} className="rounded-full bg-[#7d3218] px-5 py-3 text-center text-sm font-medium text-white">Prendre rendez-vous</Link>
              <a href={siteConfig.appUrl} className="rounded-full border border-[#5b2f22]/35 px-5 py-3 text-center text-sm font-medium">Se connecter</a>
            </div>
          </div>
        </details>
      </div>
    </header>
  );
}
