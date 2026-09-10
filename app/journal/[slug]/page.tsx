import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";
import { getArticleBySlug } from "@/lib/public-content";
import { getPublicSiteSettings } from "@/lib/public-settings";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const [article, settings] = await Promise.all([getArticleBySlug(slug), getPublicSiteSettings()]);
  if (!article) return { title: "Article | MOONY Africa", robots: { index: false, follow: false } };
  const title = article.seo_title || `${article.title} | MOONY Africa`;
  const description = article.seo_description || article.excerpt || settings.seo.defaultDescription;
  const image = article.image_url || settings.seo.defaultOgImage || undefined;
  const path = `/journal/${article.slug}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "article",
      title,
      description,
      url: path,
      images: image ? [image] : undefined,
      publishedTime: article.published_at || undefined,
      authors: [article.author_name],
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const article = await getArticleBySlug(slug); if (!article) notFound();
  const paragraphs = article.content.split(/\n{2,}/).map((x) => x.trim()).filter(Boolean);
  return <main className="min-h-screen bg-[#fffaf4] text-[#4d281d]">
    <PublicHeader active="Ressources" />
    <article>
      <header className="border-b border-[#5b2f22]/10 bg-[linear-gradient(115deg,#f8efe5,#ead8ca)] px-6 pb-16 pt-40 lg:px-12">
        <div className="mx-auto max-w-[980px]"><Link href="/ressources" className="text-xs font-semibold uppercase tracking-[.22em] text-[#9d4c27]">← Ressources</Link><p className="mt-8 text-xs font-semibold uppercase tracking-[.28em] text-[#8d5b47]">{article.category}</p><h1 className="moony-serif mt-4 text-[54px] leading-[.98] tracking-[-.045em] sm:text-[68px]">{article.title}</h1>{article.excerpt?<p className="mt-6 max-w-[760px] text-lg leading-8 text-[#5b2f22]/70">{article.excerpt}</p>:null}<div className="mt-7 flex flex-wrap gap-4 text-xs text-[#5b2f22]/50"><span>{article.author_name}</span>{article.published_at?<span>{new Intl.DateTimeFormat("fr-FR",{dateStyle:"long"}).format(new Date(article.published_at))}</span>:null}</div></div>
      </header>
      {article.image_url?<div className="mx-auto max-w-[1180px] px-6 pt-10 lg:px-12"><div className="h-[460px] rounded-[28px] bg-cover bg-center" style={{backgroundImage:`url(${article.image_url})`}}/></div>:null}
      <div className="mx-auto max-w-[820px] px-6 py-14 lg:py-20">{paragraphs.map((paragraph,index)=><p key={index} className="mb-7 text-[17px] leading-8 text-[#4d281d]/82">{paragraph}</p>)}<div className="mt-12 rounded-[24px] border border-[#5b2f22]/10 bg-[#f7ebe2] p-7"><p className="moony-serif text-3xl">Continuer à s’informer</p><p className="mt-2 text-sm leading-6 text-[#5b2f22]/65">Retrouvez les guides, articles et ressources MOONY pensés pour accompagner chaque étape de la vie.</p><Link href="/ressources" className="mt-5 inline-flex rounded-full bg-[#7e3518] px-6 py-3 text-sm font-medium text-white">Voir les ressources</Link></div></div>
    </article>
    <PublicFooter />
  </main>;
}
