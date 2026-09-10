import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";
import { siteConfig } from "@/lib/site-config";

const categories = ["Tous les contenus", "Santé féminine", "Grossesse & post-partum", "Santé mentale", "Nutrition & mode de vie", "Droits & société", "Vie pro & études", "Histoires de femmes"];
const featured = [
  { tag: "BIEN-ÊTRE", title: "Prendre soin de sa santé mentale au quotidien", body: "Des conseils simples pour se recentrer, gérer le stress et préserver son équilibre." },
  { tag: "GROSSESSE", title: "Préparer son post-partum en toute sérénité", body: "Anticiper, s’informer et se faire entourer pour vivre cette nouvelle étape plus sereinement." },
  { tag: "COMMUNAUTÉ", title: "Le pouvoir de la sororité", body: "Témoignages, entraide et défis communs : quand les femmes se soutiennent, tout devient possible." },
];
const latest = ["Mieux comprendre son cycle menstruel", "Alimentation et santé hormonale : les bases", "Les examens à ne pas négliger selon votre âge", "Lâcher prise : un acte de soin", "Concilier santé, vie pro et vie perso", "Celles qui nous inspirent"];

export default function ResourcesPage() {
  return (
    <main className="min-h-screen bg-[#fffaf4] text-[#4d281d]">
      <PublicHeader active="Ressources" />
      <section className="relative overflow-hidden border-b border-[#5b2f22]/10 bg-[linear-gradient(105deg,#f8efe5_0%,#ead9ca_100%)] pt-36">
        <div className="mx-auto grid max-w-[1500px] gap-10 px-6 pb-10 lg:grid-cols-[1.1fr_.9fr] lg:px-12">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.36em]">Ressources</p>
            <h1 className="moony-serif mt-4 text-6xl leading-[.98] tracking-[-.045em] lg:text-7xl">S’informer<br />pour mieux avancer</h1>
            <p className="mt-5 max-w-[620px] text-[18px] leading-7 text-[#5b2f22]/75">Des contenus fiables, accessibles et utiles pour toutes les femmes, à chaque étape de leur vie.</p>
            <p className="mt-12 text-xs uppercase tracking-[.35em] text-[#8d5b47]">Santé · Éducation · Bien-être · Éveil</p>
          </div>
          <div className="hidden items-end justify-end lg:flex">
            <div className="w-[420px] space-y-1 text-center moony-serif text-xl text-[#5b2f22]/80">
              {["SAVOIR", "PRÉVENTION", "BIEN-ÊTRE", "DROITS", "ÉQUILIBRE"].map((x) => <div key={x} className="border border-[#5b2f22]/12 bg-[#f6eadf] px-8 py-3 shadow-sm">{x}</div>)}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[#5b2f22]/10 bg-white">
        <div className="mx-auto grid max-w-[1500px] gap-4 px-6 py-5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 lg:px-12">
          {categories.map((c, i) => <button key={c} className={`rounded-xl px-3 py-4 text-center text-xs ${i === 0 ? "bg-[#f8e7df] font-semibold" : "hover:bg-[#fbf3ed]"}`}><span className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full bg-[#f6dfd7]">◌</span>{c}</button>)}
        </div>
      </section>

      <section className="mx-auto max-w-[1500px] px-6 py-12 lg:px-12">
        <div className="flex items-end justify-between"><h2 className="moony-serif text-4xl">À la une</h2><button className="text-sm">Voir tous les contenus →</button></div>
        <div className="mt-6 grid gap-7 lg:grid-cols-3">
          {featured.map((item, i) => <article key={item.title}><div className={`h-56 rounded-sm ${i === 0 ? "bg-[#8d5f49]" : i === 1 ? "bg-[#d8b79b]" : "bg-[#6e4d3d]"}`}><span className="m-4 inline-block rounded-full bg-[#f5ded5] px-3 py-1 text-[10px] font-semibold tracking-wide">{item.tag}</span></div><h3 className="moony-serif mt-4 text-3xl leading-tight">{item.title}</h3><p className="mt-3 text-sm leading-6 text-[#5b2f22]/70">{item.body}</p><button className="mt-4 text-sm font-medium">Lire l’article →</button></article>)}
        </div>

        <div className="mt-14 flex items-end justify-between"><h2 className="moony-serif text-4xl">Nos derniers contenus</h2><button className="text-sm">Voir tous les contenus →</button></div>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {latest.map((title, i) => <article key={title}><div className={`h-44 ${["bg-[#d9c3b0]","bg-[#b6805e]","bg-[#8f5b43]","bg-[#cfab95]","bg-[#b69a7e]","bg-[#f2dcd7]"][i]}`} /><p className="moony-serif mt-3 text-[22px] leading-[1.08]">{title}</p></article>)}
        </div>
      </section>

      <section className="border-y border-[#5b2f22]/10 bg-[#f7ebe2]">
        <div className="mx-auto grid max-w-[1500px] gap-8 px-6 py-12 lg:grid-cols-[1.1fr_.9fr] lg:px-12">
          <div><p className="text-xs uppercase tracking-[.3em]">Encore plus de ressources dans l’application</p><h2 className="moony-serif mt-3 text-5xl leading-tight">Des contenus exclusifs,<br />rien que pour vous.</h2><p className="mt-4 max-w-xl text-[#5b2f22]/70">Webinaires, mini-cours, guides pratiques, témoignages vidéo… Découvrez encore plus de ressources directement dans MOONY.</p><a href={siteConfig.appUrl} className="mt-7 inline-flex rounded-full bg-[#7e3518] px-7 py-3.5 text-sm font-medium text-white">Accéder à l’application</a></div>
          <div className="rounded-[34px] border border-[#5b2f22]/10 bg-white/65 p-8"><p className="moony-serif text-4xl italic">Apprendre<br />Comprendre<br />Évoluer<br />Ensemble</p></div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1500px] gap-8 px-6 py-12 lg:grid-cols-[.55fr_1.45fr] lg:px-12">
        <div><p className="text-xs uppercase tracking-[.3em]">Une question ?</p><h2 className="moony-serif mt-3 text-5xl">FAQ</h2></div>
        <div className="divide-y divide-[#5b2f22]/12 border-y border-[#5b2f22]/12">{["Les contenus sont-ils rédigés par des professionnelles de santé ?", "Les ressources sont-elles accessibles gratuitement ?", "Puis-je proposer un sujet ou un témoignage ?", "Les contenus sont-ils disponibles dans plusieurs langues ?"].map(q => <button key={q} className="flex w-full items-center justify-between py-5 text-left text-sm"><span>{q}</span><span>›</span></button>)}</div>
      </section>

      <PublicFooter />
    </main>
  );
}
