import { AdminCard, AdminWorkspace } from "@/components/admin-workspace";

const stages = [
  ["Nouveau", "32 000 €", ["Soleil Maternité", "Teranga Santé"]],
  ["À contacter", "48 000 €", ["MamaCare", "Bloom Women"]],
  ["Contacté", "62 000 €", ["Santé & Elles", "Afrik Santé"]],
  ["RDV planifié", "36 000 €", ["Hope Clinic", "Femina Plus"]],
  ["Proposition envoyée", "28 000 €", ["Care for Her", "Santé Femme"]],
  ["Négociation", "22 000 €", ["Wellness Africa", "Women First"]],
  ["Signé", "104 000 €", ["Maison de la Femme", "Afrique en Santé"]],
  ["Perdu", "14 000 €", ["Santé Plus", "WellBeing Co"]],
] as const;

export default function CRMPage() {
  return <AdminWorkspace active="CRM" title="Commercial & Relation client" subtitle="Pilotez vos opportunités, vos comptes et l’historique complet des échanges commerciaux." actions={<><button className="rounded-lg border border-[#5b2f22]/12 bg-white px-4 py-2.5 text-sm">Importer</button><button className="rounded-lg bg-[#7e3518] px-5 py-2.5 text-sm text-white">+ Ajouter un lead</button></>}>
    <AdminCard title="Pipeline commercial" action={<div className="flex gap-2"><input placeholder="Rechercher un lead…" className="rounded-lg border border-[#5b2f22]/10 bg-white px-3 py-2 text-xs outline-none"/><button className="rounded-lg border border-[#5b2f22]/10 px-3 py-2 text-xs">Tous les responsables</button></div>}>
      <div className="grid gap-2 overflow-x-auto xl:grid-cols-8">{stages.map(([name,total,leads],idx)=><div key={name} className={`min-w-[170px] rounded-xl p-3 ${idx===6?"bg-[#e3f3e8]":idx===7?"bg-[#f8e3e1]":"bg-[#f7eee8]"}`}><p className="text-xs font-semibold">{name}</p><p className="moony-serif mt-1 text-xl">{total}</p><div className="mt-3 space-y-2">{leads.map((lead,i)=><button key={lead} className="w-full rounded-lg bg-white p-3 text-left text-[11px] shadow-sm"><strong className="block">{lead}</strong><span className="mt-1 block text-[#5b2f22]/42">{i?"France":"Sénégal"} · {i?"15 000 €":"12 000 €"}</span></button>)}</div><button className="mt-3 w-full text-[11px] text-[#5b2f22]/55">+ Ajouter un lead</button></div>)}</div>
    </AdminCard>
    <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
      <AdminCard title="Contacts récents"><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-xs"><thead className="text-[#5b2f22]/45"><tr><th className="pb-3">Contact</th><th>Entreprise</th><th>Pays</th><th>Responsable</th><th>Prochaine action</th></tr></thead><tbody>{[["Awa Diop","Hope Clinic","Sénégal","M. Koné","RDV découverte"],["Mariam Diallo","Femina Plus","Côte d’Ivoire","S. Lemoine","Envoyer proposition"],["Claire Dubois","Santé & Elles","France","A. Koné","Relance"]].map(r=><tr key={r[0]} className="border-t border-[#5b2f22]/8"><td className="py-3 font-medium">{r[0]}</td>{r.slice(1).map(v=><td key={v}>{v}</td>)}</tr>)}</tbody></table></div></AdminCard>
      <AdminCard title="Activités à venir"><div className="space-y-3">{["Appel découverte · MamaCare","Relance proposition · Teranga Santé","Présentation entreprise · Women First","Suivi contrat · Maison de la Femme"].map((x,i)=><div key={x} className="flex items-center justify-between rounded-lg border border-[#5b2f22]/8 bg-white px-3 py-3 text-xs"><span>{x}</span><span className="rounded-full bg-[#f4e2d7] px-2 py-1">{31+i} mai</span></div>)}</div></AdminCard>
    </div>
  </AdminWorkspace>;
}
