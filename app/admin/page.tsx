import { AdminShell } from "@/components/admin-shell";

const kpis = [
  ["Visites du site", "28 456", "+12%"],
  ["Clics téléchargement", "4 892", "+18%"],
  ["Leads générés", "1 204", "+22%"],
  ["RDV pris", "186", "+14%"],
  ["Taux de conversion", "4,2%", "+0,8 pt"],
];

const pipeline = [
  { name: "Nouveau", total: "32 000 €", tone: "bg-[#f7eee8]", leads: [["Soleil Maternité", "Sénégal"], ["Teranga Santé", "Côte d’Ivoire"], ["Wellness Africa", "Maroc"]] },
  { name: "À contacter", total: "48 000 €", tone: "bg-[#f7eee8]", leads: [["MamaCare", "France"], ["Bloom Women", "Belgique"], ["Santé & Elles", "Cameroun"]] },
  { name: "Contacté", total: "62 000 €", tone: "bg-[#f8efe6]", leads: [["Afrik Santé", "Tunisie"], ["Femina Plus", "Sénégal"], ["Care for Her", "Rwanda"]] },
  { name: "RDV planifié", total: "36 000 €", tone: "bg-[#fbf0dd]", leads: [["Hope Clinic", "Côte d’Ivoire"], ["Women First", "France"]] },
  { name: "Proposition envoyée", total: "28 000 €", tone: "bg-[#fbf0dd]", leads: [["Santé Femme", "Maroc"], ["Nabou Health", "Sénégal"]] },
  { name: "Négociation", total: "22 000 €", tone: "bg-[#f7e8cc]", leads: [["Wellness Africa", "Maroc"], ["Women First", "France"]] },
  { name: "Gagné / Signé", total: "104 000 €", tone: "bg-[#e4f3e8]", leads: [["Maison de la Femme", "Côte d’Ivoire"], ["Afrique en Santé", "Sénégal"]] },
  { name: "Perdu", total: "14 000 €", tone: "bg-[#f8e4e2]", leads: [["Santé Plus", "Algérie"], ["WellBeing Co", "Canada"]] },
];

const recentRequests = [
  ["Awa Diop", "Partenariat", "Sénégal", "Nouveau"],
  ["Marie Koffi", "Demande d’info", "Côte d’Ivoire", "Traité"],
  ["Fatou Bâ", "Rendez-vous", "France", "RDV planifié"],
  ["Claire Dubois", "Partenariat", "Belgique", "Nouveau"],
];

const reminders = [
  ["31 mai", "RDV avec Dr. Kouassi", "Clinique Sainte-Marie"],
  ["31 mai", "Relance proposition", "Teranga Santé"],
  ["1 juin", "Appel découverte", "MamaCare"],
  ["2 juin", "Préparer présentation", "Women First"],
];

export default function AdminDashboard() {
  return (
    <AdminShell active="Dashboard">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="moony-serif text-4xl tracking-[-.035em] text-[#5b2f22]">Bonjour Aïssata ☀</h1>
          <p className="mt-1 text-sm text-[#5b2f22]/50">Voici un aperçu des performances de MOONY. Tout est réuni pour faire rayonner notre mission.</p>
        </div>
        <div className="flex gap-3">
          <button className="rounded-lg border border-[#5b2f22]/12 bg-white px-4 py-2.5 text-sm">1 mai 2024 – 31 mai 2024</button>
          <button className="rounded-lg bg-[#7e3518] px-5 py-2.5 text-sm font-medium text-white">+ Créer</button>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {kpis.map(([label, value, delta]) => (
          <article key={label} className="admin-card admin-shadow p-5">
            <p className="text-xs text-[#5b2f22]/52">{label}</p>
            <div className="mt-3 flex items-end justify-between gap-2">
              <strong className="moony-serif text-3xl font-normal">{value}</strong>
              <span className="text-xs font-semibold text-emerald-700">↗ {delta}</span>
            </div>
            <p className="mt-1 text-[10px] text-[#5b2f22]/36">vs mois précédent</p>
          </article>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.45fr_.75fr]">
        <article className="admin-card admin-shadow p-5">
          <div className="flex items-center justify-between">
            <div><h2 className="moony-serif text-2xl">Performance du site</h2><p className="text-xs text-[#5b2f22]/45">Visites et leads</p></div>
            <button className="rounded-md border border-[#5b2f22]/10 px-3 py-2 text-xs">30 derniers jours</button>
          </div>
          <div className="mt-5 h-64 rounded-lg border border-[#5b2f22]/8 bg-[#fffdf9] p-4">
            <svg viewBox="0 0 800 250" className="h-full w-full" role="img" aria-label="Courbe de visites du site">
              {[40,80,120,160,200].map(y => <line key={y} x1="0" x2="800" y1={y} y2={y} stroke="#eadfd8" strokeWidth="1" />)}
              <polyline fill="none" stroke="#8a3d20" strokeWidth="4" points="0,210 70,188 130,170 190,166 245,138 305,155 360,122 420,105 475,130 530,115 590,133 650,96 710,72 800,42" />
              <polyline fill="none" stroke="#e4b19c" strokeWidth="3" points="0,225 70,214 130,210 190,205 245,200 305,198 360,185 420,175 475,183 530,170 590,176 650,160 710,150 800,138" />
            </svg>
          </div>
        </article>

        <article className="admin-card admin-shadow p-5">
          <div className="flex items-center justify-between"><h2 className="moony-serif text-2xl">Audience par pays</h2><button className="text-xs text-[#8d3b19]">Voir tout</button></div>
          <div className="mt-5 rounded-xl bg-[#f7eee8] p-5"><div className="mx-auto grid h-40 place-items-center rounded-[45%] border border-[#5b2f22]/10 text-center text-xs text-[#5b2f22]/55">Carte de l’audience<br />agrégée</div></div>
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">{[["Côte d’Ivoire","28%"],["France","18%"],["Sénégal","12%"],["États-Unis","8%"],["Cameroun","7%"],["Canada","6%"]].map(([c,v]) => <div key={c} className="flex justify-between border-b border-[#5b2f22]/8 py-1.5"><span>{c}</span><strong>{v}</strong></div>)}</div>
        </article>
      </div>

      <article className="admin-card admin-shadow mt-4 p-4">
        <div className="mb-3 flex items-center justify-between"><h2 className="moony-serif text-2xl">Pipeline commercial</h2><button className="text-xs text-[#8d3b19]">Voir tous les leads</button></div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {pipeline.map(col => (
            <div key={col.name} className={`${col.tone} min-w-[190px] flex-1 rounded-xl p-3`}>
              <div className="mb-3"><p className="text-xs font-semibold">{col.name}</p><strong className="moony-serif text-xl font-normal">{col.total}</strong></div>
              <div className="space-y-2">{col.leads.map(([lead, country]) => <div key={lead} className="rounded-lg bg-white px-3 py-2 text-[11px] shadow-sm"><strong className="block">{lead}</strong><span className="text-[#5b2f22]/45">{country}</span></div>)}</div>
              <button className="mt-3 w-full text-center text-[11px] text-[#5b2f22]/55">+ Ajouter un lead</button>
            </div>
          ))}
        </div>
      </article>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_1fr_1fr_1fr]">
        <article className="admin-card admin-shadow p-4">
          <div className="flex items-center justify-between"><h3 className="moony-serif text-xl">Demandes récentes</h3><button className="text-[10px] text-[#8d3b19]">Voir toutes</button></div>
          <div className="mt-3 space-y-1">{recentRequests.map(([name, type, country, status]) => <div key={name} className="grid grid-cols-[1.1fr_1fr_.8fr_auto] gap-2 border-b border-[#5b2f22]/8 py-2 text-[10px]"><strong>{name}</strong><span>{type}</span><span className="text-[#5b2f22]/50">{country}</span><span className="rounded-full bg-[#f4e6dd] px-2 py-1">{status}</span></div>)}</div>
        </article>

        <article className="admin-card admin-shadow p-4">
          <div className="flex items-center justify-between"><h3 className="moony-serif text-xl">Campagnes & newsletter</h3><button className="text-[10px] text-[#8d3b19]">Voir toutes</button></div>
          <div className="mt-4 rounded-xl bg-[#f7eee8] p-4"><p className="text-[10px] uppercase tracking-[.16em] text-[#9a5837]">Newsletter</p><h4 className="moony-serif mt-1 text-lg">Santé des femmes : ensemble pour demain</h4><div className="mt-4 grid grid-cols-3 gap-2 text-center text-[10px]"><div><strong className="block text-base">12 480</strong>destinataires</div><div><strong className="block text-base">28,4%</strong>ouvertures</div><div><strong className="block text-base">4,1%</strong>clics</div></div></div>
        </article>

        <article className="admin-card admin-shadow p-4">
          <div className="flex items-center justify-between"><h3 className="moony-serif text-xl">Rappels commerciaux</h3><button className="text-[10px] text-[#8d3b19]">Voir tous</button></div>
          <div className="mt-3 space-y-2">{reminders.map(([date, title, company]) => <div key={`${date}-${title}`} className="flex gap-3 border-b border-[#5b2f22]/8 pb-2 text-[10px]"><span className="w-12 rounded-md bg-[#f4e6dd] px-2 py-1 text-center font-semibold">{date}</span><div><strong className="block">{title}</strong><span className="text-[#5b2f22]/45">{company}</span></div></div>)}</div>
        </article>

        <article className="admin-card admin-shadow p-4">
          <div className="flex items-center justify-between"><h3 className="moony-serif text-xl">Partenaires & témoignages</h3><button className="text-[10px] text-[#8d3b19]">Voir tout</button></div>
          <div className="mt-3 space-y-2">{[["Fondation Awa","Publié"],["Santé & Elles","Publié"],["MamaCare","En attente"],["Afrique en Santé","Publié"]].map(([name,status]) => <div key={name} className="flex items-center justify-between border-b border-[#5b2f22]/8 pb-2 text-[10px]"><strong>{name}</strong><span className={`rounded-full px-2 py-1 ${status === "Publié" ? "bg-[#e4f3e8] text-emerald-800" : "bg-[#fbf0dd]"}`}>{status}</span></div>)}</div>
        </article>
      </div>
    </AdminShell>
  );
}
