import Link from "next/link";
import { Instagram, Linkedin, Mail, ShieldCheck } from "lucide-react";
import { MoonyLogo } from "./moony-logo";
import { siteConfig } from "@/lib/site-config";

const columns = [
  {
    title: "Découvrir",
    links: [
      ["Notre mission", "/notre-mission"],
      ["Notre approche", "/notre-approche"],
      ["Nos services", "/services"],
      ["Communauté", "/communaute"],
      ["Ressources", "/ressources"],
    ],
  },
  {
    title: "Confiance",
    links: [
      ["Protection des données", "/confidentialite"],
      ["Sécurité", "/confidentialite#securite"],
      ["Service client", "/support"],
      ["Méthode & qualité", "/notre-approche"],
      ["Professionnels de santé", "/services#professionnels"],
    ],
  },
  {
    title: "Entreprise",
    links: [
      ["À propos", "/a-propos"],
      ["Partenariats", "/contact?objet=partenariat"],
      ["Presse", "/presse"],
      ["Carrières", "/carrieres"],
      ["Nous contacter", "/contact"],
    ],
  },
] as const;

export function PublicFooter() {
  return (
    <footer className="border-t border-[#f5d8c8]/10 bg-[#321b14] text-[#fff8f1]">
      <div className="mx-auto max-w-[1660px] px-6 py-14 sm:px-8 lg:px-12 lg:py-16">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_1fr]">
          <div className="max-w-[520px]">
            <MoonyLogo light />
            <h2 className="moony-serif mt-8 text-[38px] leading-[1.02] tracking-[-.035em] sm:text-[46px]">
              Pour la santé des femmes,
              <br />à chaque étape de leur vie.
            </h2>
            <p className="mt-5 max-w-[470px] text-sm leading-6 text-white/62">
              Une expérience de santé féminine pensée pour être utile, rassurante et accessible, avec une ambition africaine et une ouverture sur le monde.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href={siteConfig.appUrl} className="rounded-full bg-[#b85d34] px-6 py-3 text-sm font-medium text-white transition hover:-translate-y-[1px]">
                Accéder à l’application
              </a>
              <Link href="/contact" className="rounded-full border border-white/28 px-6 py-3 text-sm font-medium text-white transition hover:bg-white/7">
                Nous contacter
              </Link>
            </div>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            {columns.map((column) => (
              <div key={column.title}>
                <h3 className="text-[11px] font-semibold uppercase tracking-[.2em] text-[#e9b78f]">{column.title}</h3>
                <nav className="mt-4 space-y-3 text-sm text-white/68" aria-label={column.title}>
                  {column.links.map(([label, href]) => (
                    <Link key={href} href={href} className="block transition hover:text-white">
                      {label}
                    </Link>
                  ))}
                </nav>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 grid gap-6 border-t border-white/10 pt-7 md:grid-cols-[1fr_auto] md:items-center">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-white/46">
            <span>© {new Date().getFullYear()} MOONY Africa</span>
            <Link href="/mentions-legales" className="hover:text-white">Mentions légales</Link>
            <Link href="/confidentialite" className="hover:text-white">Confidentialité</Link>
            <span className="inline-flex items-center gap-1.5"><ShieldCheck size={13} /> Données traitées avec confidentialité</span>
          </div>
          <div className="flex items-center gap-2">
            <a href={`mailto:${siteConfig.supportEmail}`} aria-label="E-mail" className="grid h-9 w-9 place-items-center rounded-full border border-white/14 text-white/62 hover:text-white"><Mail size={15} /></a>
            <a href="#" aria-label="Instagram" className="grid h-9 w-9 place-items-center rounded-full border border-white/14 text-white/62 hover:text-white"><Instagram size={15} /></a>
            <a href="#" aria-label="LinkedIn" className="grid h-9 w-9 place-items-center rounded-full border border-white/14 text-white/62 hover:text-white"><Linkedin size={15} /></a>
          </div>
        </div>
      </div>
    </footer>
  );
}
