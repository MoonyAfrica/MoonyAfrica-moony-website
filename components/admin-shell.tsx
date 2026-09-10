import Link from "next/link";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ChevronDown,
  FileText,
  FolderOpen,
  Gauge,
  Handshake,
  History,
  Image as ImageIcon,
  LayoutDashboard,
  Mail,
  Megaphone,
  MessageCircleMore,
  Palette,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { AdminGlobalSearch } from "./admin-global-search";
import { AdminNotifications } from "./admin-notifications";
import { MoonyLogo } from "./moony-logo";

const groups = [
  {
    label: "EXPÉRIENCE & CONTENU",
    items: [
      ["Dashboard", "/admin", LayoutDashboard],
      ["Site & Design", "/admin/site-design", Palette],
      ["Pages", "/admin/pages", FileText],
      ["Historique", "/admin/historique", History],
      ["Médias", "/admin/medias", ImageIcon],
      ["Ressources", "/admin/ressources", FolderOpen],
      ["Articles", "/admin/articles", BookOpen],
    ],
  },
  {
    label: "COMMERCIAL & RELATION CLIENT",
    items: [
      ["CRM", "/admin/crm", Users],
      ["Rendez-vous", "/admin/rendez-vous", CalendarDays],
      ["Service client", "/admin/service-client", MessageCircleMore],
    ],
  },
  {
    label: "MARKETING & ACQUISITION",
    items: [
      ["Marketing", "/admin/marketing", Megaphone],
      ["Newsletters", "/admin/newsletters", Mail],
      ["Pop-ups & bandeaux", "/admin/popups", Sparkles],
    ],
  },
  {
    label: "MARQUE & CONFIANCE",
    items: [
      ["À propos", "/admin/a-propos", ShieldCheck],
      ["Témoignages", "/admin/temoignages", MessageCircleMore],
      ["Partenaires", "/admin/partenaires", Handshake],
    ],
  },
  {
    label: "PERFORMANCE & SYSTÈME",
    items: [
      ["Analytique", "/admin/analytics", BarChart3],
      ["SEO", "/admin/seo", Gauge],
      ["Paramètres", "/admin/parametres", Settings],
    ],
  },
] as const;

export function AdminShell({ active, children }: { active: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#fbf8f4] text-[#301b15]">
      <div className="grid min-h-screen lg:grid-cols-[214px_1fr]">
        <aside className="border-r border-[#5b2f22]/10 bg-[linear-gradient(180deg,#f8efe6_0%,#f5eadf_100%)] px-3 py-5 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
          <div className="px-3"><MoonyLogo compact /></div>
          <div className="mt-6 border-t border-[#5b2f22]/10 pt-3">
            {groups.map((group) => (
              <div key={group.label} className="mb-4">
                <p className="mb-1.5 px-3 text-[8px] font-semibold uppercase tracking-[.15em] text-[#5b2f22]/42">{group.label}</p>
                <nav className="space-y-[2px]">
                  {group.items.map(([label, href, Icon]) => (
                    <Link
                      key={href}
                      href={href}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[12px] transition ${
                        active === label
                          ? "bg-[#ead1bf] font-semibold text-[#6f2d17] shadow-[inset_3px_0_0_#a95832]"
                          : "text-[#42271f]/74 hover:bg-white/55 hover:text-[#5b2f22]"
                      }`}
                    >
                      <Icon size={16} strokeWidth={1.65} />
                      <span>{label}</span>
                    </Link>
                  ))}
                </nav>
              </div>
            ))}
          </div>

          <div className="relative mt-7 overflow-hidden border-t border-[#5b2f22]/10 px-3 pb-4 pt-5">
            <div className="absolute -bottom-7 -left-8 h-24 w-24 rounded-full border border-[#b97955]/22" />
            <div className="absolute -bottom-12 left-3 h-28 w-28 rounded-full border border-[#b97955]/14" />
            <p className="moony-serif relative text-[18px] leading-[1.15] text-[#8a4a31]">Un monde où<br />chaque femme<br />peut s’épanouir</p>
            <span className="relative mt-3 block h-px w-8 bg-[#a95832]/65" />
            <p className="relative mt-5 text-[9px] leading-4 text-[#5b2f22]/42">MOONY<br />Web Studio<br />Control Center</p>
          </div>
        </aside>

        <section className="min-w-0">
          <header className="sticky top-0 z-30 flex h-[66px] items-center border-b border-[#5b2f22]/10 bg-[#fffdf9]/94 px-5 backdrop-blur-xl lg:px-7">
            <div className="moony-serif hidden shrink-0 text-[23px] text-[#5b2f22] xl:block">Control Center</div>
            <AdminGlobalSearch />
            <div className="ml-4 flex items-center gap-4">
              <AdminNotifications />
              <div className="hidden items-center gap-2 border-l border-[#5b2f22]/10 pl-4 sm:flex">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-[linear-gradient(145deg,#d8a17e,#a95631)] text-[10px] font-semibold text-white">MA</div>
                <div className="text-[11px] leading-[1.25]"><strong className="block font-semibold">MOONY Admin</strong><span className="text-[#5b2f22]/45">Control Center</span></div>
                <ChevronDown size={13} />
              </div>
            </div>
          </header>
          <div className="p-4 sm:p-5 lg:p-7">{children}</div>
        </section>
      </div>
    </main>
  );
}
