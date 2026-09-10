import Link from "next/link";
import { Bell, ChevronDown, Search } from "lucide-react";
import { MoonyLogo } from "./moony-logo";

const groups = [
  { label: "EXPÉRIENCE & CONTENU", items: [["Dashboard", "/admin"], ["Site & Design", "/admin/site-design"], ["Pages", "/admin/pages"], ["Ressources", "/admin/ressources"], ["Articles", "/admin/articles"]] },
  { label: "COMMERCIAL & RELATION CLIENT", items: [["CRM", "/admin/crm"], ["Rendez-vous", "/admin/rendez-vous"], ["Service client", "/admin/service-client"]] },
  { label: "MARKETING & ACQUISITION", items: [["Marketing", "/admin/marketing"], ["Newsletters", "/admin/newsletters"], ["Pop-ups & bandeaux", "/admin/popups"]] },
  { label: "MARQUE & CONFIANCE", items: [["À propos", "/admin/a-propos"], ["Témoignages", "/admin/temoignages"], ["Partenaires", "/admin/partenaires"]] },
  { label: "PERFORMANCE & SYSTÈME", items: [["Analytique", "/admin/analytics"], ["SEO", "/admin/seo"], ["Paramètres", "/admin/parametres"]] },
] as const;

export function AdminShell({ active, children }: { active: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#fbf8f4] text-[#301b15]">
      <div className="grid min-h-screen lg:grid-cols-[220px_1fr]">
        <aside className="border-r border-[#5b2f22]/10 bg-[#f7eee5] px-4 py-5">
          <div className="px-2"><MoonyLogo /></div>
          <div className="mt-6 border-t border-[#5b2f22]/10 pt-4">
            {groups.map((group) => (
              <div key={group.label} className="mb-5">
                <p className="mb-2 px-3 text-[9px] font-semibold uppercase tracking-[.18em] text-[#5b2f22]/48">{group.label}</p>
                <nav className="space-y-1">
                  {group.items.map(([label, href]) => (
                    <Link key={href} href={href} className={`block rounded-lg px-3 py-2.5 text-[13px] transition ${active === label ? "bg-[#ecd5c4] font-semibold text-[#6f2d17]" : "text-[#42271f]/76 hover:bg-white/55"}`}>
                      {label}
                    </Link>
                  ))}
                </nav>
              </div>
            ))}
          </div>
          <div className="mt-8 border-t border-[#5b2f22]/10 px-3 pt-5">
            <p className="moony-serif text-lg leading-6 text-[#7a432d]">Un monde où<br />chaque femme<br />peut s’épanouir</p>
            <p className="mt-5 text-[10px] leading-4 text-[#5b2f22]/45">MOONY<br />Web Studio<br />v1.0.0</p>
          </div>
        </aside>

        <section className="min-w-0">
          <header className="sticky top-0 z-30 flex h-[68px] items-center border-b border-[#5b2f22]/10 bg-[#fffdf9]/92 px-5 backdrop-blur lg:px-8">
            <div className="moony-serif hidden text-2xl text-[#5b2f22] xl:block">Control Center</div>
            <div className="mx-auto flex w-full max-w-[640px] items-center gap-2 rounded-lg border border-[#5b2f22]/12 bg-white px-3 py-2.5 text-sm text-[#5b2f22]/45 xl:ml-10 xl:mr-auto">
              <Search size={17} /><span>Rechercher un contact, une page, un article…</span>
            </div>
            <div className="ml-5 flex items-center gap-4">
              <button className="relative"><Bell size={20} /><span className="absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full bg-[#9d4c27] text-[9px] text-white">3</span></button>
              <div className="hidden items-center gap-2 sm:flex"><div className="grid h-9 w-9 place-items-center rounded-full bg-[#c98b64] text-xs font-semibold text-white">AK</div><div className="text-xs"><strong className="block">Aïssata Koné</strong><span className="text-[#5b2f22]/45">Administratrice</span></div><ChevronDown size={14} /></div>
            </div>
          </header>
          <div className="p-5 lg:p-8">{children}</div>
        </section>
      </div>
    </main>
  );
}
