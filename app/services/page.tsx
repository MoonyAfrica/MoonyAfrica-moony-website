import { PublicHeader } from "@/components/public-header";

const userServices = ["Suivi menstruel", "Grossesse & post-partum", "Santé féminine & bien-être", "Éducation & contenus fiables", "Communauté Entre Elles", "Professionnelles & rendez-vous", "Coffre santé sécurisé"];
const plans = [
  { name: "Abonnement mensuel", price: "15 000 FCFA", unit: "/ mois", featured: false },
  { name: "Abonnement trimestriel", price: "42 000 FCFA", unit: "/ trimestre", featured: true },
  { name: "Abonnement semestriel", price: "75 000 FCFA", unit: "/ 6 mois", featured: false },
  { name: "Abonnement annuel", price: "150 000 FCFA", unit: "/ an", featured: false },
];
const benefits = ["Profil professionnel vérifié", "Prise de rendez-vous en ligne", "Agenda et gestion des consultations", "Téléconsultation (commission 3%)", "Messagerie sécurisée", "Statistiques et suivi d’activité", "Badge Professionnel MOONY"];

export default function ServicesPage() {
  return (
    <main className="min-h-screen bg-[#fbf5ee] text-[#5b2f22]">
      <section className="relative overflow-hidden border-b border-[#5b2f22]/10 bg-[linear-gradient(100deg,#fbf5ee_0%,#f2dfcc_64%,#c9865b_100%)] pt-36">
        <PublicHeader active="Nos services" />
        <div className="mx-auto max-w-[1500px] px-6 pb-10 lg:px-12">
          <p className="text-xs font-semibold uppercase tracking-[.35em] text-[#a45b35]">Nos services</p>
          <h1 className="moony-serif mt-3 max-w-[800px] text-5xl leading-[.98] tracking-[-.045em] sm:text-6xl lg:text-7xl">Des solutions pensées pour chaque étape de la vie</h1>
          <p className="mt-5 max-w-[770px] text-[17px] leading-7 text-[#5b2f22]/75">Prévention, accompagnement, soins et bien-être : MOONY réunit des services utiles, accessibles et fiables pour les femmes, les professionnelles de santé et les entreprises.</p>
        </div>
      </section>

      <section className="border-b border-[#5b2f22]/10 bg-white/45">
        <div className="mx-auto max-w-[1500px] px-6 py-8 lg:px-12">
          <div className="flex flex-col gap-7 xl:flex-row xl:items-center">
            <div className="min-w-[300px]">
              <h2 className="moony-serif text-4xl">Pour les utilisatrices</h2>
              <p className="mt-1 text-[#5b2f22]/70">Un accès gratuit, pour toutes les femmes.</p>
            </div>
            <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
              {userServices.map((item) => <div key={item} className="rounded-2xl bg-[#f8e9dc] px-4 py-5 text-center text-sm leading-5">{item}</div>)}
            </div>
            <div className="rounded-2xl bg-[#f4dfd0] px-7 py-5 text-center"><strong className="moony-serif block text-2xl">Gratuit</strong><span className="text-sm">Pour toutes les utilisatrices</span></div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1500px] px-6 py-10 lg:px-12">
        <h2 className="moony-serif text-4xl">Pour les professionnels de santé</h2>
        <p className="mt-1 text-[#5b2f22]/70">Des abonnements flexibles pour développer votre activité et mieux accompagner vos patientes.</p>
        <div className="mt-6 grid gap-5 xl:grid-cols-4">
          {plans.map((plan) => (
            <article key={plan.name} className={`relative rounded-2xl border bg-white/70 p-7 ${plan.featured ? "border-[#d97b50] shadow-[0_14px_38px_rgba(112,50,27,.08)]" : "border-[#5b2f22]/12"}`}>
              {plan.featured ? <span className="absolute -top-3 right-5 rounded-full bg-[#7e3518] px-4 py-1 text-xs text-white">Le plus choisi</span> : null}
              <h3 className="font-semibold">{plan.name}</h3>
              <p className="moony-serif mt-3 text-[30px]">{plan.price} <span className="font-sans text-sm text-[#5b2f22]/60">{plan.unit}</span></p>
              <ul className="mt-5 space-y-2 text-sm text-[#5b2f22]/75">{benefits.map((b) => <li key={b}>✓ {b}</li>)}</ul>
              <button className={`mt-7 w-full rounded-full border px-5 py-3 text-sm font-medium ${plan.featured ? "border-[#7e3518] bg-[#7e3518] text-white" : "border-[#5b2f22]/55"}`}>Choisir cette offre</button>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-[#5b2f22]/10 bg-white/45">
        <div className="mx-auto grid max-w-[1500px] gap-8 px-6 py-10 lg:grid-cols-[1fr_1fr_auto] lg:items-center lg:px-12">
          <div><h2 className="moony-serif text-4xl">Pour les entreprises</h2><p className="mt-2 text-[#5b2f22]/70">Une offre sur mesure pour soutenir la santé et le bien-être de vos collaboratrices.</p></div>
          <div className="text-sm leading-7"><strong>Tarification sur mesure selon la taille de l’entreprise.</strong><br />Accès aux services pour les collaboratrices · interface RH dédiée · gestion des licences · contenus santé & prévention.</div>
          <div className="flex flex-col gap-3"><button className="rounded-full bg-[#7e3518] px-8 py-3 text-sm font-medium text-white">Nous contacter</button><button className="rounded-full border border-[#5b2f22]/55 px-8 py-3 text-sm font-medium">Se faire rappeler</button></div>
        </div>
      </section>
    </main>
  );
}
