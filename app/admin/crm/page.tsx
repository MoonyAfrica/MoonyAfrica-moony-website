import { AdminCard, AdminWorkspace } from "@/components/admin-workspace";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type Lead = {
  id: string;
  created_at: string;
  first_name: string;
  last_name: string;
  email: string;
  company: string | null;
  status: "new" | "to_contact" | "contacted" | "appointment" | "proposal" | "negotiation" | "won" | "lost";
  deal_value: number | null;
  country: string | null;
  assigned_to: string | null;
  need: string;
};

const stageConfig = [
  ["new", "Nouveau"],
  ["to_contact", "À contacter"],
  ["contacted", "Contacté"],
  ["appointment", "RDV planifié"],
  ["proposal", "Proposition envoyée"],
  ["negotiation", "Négociation"],
  ["won", "Signé"],
  ["lost", "Perdu"],
] as const;

const fallbackLeads: Lead[] = [
  { id: "demo-1", created_at: new Date().toISOString(), first_name: "Awa", last_name: "Diop", email: "awa@example.com", company: "Soleil Maternité", status: "new", deal_value: 12000, country: "Sénégal", assigned_to: "A. Koné", need: "entreprise" },
  { id: "demo-2", created_at: new Date().toISOString(), first_name: "Fatou", last_name: "Bâ", email: "fatou@example.com", company: "MamaCare", status: "to_contact", deal_value: 15000, country: "Côte d’Ivoire", assigned_to: "M. Koné", need: "partenariat" },
  { id: "demo-3", created_at: new Date().toISOString(), first_name: "Claire", last_name: "Dubois", email: "claire@example.com", company: "Santé & Elles", status: "contacted", deal_value: 10000, country: "France", assigned_to: "S. Lemoine", need: "professionnel" },
  { id: "demo-4", created_at: new Date().toISOString(), first_name: "Mariam", last_name: "Diallo", email: "mariam@example.com", company: "Femina Plus", status: "appointment", deal_value: 18000, country: "Sénégal", assigned_to: "A. Koné", need: "demonstration" },
  { id: "demo-5", created_at: new Date().toISOString(), first_name: "Yasmine", last_name: "Ben Ali", email: "yasmine@example.com", company: "Care for Her", status: "proposal", deal_value: 12000, country: "Maroc", assigned_to: "M. Koné", need: "entreprise" },
  { id: "demo-6", created_at: new Date().toISOString(), first_name: "Emily", last_name: "Johnson", email: "emily@example.com", company: "Women First", status: "negotiation", deal_value: 22000, country: "Canada", assigned_to: "S. Lemoine", need: "partenariat" },
  { id: "demo-7", created_at: new Date().toISOString(), first_name: "Ndeye", last_name: "Sall", email: "ndeye@example.com", company: "Maison de la Femme", status: "won", deal_value: 35000, country: "Côte d’Ivoire", assigned_to: "A. Koné", need: "entreprise" },
  { id: "demo-8", created_at: new Date().toISOString(), first_name: "Sarah", last_name: "Plus", email: "sarah@example.com", company: "Santé Plus", status: "lost", deal_value: 8000, country: "Algérie", assigned_to: "M. Koné", need: "professionnel" },
];

function money(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

async function loadLeads() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { leads: fallbackLeads, live: false };

  const { data, error } = await supabase
    .from("website_leads")
    .select("id,created_at,first_name,last_name,email,company,status,deal_value,country,assigned_to,need")
    .order("created_at", { ascending: false })
    .limit(80);

  if (error) {
    console.error("MOONY CRM load failed", error);
    return { leads: fallbackLeads, live: false };
  }

  return { leads: (data ?? []) as Lead[], live: true };
}

export default async function CRMPage() {
  const { leads, live } = await loadLeads();

  return (
    <AdminWorkspace
      active="CRM"
      title="Commercial & Relation client"
      subtitle="Pilotez vos opportunités, vos comptes et l’historique complet des échanges commerciaux."
      actions={<><button className="rounded-lg border border-[#5b2f22]/12 bg-white px-4 py-2.5 text-sm">Importer</button><button className="rounded-lg bg-[#7e3518] px-5 py-2.5 text-sm text-white">+ Ajouter un lead</button></>}
    >
      <div className="mb-4 flex items-center justify-between rounded-xl border border-[#5b2f22]/9 bg-white/70 px-4 py-3 text-xs">
        <span className="text-[#5b2f22]/58">Source des données CRM</span>
        <span className={`rounded-full px-3 py-1 font-semibold ${live ? "bg-[#e4f3e8] text-emerald-700" : "bg-[#f6e7dc] text-[#8d4b32]"}`}>{live ? "Base connectée" : "Données de démonstration"}</span>
      </div>

      <AdminCard title="Pipeline commercial" action={<div className="flex gap-2"><input placeholder="Rechercher un lead…" className="rounded-lg border border-[#5b2f22]/10 bg-white px-3 py-2 text-xs outline-none"/><button className="rounded-lg border border-[#5b2f22]/10 px-3 py-2 text-xs">Tous les responsables</button></div>}>
        <div className="grid gap-2 overflow-x-auto xl:grid-cols-8">
          {stageConfig.map(([status, label], index) => {
            const stageLeads = leads.filter((lead) => lead.status === status);
            const total = stageLeads.reduce((sum, lead) => sum + Number(lead.deal_value ?? 0), 0);
            return (
              <div key={status} className={`min-w-[170px] rounded-xl p-3 ${index === 6 ? "bg-[#e3f3e8]" : index === 7 ? "bg-[#f8e3e1]" : index === 3 || index === 4 || index === 5 ? "bg-[#fbf0dd]" : "bg-[#f7eee8]"}`}>
                <div className="flex items-start justify-between gap-2"><div><p className="text-xs font-semibold">{label} <span className="font-normal text-[#5b2f22]/42">({stageLeads.length})</span></p><p className="moony-serif mt-1 text-xl">{money(total)}</p></div><button className="text-[#5b2f22]/35">•••</button></div>
                <div className="mt-3 space-y-2">
                  {stageLeads.length ? stageLeads.map((lead) => (
                    <button key={lead.id} className="w-full rounded-lg bg-white p-3 text-left text-[11px] shadow-sm">
                      <strong className="block truncate">{lead.company || `${lead.first_name} ${lead.last_name}`}</strong>
                      <span className="mt-1 block truncate text-[#5b2f22]/42">{lead.country || "Pays non renseigné"} · {money(Number(lead.deal_value ?? 0))}</span>
                      <span className="mt-2 block truncate text-[#8d4b32]">{lead.first_name} {lead.last_name}</span>
                    </button>
                  )) : <div className="rounded-lg border border-dashed border-[#5b2f22]/14 px-3 py-6 text-center text-[10px] text-[#5b2f22]/38">Aucune opportunité</div>}
                </div>
                <button className="mt-3 w-full text-[11px] text-[#5b2f22]/55">+ Ajouter un lead</button>
              </div>
            );
          })}
        </div>
      </AdminCard>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
        <AdminCard title="Contacts récents">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="text-[#5b2f22]/45"><tr><th className="pb-3">Contact</th><th>Entreprise</th><th>Pays</th><th>Responsable</th><th>Besoin</th><th>Statut</th></tr></thead>
              <tbody>{leads.slice(0, 8).map((lead) => <tr key={lead.id} className="border-t border-[#5b2f22]/8"><td className="py-3 font-medium">{lead.first_name} {lead.last_name}<span className="block text-[10px] font-normal text-[#5b2f22]/38">{lead.email}</span></td><td>{lead.company || "—"}</td><td>{lead.country || "—"}</td><td>{lead.assigned_to || "Non assigné"}</td><td>{lead.need}</td><td><span className="rounded-full bg-[#f3e4d9] px-2 py-1">{stageConfig.find(([key]) => key === lead.status)?.[1] ?? lead.status}</span></td></tr>)}</tbody>
            </table>
          </div>
        </AdminCard>

        <AdminCard title="Vue commerciale">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-xl bg-[#f7eee8] p-4"><span className="text-xs text-[#5b2f22]/48">Leads enregistrés</span><strong className="moony-serif mt-2 block text-3xl font-normal">{leads.length}</strong></div>
            <div className="rounded-xl bg-[#eef6ef] p-4"><span className="text-xs text-[#5b2f22]/48">Opportunités gagnées</span><strong className="moony-serif mt-2 block text-3xl font-normal">{leads.filter((lead) => lead.status === "won").length}</strong></div>
            <div className="rounded-xl bg-[#f8eee7] p-4"><span className="text-xs text-[#5b2f22]/48">Valeur totale du pipeline</span><strong className="moony-serif mt-2 block text-3xl font-normal">{money(leads.filter((lead) => lead.status !== "lost").reduce((sum, lead) => sum + Number(lead.deal_value ?? 0), 0))}</strong></div>
          </div>
        </AdminCard>
      </div>
    </AdminWorkspace>
  );
}
