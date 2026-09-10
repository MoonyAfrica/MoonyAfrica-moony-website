import Link from "next/link";
import { Instagram, Linkedin, Mail, ShieldCheck } from "lucide-react";
import { MoonyLogo } from "./moony-logo";
import { PublicProofStrip } from "./public-proof-strip";
import { getPublicChromeSettings, getPublicSiteSettings } from "@/lib/public-settings";

function isExternal(href:string){return /^https?:\/\//i.test(href)}
function SmartLink({href,className,children}:{href:string;className:string;children:React.ReactNode}){
  return isExternal(href)?<a href={href} className={className}>{children}</a>:<Link href={href} className={className}>{children}</Link>;
}

export async function PublicFooter() {
  const [{ footer }, { general }] = await Promise.all([getPublicChromeSettings(),getPublicSiteSettings()]);
  return (
    <footer className="border-t border-[#f5d8c8]/10 bg-[#321b14] text-[#fff8f1]">
      <PublicProofStrip />
      <div className="mx-auto max-w-[1660px] px-6 py-14 sm:px-8 lg:px-12 lg:py-16">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_1fr]">
          <div className="max-w-[520px]">
            <MoonyLogo light />
            <h2 className="moony-serif mt-8 whitespace-pre-line text-[38px] leading-[1.02] tracking-[-.035em] sm:text-[46px]">{footer.headline}</h2>
            <p className="mt-5 max-w-[470px] text-sm leading-6 text-white/62">{footer.body}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <SmartLink href={footer.primaryHref} className="rounded-full bg-[#b85d34] px-6 py-3 text-sm font-medium text-white transition hover:-translate-y-[1px]">{footer.primaryLabel}</SmartLink>
              <SmartLink href={footer.secondaryHref} className="rounded-full border border-white/28 px-6 py-3 text-sm font-medium text-white transition hover:bg-white/7">{footer.secondaryLabel}</SmartLink>
            </div>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            {footer.columns.slice(0,4).map((column) => (
              <div key={column.title}>
                <h3 className="text-[11px] font-semibold uppercase tracking-[.2em] text-[#e9b78f]">{column.title}</h3>
                <nav className="mt-4 space-y-3 text-sm text-white/68" aria-label={column.title}>
                  {column.links.filter(link=>link.label.trim()&&link.href.trim()).map((link) => <SmartLink key={`${column.title}-${link.label}-${link.href}`} href={link.href} className="block transition hover:text-white">{link.label}</SmartLink>)}
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
            <a href={`mailto:${general.email}`} aria-label="E-mail" className="grid h-9 w-9 place-items-center rounded-full border border-white/14 text-white/62 hover:text-white"><Mail size={15} /></a>
            {footer.instagramUrl?<a href={footer.instagramUrl} target="_blank" rel="noreferrer" aria-label="Instagram" className="grid h-9 w-9 place-items-center rounded-full border border-white/14 text-white/62 hover:text-white"><Instagram size={15} /></a>:null}
            {footer.linkedinUrl?<a href={footer.linkedinUrl} target="_blank" rel="noreferrer" aria-label="LinkedIn" className="grid h-9 w-9 place-items-center rounded-full border border-white/14 text-white/62 hover:text-white"><Linkedin size={15} /></a>:null}
          </div>
        </div>
      </div>
    </footer>
  );
}
