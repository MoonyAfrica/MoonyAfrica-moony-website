import { AdminCard, AdminWorkspace } from "@/components/admin-workspace";

const items = [
  ["Inscription newsletter","Pop-up","Actif","Homepage + Ressources","8,4%"],
  ["Télécharger MOONY","Pop-up","Actif","Toutes les pages","12,1%"],
  ["Campagne partenaires","Bandeau","Programmé","Homepage","—"],
  ["Demander une démo","Formulaire","Actif","Services entreprises","18,6%"],
];

export default function PopupsPage(){return <AdminWorkspace active="Pop-ups & bandeaux" title="Pop-ups & bandeaux" subtitle="Créez des points de contact contextuels sans alourdir l’expérience du site." actions={<button className="rounded-lg bg-[#7e3518] px-5 py-2.5 text-sm text-white">+ Nouveau contenu</button>}>
<div className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]"><AdminCard title="Éléments actifs"><div className="space-y-3">{items.map(r=><div key={r[0]} className="grid gap-2 rounded-xl border border-[#5b2f22]/8 bg-white p-4 text-xs sm:grid-cols-[1.2fr_.6fr_.5fr_1fr_.4fr] sm:items-center"><strong>{r[0]}</strong><span>{r[1]}</span><span className="rounded-full bg-emerald-100 px-2 py-1 text-center text-emerald-800">{r[2]}</span><span>{r[3]}</span><span className="font-semibold">{r[4]}</span></div>)}</div></AdminCard><AdminCard title="Aperçu"><div className="relative min-h-[420px] overflow-hidden rounded-xl bg-[#c98963] p-8"><div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(81,34,19,.35),rgba(81,34,19,.08))]"/><div className="relative ml-auto mt-28 max-w-sm rounded-2xl bg-[#fff9f3] p-6 shadow-xl"><button className="float-right text-[#5b2f22]/40">×</button><p className="text-xs uppercase tracking-[.2em] text-[#8d5b47]">Entre Elles</p><h3 className="moony-serif mt-2 text-3xl">Rejoignez notre communauté de femmes.</h3><p className="mt-3 text-sm text-[#5b2f22]/65">Recevez nos ressources et les nouveautés MOONY.</p><input placeholder="Votre adresse email" className="mt-5 w-full rounded-full border border-[#5b2f22]/15 px-4 py-3 text-sm"/><button className="mt-3 w-full rounded-full bg-[#7e3518] px-4 py-3 text-sm text-white">Je m’inscris</button></div></div></AdminCard></div>
</AdminWorkspace>}
