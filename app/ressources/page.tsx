import type { Metadata } from "next";
import Link from "next/link";
import { CmsSections } from "@/components/cms-sections";
import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";
import { getPublishedPage } from "@/lib/cms";
import { siteConfig } from "@/lib/site-config";
import { getPublishedArticles, getPublishedResources } from "@/lib/public-content";

const categories = ["Tous les contenus", "Santé féminine", "Grossesse & post-partum", "Santé mentale", "Nutrition & mode de vie", "Droits & société", "Vie pro & études", "Histoires de femmes"];
const fallbackFeatured = [
  { slug:"sante-mentale", category: "BIEN-ÊTRE", title: "Prendre soin de sa santé mentale au quotidien", excerpt: "Des conseils simples pour se recentrer, gérer le stress et préserver son équilibre.", image_url:null },
  { slug:"post-partum", category: "GROSSESSE", title: "Préparer son post-partum en toute sérénité", excerpt: "Anticiper, s’informer et se faire entourer pour vivre cette nouvelle étape plus sereinement.", image_url:null },
  { slug:"sororite", category: "COMMUNAUTÉ", title: "Le pouvoir de la sororité", excerpt: "Témoignages, entraide et défis communs : quand les femmes se soutiennent, tout devient possible.", image_url:null },
];
const fallbackHero={eyebrow:"Ressources",title:"S’informer\npour mieux avancer",body:"Des contenus fiables, accessibles et utiles pour toutes les femmes, à chaque étape de leur vie."};

export async function generateMetadata():Promise<Metadata>{
  const page=await getPublishedPage("/ressources");
  return {title:page?.seo_title||"Ressources — MOONY Africa",description:page?.seo_description||page?.hero?.body||fallbackHero.body};
}

export default async function ResourcesPage() {
  const [page, articles, resources] = await Promise.all([getPublishedPage("/ressources"),getPublishedArticles(18), getPublishedResources(18)]);
  const hero=page?.hero??{};
  const featured = articles.filter((x) => x.featured).slice(0,3);
  const heroCards = featured.length ? featured : fallbackFeatured;
  const latestArticles = articles.filter((x) => !featured.some((f) => f.slug === x.slug)).slice(0,6);
  const latestResources = resources.slice(0,6);
  const resourceCategories = Array.from(new Set([...articles.map((x)=>x.category),...resources.map((x)=>x.category)])).slice(0,7);
  const displayCategories = resourceCategories.length ? ["Tous les contenus", ...resourceCategories] : categories;

  return (
    <main className="min-h-screen bg-[#fffaf4] text-[#4d281d]">
      <PublicHeader active="Ressources" />
      <section className="relative overflow-hidden border-b border-[#5b2f22]/10 bg-[linear-gradient(105deg,#f8efe5_0%,#ead9ca_100%)] pt-36">
        <div className="mx-auto grid max-w-[1500px] gap-10 px-6 pb-10 lg:grid-cols-[1.1fr_.9fr] lg:px-12">
          <div><p className="text-xs font-semibold uppercase tracking-[.36em]">{hero.eyebrow||fallbackHero.eyebrow}</p><h1 className="moony-serif mt-4 whitespace-pre-line text-6xl leading-[.98] tracking-[-.045em] lg:text-7xl">{hero.title||fallbackHero.title}</h1><p className="mt-5 max-w-[620px] text-[18px] leading-7 text-[#5b2f22]/75">{hero.body||fallbackHero.body}</p><p className="mt-12 text-xs uppercase tracking-[.35em] text-[#8d5b47]">Santé · Éducation · Bien-être · Éveil</p></div>
          <div className="hidden items-end justify-end lg:flex"><div className="w-[420px] space-y-1 text-center moony-serif text-xl text-[#5b2f22]/80">{["SAVOIR", "PRÉVENTION", "BIEN-ÊTRE", "DROITS", "ÉQUILIBRE"].map((x) => <div key={x} className="border border-[#5b2f22]/12 bg-[#f6eadf] px-8 py-3 shadow-sm">{x}</div>)}</div></div>
        </div>
      </section>

      <section className="border-b border-[#5b2f22]/10 bg-white"><div className="mx-auto grid max-w-[1500px] gap-4 px-6 py-5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 lg:px-12">{displayCategories.slice(0,8).map((c, i) => <div key={c} className={`rounded-xl px-3 py-4 text-center text-xs ${i === 0 ? "bg-[#f8e7df] font-semibold" : "bg-[#fffaf4]"}`}><span className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full bg-[#f6dfd7]">◌</span>{c}</div>)}</div></section>

      <section className="mx-auto max-w-[1500px] px-6 py-12 lg:px-12">
        <div className="flex items-end justify-between"><h2 className="moony-serif text-4xl">À la une</h2><span className="text-sm text-[#5b2f22]/50">Sélection MOONY</span></div>
        <div className="mt-6 grid gap-7 lg:grid-cols-3">
          {heroCards.map((item, i) => <article key={item.slug}><Link href={"content" in item ? `/journal/${item.slug}` : "/ressources"} className="group block"><div className={`h-56 overflow-hidden rounded-sm ${i === 0 ? "bg-[#8d5f49]" : i === 1 ? "bg-[#d8b79b]" : "bg-[#6e4d3d]"}`} style={item.image_url?{backgroundImage:`linear-gradient(rgba(70,30,18,.18),rgba(70,30,18,.18)),url(${item.image_url})`,backgroundSize:"cover",backgroundPosition:"center"}:undefined}><span className="m-4 inline-block rounded-full bg-[#f5ded5] px-3 py-1 text-[10px] font-semibold tracking-wide">{item.category}</span></div><h3 className="moony-serif mt-4 text-3xl leading-tight transition group-hover:text-[#8d3b19]">{item.title}</h3><p className="mt-3 text-sm leading-6 text-[#5b2f22]/70">{item.excerpt}</p><span className="mt-4 inline-block text-sm font-medium">Lire l’article →</span></Link></article>)}
        </div>

        {latestArticles.length ? <><div className="mt-14 flex items-end justify-between"><h2 className="moony-serif text-4xl">Nos derniers articles</h2><span className="text-sm text-[#5b2f22]/50">Journal MOONY</span></div><div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{latestArticles.map((article, i) => <Link href={`/journal/${article.slug}`} key={article.id} className="group"><div className={`h-44 overflow-hidden ${["bg-[#d9c3b0]","bg-[#b6805e]","bg-[#8f5b43]","bg-[#cfab95]","bg-[#b69a7e]","bg-[#f2dcd7]"][i%6]}`} style={article.image_url?{backgroundImage:`url(${article.image_url})`,backgroundSize:"cover",backgroundPosition:"center"}:undefined}/><p className="mt-2 text-[10px] font-semibold uppercase tracking-[.16em] text-[#9d4c27]">{article.category}</p><p className="moony-serif mt-2 text-[22px] leading-[1.08] transition group-hover:text-[#8d3b19]">{article.title}</p></Link>)}</div></>:null}

        {latestResources.length ? <><div className="mt-14 flex items-end justify-between"><h2 className="moony-serif text-4xl">Guides & outils</h2><span className="text-sm text-[#5b2f22]/50">À consulter ou télécharger</span></div><div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{latestResources.map((resource)=><Link href={`/ressources/${resource.slug}`} key={resource.id} className="rounded-[22px] border border-[#5b2f22]/10 bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-lg"><div className="flex items-center justify-between gap-4"><span className="rounded-full bg-[#f6dfd7] px-3 py-1 text-[10px] font-semibold uppercase">{resource.resource_type}</span>{resource.featured?<span className="text-amber-600">★</span>:null}</div><h3 className="moony-serif mt-5 text-3xl leading-tight">{resource.title}</h3><p className="mt-3 text-sm leading-6 text-[#5b2f22]/65">{resource.excerpt}</p><span className="mt-5 inline-block text-sm font-semibold text-[#8d3b19]">Ouvrir la ressource →</span></Link>)}</div></>:null}
      </section>

      <section className="border-y border-[#5b2f22]/10 bg-[#f7ebe2]"><div className="mx-auto grid max-w-[1500px] gap-8 px-6 py-12 lg:grid-cols-[1.1fr_.9fr] lg:px-12"><div><p className="text-xs uppercase tracking-[.3em]">Encore plus de ressources dans l’application</p><h2 className="moony-serif mt-3 text-5xl leading-tight">Des contenus exclusifs,<br />rien que pour vous.</h2><p className="mt-4 max-w-xl text-[#5b2f22]/70">Webinaires, mini-cours, guides pratiques, témoignages vidéo… Découvrez encore plus de ressources directement dans MOONY.</p><a href={siteConfig.appUrl} className="mt-7 inline-flex rounded-full bg-[#7e3518] px-7 py-3.5 text-sm font-medium text-white">Accéder à l’application</a></div><div className="rounded-[34px] border border-[#5b2f22]/10 bg-white/65 p-8"><p className="moony-serif text-4xl italic">Apprendre<br />Comprendre<br />Évoluer<br />Ensemble</p></div></div></section>

      <section className="mx-auto grid max-w-[1500px] gap-8 px-6 py-12 lg:grid-cols-[.55fr_1.45fr] lg:px-12"><div><p className="text-xs uppercase tracking-[.3em]">Une question ?</p><h2 className="moony-serif mt-3 text-5xl">FAQ</h2></div><div className="divide-y divide-[#5b2f22]/12 border-y border-[#5b2f22]/12">{["Les contenus sont-ils rédigés par des professionnelles de santé ?", "Les ressources sont-elles accessibles gratuitement ?", "Puis-je proposer un sujet ou un témoignage ?", "Les contenus sont-ils disponibles dans plusieurs langues ?"].map(q => <div key={q} className="flex w-full items-center justify-between py-5 text-left text-sm"><span>{q}</span><span>›</span></div>)}</div></section>
      <CmsSections sections={page?.sections ?? []} />
      <PublicFooter />
    </main>
  );
}
