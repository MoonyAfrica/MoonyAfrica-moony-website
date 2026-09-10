import { AdminCard, AdminWorkspace } from "@/components/admin-workspace";

const tickets = [
  ["#1562","Demande","Accès à la plateforme","Awa Traoré","Haute","En cours","S. Lemoine","Il y a 2 heures"],
  ["#1561","Signalement","Problème de paiement","Fatou Bâ","Haute","Ouvert","A. Koné","Il y a 5 heures"],
  ["#1560","Question","Informations sur un programme","Ndeye Sall","Moyenne","Répondu","M. Diallo","Il y a 1 jour"],
  ["#1559","Demande","Modification de mes informations","Claire Dubois","Basse","Résolu","S. Lemoine","Il y a 2 jours"],
  ["#1558","Réclamation","Retard de livraison","Aminata Koné","Haute","En cours","M. Diallo","Il y a 2 jours"],
];

export default function ServiceClientPage(){return <AdminWorkspace active="Service client" title="Service client" subtitle="Suivez et traitez toutes les demandes, questions, réclamations et signalements reçus depuis le site." actions={<button className="rounded-lg bg-[#7e3518] px-5 py-2.5 text-sm text-white">+ Nouveau ticket</button>}>
<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[["Tickets ouverts","32"],["Priorité haute","7"],["Temps moyen de réponse","2 h 14"],["Satisfaction","94%"]].map(([l,v])=><div key={l} className="admin-card admin-shadow p-5"><p className="text-xs text-[#5b2f22]/45">{l}</p><p className="moony-serif mt-2 text-4xl">{v}</p></div>)}</div>
<div className="mt-4"><AdminCard title="Boîte de réception" action={<div className="flex gap-2"><input placeholder="Rechercher un ticket…" className="rounded-lg border border-[#5b2f22]/10 px-3 py-2 text-xs"/><button className="rounded-lg border border-[#5b2f22]/10 px-3 py-2 text-xs">Filtrer</button></div>}><div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-xs"><thead className="text-[#5b2f22]/45"><tr>{["#","Type","Sujet","Client / Contact","Priorité","Statut","Assigné à","Dernière réponse"].map(h=><th key={h} className="pb-3">{h}</th>)}</tr></thead><tbody>{tickets.map(r=><tr key={r[0]} className="border-t border-[#5b2f22]/8">{r.map((v,i)=><td key={v} className={`py-3 ${i===2||i===3?"font-medium":""}`}>{i===4?<span className={`rounded-full px-2 py-1 ${v==="Haute"?"bg-red-100 text-red-700":v==="Moyenne"?"bg-amber-100 text-amber-800":"bg-emerald-100 text-emerald-800"}`}>{v}</span>:i===5?<span className="rounded-full bg-[#e8eefb] px-2 py-1 text-blue-700">{v}</span>:v}</td>)}</tr>)}</tbody></table></div></AdminCard></div>
</AdminWorkspace>}
