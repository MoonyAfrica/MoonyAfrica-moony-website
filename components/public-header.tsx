import Link from "next/link";
import { Menu, X } from "lucide-react";
import { MoonyLogo } from "./moony-logo";
import { getPublicChromeSettings } from "@/lib/public-settings";

function isExternal(href:string){return /^https?:\/\//i.test(href)}
function NavLink({href,className,children}:{href:string;className:string;children:React.ReactNode}){
  return isExternal(href)?<a href={href} className={className}>{children}</a>:<Link href={href} className={className}>{children}</Link>;
}

export async function PublicHeader({ active, light = false }: { active: string; light?: boolean }) {
  const { navigation } = await getPublicChromeSettings();
  const items = navigation.items.filter(item=>item.visible!==false && item.label.trim() && item.href.trim());
  const ink = light ? "text-[#fff9f3]" : "text-[#5b2f22]";
  const glass = light ? "bg-[#31170f]/10" : "bg-[#fffaf4]/45";

  return (
    <header className="absolute inset-x-0 top-0 z-40">
      <div className="mx-auto flex max-w-[1660px] items-center gap-6 px-5 py-6 sm:px-8 lg:px-12">
        <Link href="/" className="shrink-0" aria-label="MOONY - Accueil"><MoonyLogo light={light} /></Link>

        <nav className={`ml-auto hidden items-center gap-7 text-[13px] xl:flex ${ink}`} aria-label="Navigation principale">
          {items.map((item) => {
            const isActive = active === item.label;
            return <NavLink key={`${item.label}-${item.href}`} href={item.href} className={`relative py-2 font-medium transition-opacity hover:opacity-65 ${isActive ? "opacity-100" : "opacity-90"}`}>
              {item.label}{isActive ? <span className="absolute -bottom-[3px] left-1/2 h-[5px] w-[5px] -translate-x-1/2 rounded-full bg-current" /> : null}
            </NavLink>;
          })}
        </nav>

        <div className="ml-auto hidden items-center gap-3 md:flex xl:ml-8">
          <NavLink href={navigation.primaryHref} className={`rounded-full px-6 py-3 text-[13px] font-medium transition hover:-translate-y-[1px] ${light ? "border border-[#f1a276]/75 bg-[#7d3218] text-white" : "bg-[#7d3218] text-white"}`}>{navigation.primaryLabel}</NavLink>
          <NavLink href={navigation.secondaryHref} className={`rounded-full border px-6 py-3 text-[13px] font-medium transition hover:bg-white/10 ${light ? "border-white/60 text-white" : "border-[#5b2f22]/45 text-[#5b2f22]"}`}>{navigation.secondaryLabel}</NavLink>
        </div>

        <details className="group relative ml-auto xl:hidden">
          <summary className={`grid h-11 w-11 cursor-pointer list-none place-items-center rounded-full border ${light ? "border-white/40 text-white" : "border-[#5b2f22]/25 text-[#5b2f22]"} ${glass}`} aria-label="Ouvrir le menu">
            <Menu className="group-open:hidden" size={20} /><X className="hidden group-open:block" size={20} />
          </summary>
          <div className="absolute right-0 mt-3 w-[min(86vw,330px)] overflow-hidden rounded-[24px] border border-[#5b2f22]/10 bg-[#fffaf4]/95 p-4 text-[#5b2f22] shadow-[0_24px_80px_rgba(45,24,18,.18)] backdrop-blur-xl">
            <nav className="space-y-1" aria-label="Navigation mobile">
              {items.map((item)=><NavLink key={`${item.label}-${item.href}`} href={item.href} className={`block rounded-xl px-4 py-3 text-sm ${active===item.label?"bg-[#f0d8c6] font-semibold":"hover:bg-[#f8eee5]"}`}>{item.label}</NavLink>)}
            </nav>
            <div className="mt-3 grid gap-2 border-t border-[#5b2f22]/10 pt-3">
              <NavLink href={navigation.primaryHref} className="rounded-full bg-[#7d3218] px-5 py-3 text-center text-sm font-medium text-white">{navigation.primaryLabel}</NavLink>
              <NavLink href={navigation.secondaryHref} className="rounded-full border border-[#5b2f22]/35 px-5 py-3 text-center text-sm font-medium">{navigation.secondaryLabel}</NavLink>
            </div>
          </div>
        </details>
      </div>
    </header>
  );
}
