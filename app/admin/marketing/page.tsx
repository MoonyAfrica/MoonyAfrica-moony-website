import { AdminCard, AdminWorkspace } from "@/components/admin-workspace";

const modules = [
  ["Pop-ups","Captez l’attention au bon moment."],
  ["Bandeaux","Annoncez vos offres et temps forts."],
  ["Formulaires","Collectez des leads qualifiés."],
  ["Campagnes","Lancez des actions marketing ciblées."],
];
const recent = [
  ["Inscription newsletter","Pop-up","Actif","1 248 vues · 8,4%"],
  ["Bandeau Fête des Mères","Bandeau","Actif","12 420 vues · 6,1%"],
  ["Formulaire diagnostic","Formulaire","Inactif","842 vues · 12,3%"],
  ["Campagne rentrée","Campagne","Actif","5 612 vues · 4,8%"],
];

export default function MarketingPage(){return <AdminWorkspace active="Marketing" title="Marketing & Acquisition" subtitle="Attirez, engagez et fidélisez votre audience avec des outils de campagne simples à piloter." actions={<button className="rounded-lg bg-[#7e3518] px-5 py-2.5 text-sm text-white">+ Créer un élément</button>}>
<div className="grid gap-4 lg:grid-cols-4">{modules.map(([t,b])=><button key={t} className="admin-card admin-shadow p-5 text-left"><div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-[#f4ded0] text-xl">◌</div><h2 className="moony-serif text-2xl">{t}</h2><p className="mt-2 text-sm leading-6 text-[#5b2f22]/55">{b}</p><span className="mt-6 block text-right text-[#8d3b19]">→</span></button>)}</div>
<div className="mt-4"><AdminCard title="Éléments récents" action={<button className="text-xs text-[#8d3b19]">Voir tout</button>}><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="text-[#5b2f22]/45"><tr><th className="pb-3">Nom</th><th>Type</th><th>Statut</th><th>Performances</th><th></th></tr></thead><tbody>{recent.map(r=><tr key={r[0]} className="border-t border-[#5b2f22]/8"><td className="py-4 font-medium">{r[0]}</td><td><span className="rounded-full bg-[#f6e3d9] px-2 py-1">{r[1]}</span></td><td><span className={`rounded-full px-2 py-1 ${r[2]==="Actif"?"bg-emerald-100 text-emerald-800":"bg-zinc-100 text-zinc-600"}`}>{r[2]}</span></td><td>{r[3]}</td><td className="text-right">•••</td></tr>)}</tbody></table></div></AdminCard></div>
</AdminWorkspace>}
