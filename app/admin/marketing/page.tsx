import Link from "next/link";
import { Megaphone, PanelsTopLeft, Target, UserRoundPlus } from "lucide-react";
import { AdminWorkspace } from "@/components/admin-workspace";
import { MarketingEditor } from "@/components/marketing-editor";

const modules = [
  ["Pop-ups", "Captez l’attention au bon moment.", "/admin/popups", PanelsTopLeft],
  ["Bandeaux", "Annoncez vos offres et temps forts.", "/admin/popups", Megaphone],
  ["Formulaires", "Collectez des leads qualifiés.", "/admin/marketing", UserRoundPlus],
  ["Campagnes", "Lancez des actions marketing ciblées.", "/admin/marketing", Target],
] as const;

export default function MarketingPage() {
  return (
    <AdminWorkspace active="Marketing" title="Marketing & Acquisition" subtitle="Créez, publiez et pilotez les pop-ups, bandeaux, formulaires et campagnes visibles sur le site public.">
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {modules.map(([title, body, href, Icon]) => (
          <Link key={title} href={href} className="admin-card admin-shadow group p-5 transition hover:-translate-y-0.5 hover:border-[#b96d48]/30">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#f4ded0] text-[#873a1c]"><Icon size={19} strokeWidth={1.6} /></div>
            <h2 className="moony-serif mt-4 text-2xl">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-[#5b2f22]/55">{body}</p>
            <span className="mt-5 block text-right text-[#8d3b19] transition group-hover:translate-x-1">→</span>
          </Link>
        ))}
      </div>
      <MarketingEditor />
    </AdminWorkspace>
  );
}
