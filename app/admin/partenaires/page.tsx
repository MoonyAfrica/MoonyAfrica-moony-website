import { AdminCard, AdminWorkspace } from "@/components/admin-workspace";

const partners = [
  ["Fondation Awa","Organisation","Sénégal","Publié"],
  ["Santé & Elles","Organisation","Côte d’Ivoire","Publié"],
  ["MamaCare","Marque","Sénégal","Publié"],
  ["Wellbeing Co","Marque","France","En attente"],
  ["African Women in Tech","Organisation","Pan-africain","Publié"],
  ["ONU Femmes","Institution","International","Publié"],
];

export default function PartnersAdmin(){return <AdminWorkspace active="Partenaires" title="Partenaires" subtitle="Gérez les organisations, marques et institutions affichées sur le site." actions={<button className="rounded-lg bg-[#7e3518] px-5 py-2.5 text-sm text-white">+ Ajouter un partenaire</button>}>
<div className="grid gap-4 xl:grid-cols-[1fr_.8fr]"><AdminCard title="Nos partenaires"><div className="space-y-2">{partners.map(([name,type,country,status])=><div key={name} className="grid gap-3 rounded-xl border border-[#5b2f22]/8 bg-white p-4 text-sm sm:grid-cols-[1.4fr_.7fr_.7fr_auto] sm:items-center"><strong>{name}</strong><span className="text-[#5b2f22]/55">{type}</span><span className="text-[#5b2f22]/55">{country}</span><span className={`rounded-full px-3 py-1 text-xs ${status==="Publié"?"bg-emerald-100 text-emerald-800":"bg-amber-100 text-amber-800"}`}>{status}</span></div>)}</div></AdminCard><AdminCard title="Bannière partenaires"><div className="rounded-xl border border-[#5b2f22]/10 bg-[#f7ebe3] p-8 text-center"><p className="text-xs uppercase tracking-[.2em] text-[#5b2f22]/45">Ils nous font confiance</p><div className="mt-6 grid grid-cols-3 gap-3">{[1,2,3,4,5,6].map(i=><div key={i} className="grid h-20 place-items-center rounded-lg bg-white text-xs text-[#5b2f22]/40">Logo {i}</div>)}</div><button className="mt-6 rounded-lg border border-[#5b2f22]/15 bg-white px-4 py-2 text-xs">Modifier la bannière</button></div></AdminCard></div>
</AdminWorkspace>}
