const navItems = [
  "Accueil",
  "Notre mission",
  "Notre approche",
  "À propos",
  "Nos services",
  "Communauté",
  "Ressources",
];

export default function HomePage() {
  return (
    <main className="min-h-screen moony-paper">
      <header className="sticky top-0 z-50 border-b border-[var(--moony-border)] bg-[rgba(247,240,230,0.92)] backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-5 lg:px-10">
          <a href="#accueil" className="flex items-center gap-3" aria-label="MOONY Africa - Accueil">
            <div className="grid h-11 w-11 place-items-center rounded-full border border-[var(--moony-brown)] text-sm font-semibold tracking-[0.18em] text-[var(--moony-brown)]">
              M
            </div>
            <div>
              <div className="moony-serif text-2xl leading-none text-[var(--moony-brown)]">MOONY</div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.32em] text-[var(--moony-brown)]/70">Africa</div>
            </div>
          </a>

          <nav className="hidden items-center gap-7 text-sm text-[var(--moony-brown)] lg:flex">
            {navItems.map((item) => (
              <a key={item} href={item === "Accueil" ? "#accueil" : "#"} className="transition-opacity hover:opacity-60">
                {item}
              </a>
            ))}
          </nav>

          <a
            href="#contact"
            className="rounded-full bg-[var(--moony-brown)] px-5 py-3 text-sm font-medium text-white transition-transform hover:-translate-y-0.5"
          >
            Prendre rendez-vous
          </a>
        </div>
      </header>

      <section id="accueil" className="mx-auto grid min-h-[760px] max-w-[1440px] items-center gap-12 px-6 py-16 lg:grid-cols-[0.92fr_1.08fr] lg:px-10 lg:py-24">
        <div className="max-w-2xl">
          <p className="mb-7 text-xs font-semibold uppercase tracking-[0.3em] text-[var(--moony-terracotta)]">
            Santé féminine • Afrique • Transmission
          </p>
          <h1 className="moony-serif text-5xl leading-[0.98] tracking-[-0.04em] text-[var(--moony-brown)] sm:text-6xl lg:text-7xl xl:text-[88px]">
            Ancrée dans nos cultures,
            <br />
            tournée vers l’avenir.
          </h1>
          <p className="mt-8 max-w-xl text-lg leading-8 text-[var(--moony-espresso)]/75">
            MOONY accompagne les femmes à chaque étape de leur vie avec une approche humaine, accessible, scientifique et profondément connectée aux réalités du continent africain.
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <a href="#" className="rounded-full bg-[var(--moony-brown)] px-6 py-3.5 text-sm font-semibold text-white">
              Découvrir MOONY
            </a>
            <a href="#services" className="rounded-full border border-[var(--moony-brown)] px-6 py-3.5 text-sm font-semibold text-[var(--moony-brown)]">
              Nos services
            </a>
          </div>

          <div className="mt-14 flex flex-wrap gap-x-8 gap-y-3 border-t border-[var(--moony-border)] pt-6 text-sm text-[var(--moony-brown)]/70">
            <span>Pour les utilisatrices</span>
            <span>Pour les professionnels</span>
            <span>Pour les organisations</span>
          </div>
        </div>

        <div className="relative min-h-[560px] overflow-hidden rounded-[36px] border border-[var(--moony-border)] bg-[var(--moony-cream)] p-5 sm:p-8">
          <div className="absolute inset-0 opacity-60 [background:radial-gradient(circle_at_70%_20%,rgba(183,111,75,.22),transparent_32%),radial-gradient(circle_at_20%_80%,rgba(223,169,135,.28),transparent_34%)]" />
          <div className="relative flex h-full min-h-[500px] flex-col justify-between rounded-[28px] border border-white/50 bg-[rgba(255,253,250,0.32)] p-6 sm:p-8">
            <div className="flex items-start justify-between">
              <span className="rounded-full border border-[var(--moony-brown)]/20 bg-white/50 px-4 py-2 text-xs uppercase tracking-[0.22em] text-[var(--moony-brown)]">
                MOONY Africa
              </span>
              <span className="moony-serif text-5xl text-[var(--moony-brown)]/25">01</span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <article className="rounded-[24px] bg-[var(--moony-brown)] p-6 text-white sm:translate-y-8">
                <p className="text-xs uppercase tracking-[0.22em] text-white/65">Sororité</p>
                <p className="moony-serif mt-12 text-3xl leading-tight">Des parcours différents. Une même exigence de soin.</p>
              </article>
              <article className="rounded-[24px] bg-[var(--moony-white)] p-6 text-[var(--moony-brown)] shadow-sm">
                <p className="text-xs uppercase tracking-[0.22em] text-[var(--moony-brown)]/55">Transmission</p>
                <div className="mt-10 space-y-3">
                  <div className="h-2 w-4/5 rounded-full bg-[var(--moony-peach)]/70" />
                  <div className="h-2 w-full rounded-full bg-[var(--moony-terracotta)]/35" />
                  <div className="h-2 w-3/5 rounded-full bg-[var(--moony-brown)]/20" />
                </div>
                <p className="mt-8 text-sm leading-6 text-[var(--moony-espresso)]/70">
                  Cette zone accueillera la photographie éditoriale validée pour la homepage dès que les assets de marque seront ajoutés au repository.
                </p>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section id="services" className="border-y border-[var(--moony-border)] bg-[var(--moony-white)]/55">
        <div className="mx-auto grid max-w-[1440px] gap-10 px-6 py-20 lg:grid-cols-3 lg:px-10">
          {["Utilisatrices", "Professionnels", "Entreprises"].map((title, index) => (
            <article key={title} className="border-t border-[var(--moony-border)] pt-6">
              <div className="mb-10 text-xs uppercase tracking-[0.22em] text-[var(--moony-terracotta)]">0{index + 1}</div>
              <h2 className="moony-serif text-4xl text-[var(--moony-brown)]">{title}</h2>
              <p className="mt-5 max-w-sm leading-7 text-[var(--moony-espresso)]/70">
                {index === 0
                  ? "Un accès gratuit pensé pour accompagner la santé des femmes au quotidien."
                  : index === 1
                    ? "Un espace professionnel structuré autour du suivi, des rendez-vous et de la téléconsultation."
                    : "Des solutions adaptées aux organisations, avec une tarification personnalisée selon les besoins."}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section id="contact" className="mx-auto max-w-[1440px] px-6 py-24 lg:px-10">
        <div className="rounded-[32px] bg-[var(--moony-brown)] px-8 py-14 text-white sm:px-12 lg:flex lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.25em] text-white/60">MOONY Africa</p>
            <h2 className="moony-serif mt-5 text-4xl sm:text-5xl">Pour la santé des femmes, à chaque étape de leur vie.</h2>
          </div>
          <a href="#" className="mt-8 inline-flex rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-[var(--moony-brown)] lg:mt-0">
            Nous contacter
          </a>
        </div>
      </section>
    </main>
  );
}
