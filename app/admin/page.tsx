const kpis = [
  ["Visiteurs", "—"],
  ["Leads", "—"],
  ["Rendez-vous", "—"],
  ["Clics téléchargement", "—"],
];

const nav = [
  "Dashboard",
  "Site & Design",
  "Pages",
  "Ressources",
  "CRM",
  "Rendez-vous",
  "Marketing",
  "Newsletters",
  "Pop-ups & bandeaux",
  "Chat",
  "Témoignages",
  "Partenaires",
  "Analytics",
  "SEO",
  "Utilisateurs",
  "Paramètres",
];

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-[#f6f3ef] text-[#241a17]">
      <div className="grid min-h-screen lg:grid-cols-[260px_1fr]">
        <aside className="border-r border-black/10 bg-[#2e1c18] p-5 text-white">
          <div className="border-b border-white/10 pb-6">
            <div className="moony-serif text-2xl">MOONY</div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.3em] text-white/50">Control Center</div>
          </div>
          <nav className="mt-6 space-y-1">
            {nav.map((item, index) => (
              <a
                key={item}
                href="#"
                className={`block rounded-xl px-3 py-2.5 text-sm transition ${
                  index === 0 ? "bg-white/10 text-white" : "text-white/65 hover:bg-white/5 hover:text-white"
                }`}
              >
                {item}
              </a>
            ))}
          </nav>
        </aside>

        <section className="p-6 lg:p-10">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-black/50">MOONY Web Studio</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight">Dashboard</h1>
            </div>
            <button className="rounded-xl bg-[#5b2f22] px-4 py-2.5 text-sm font-medium text-white">Voir le site public</button>
          </header>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {kpis.map(([label, value]) => (
              <article key={label} className="rounded-2xl border border-black/10 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,.03)]">
                <p className="text-sm text-black/50">{label}</p>
                <div className="mt-5 text-3xl font-semibold">{value}</div>
                <p className="mt-2 text-xs text-black/40">Connexion analytics à venir</p>
              </article>
            ))}
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.45fr_.75fr]">
            <article className="min-h-[360px] rounded-2xl border border-black/10 bg-white p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">Activité commerciale</h2>
                  <p className="mt-1 text-sm text-black/45">Vue CRM et pipeline</p>
                </div>
                <button className="rounded-lg border border-black/10 px-3 py-2 text-sm">Ouvrir le CRM</button>
              </div>
              <div className="mt-10 grid gap-3 sm:grid-cols-4">
                {["Nouveau", "Contacté", "Proposition", "Signé"].map((stage) => (
                  <div key={stage} className="rounded-xl bg-[#f8f5f1] p-4">
                    <p className="text-sm font-medium">{stage}</p>
                    <div className="mt-10 text-2xl font-semibold">0</div>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-2xl border border-black/10 bg-white p-6">
              <h2 className="font-semibold">Actions rapides</h2>
              <div className="mt-5 space-y-3">
                {["Modifier la page d’accueil", "Créer un article", "Ajouter un prospect", "Créer une pop-up", "Envoyer une newsletter"].map(
                  (action) => (
                    <button key={action} className="w-full rounded-xl border border-black/10 px-4 py-3 text-left text-sm hover:bg-black/[.02]">
                      {action}
                    </button>
                  ),
                )}
              </div>
            </article>
          </div>
        </section>
      </div>
    </main>
  );
}
