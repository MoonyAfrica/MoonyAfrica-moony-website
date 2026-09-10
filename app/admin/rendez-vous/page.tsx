import { AdminCard, AdminWorkspace } from "@/components/admin-workspace";

const rows = [
  ["3 juin 2024","10:00","Hope Clinic","Awa Diop","Découverte","Calendly","Confirmé","M. Koné"],
  ["5 juin 2024","14:30","Femina Plus","Mariama Diallo","Présentation","Formulaire site","Confirmé","S. Lemoine"],
  ["7 juin 2024","11:00","Santé & Elles","Claire Dubois","Suivi","WhatsApp","En attente","A. Koné"],
  ["10 juin 2024","15:00","Afrik Santé","Yasmine Ben Ali","Négociation","Calendly","Confirmé","S. Lemoine"],
];

export default function AppointmentsPage(){return <AdminWorkspace active="Rendez-vous" title="Rendez-vous" subtitle="Centralisez les rendez-vous issus du site, de Calendly et de WhatsApp, puis rattachez-les au CRM." actions={<button className="rounded-lg bg-[#7e3518] px-5 py-2.5 text-sm text-white">+ Planifier un rendez-vous</button>}>
<AdminCard title="Agenda commercial" action={<button className="rounded-lg border border-[#5b2f22]/10 px-3 py-2 text-xs">Synchronisations</button>}><div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-xs"><thead className="text-[#5b2f22]/45"><tr>{["Date","Heure","Entreprise","Contact","Type","Source","Statut","Responsable"].map(h=><th key={h} className="pb-3">{h}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r[0]+r[1]} className="border-t border-[#5b2f22]/8">{r.map((v,i)=><td key={v} className={`py-3 ${i===2||i===3?"font-medium":""}`}>{i===6?<span className={`rounded-full px-2 py-1 ${v==="Confirmé"?"bg-emerald-100 text-emerald-800":"bg-amber-100 text-amber-800"}`}>{v}</span>:v}</td>)}</tr>)}</tbody></table></div></AdminCard>
<div className="mt-4 grid gap-4 lg:grid-cols-3"><AdminCard title="Aujourd’hui"><p className="moony-serif text-5xl">6</p><p className="mt-2 text-sm text-[#5b2f22]/50">rendez-vous planifiés</p></AdminCard><AdminCard title="Cette semaine"><p className="moony-serif text-5xl">24</p><p className="mt-2 text-sm text-[#5b2f22]/50">dont 18 confirmés</p></AdminCard><AdminCard title="No-show"><p className="moony-serif text-5xl">3,4%</p><p className="mt-2 text-sm text-[#5b2f22]/50">sur les 30 derniers jours</p></AdminCard></div>
</AdminWorkspace>}
