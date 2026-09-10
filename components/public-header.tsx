import Link from "next/link";
import { MoonyLogo } from "./moony-logo";

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
  const ink = light ? "text-white" : "text-[#5b2f22]";
  return (
    <header className="absolute inset-x-0 top-0 z-40">
      <div className="mx-auto flex max-w-[1560px] items-center gap-8 px-6 py-7 lg:px-12">
        <Link href="/" className="shrink-0" aria-label="MOONY - Accueil">
          <MoonyLogo light={light} />
        </Link>
        <nav className={`ml-auto hidden items-center gap-7 text-[13px] xl:flex ${ink}`}>
          {items.map(([label, href]) => {
            const isActive = active === label;
            return (
              <Link key={href} href={href} className="relative py-2 font-medium transition-opacity hover:opacity-65">
                {label}
                {isActive ? <span className="absolute -bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-current" /> : null}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto hidden items-center gap-3 md:flex xl:ml-8">
          <Link href="/contact" className={`rounded-full px-6 py-3 text-sm font-medium ${light ? "border border-white/65 text-white" : "bg-[#783416] text-white"}`}>
            Prendre rendez-vous
          </Link>
          <Link href="/admin" className={`rounded-full border px-6 py-3 text-sm font-medium ${light ? "border-white/65 text-white" : "border-[#5b2f22]/45 text-[#5b2f22]"}`}>
            Se connecter
          </Link>
        </div>
      </div>
    </header>
  );
}
