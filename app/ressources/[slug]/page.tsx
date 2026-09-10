import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";
import { getResourceBySlug } from "@/lib/public-content";
import { getPublicSiteSettings } from "@/lib/public-settings";

export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{
  const {slug}=await params;
  const [resource,settings]=await Promise.all([getResourceBySlug(slug),getPublicSiteSettings()]);
  if(!resource)return{title:"Ressource | MOONY Africa",robots:{index:false,follow:false}};
  const title=`${resource.title} | MOONY Africa`;
  const description=resource.excerpt||settings.seo.defaultDescription;
  const image=resource.image_url||settings.seo.defaultOgImage||undefined;
  const path=`/ressources/${resource.slug}`;
  return{title,description,alternates:{canonical:path},openGraph:{type:"article",title,description,url:path,images:image?[image]:undefined},twitter:{card:image?"summary_large_image":"summary",title,description,images:image?[image]:undefined}};
}

export default async function ResourceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const resource = await getResourceBySlug(slug); if (!resource) notFound();
  const paragraphs = (resource.content || resource.excerpt || "").split(/\n{2,}/).map((x)=>x.trim()).filter(Boolean);
  return <main className="min-h-screen bg-[#fffaf4] text-[#4d281d]">
    <PublicHeader active="Ressources" />
    <section className="border-b border-[#5b2f22]/10 bg-[linear-gradient(115deg,#f8efe5,#ead8ca)] px-6 pb-16 pt-40 lg:px-12"><div className="mx-auto max-w-[980px]"><Link href="/ressources" className="text-xs font-semibold uppercase tracking-[.22em] text-[#9d4c27]">← Ressources</Link><div className="mt-8 flex flex-wrap gap-2"><span className="rounded-full bg-[#f2d8c4] px-3 py-1 text-[10px] font-semibold uppercase tracking-[.18em]">{resource.resource_type}</span><span className="rounded-full border border-[#5b2f22]/12 px-3 py-1 text-[10px] font-semibold uppercase tracking-[.18em]">{resource.category}</span></div><h1 className="moony-serif mt-5 text-[54px] leading-[.98] tracking-[-.045em] sm:text-[68px]">{resource.title}</h1>{resource.excerpt?<p className="mt-6 max-w-[760px] text-lg leading-8 text-[#5b2f22]/70">{resource.excerpt}</p>:null}{resource.file_url?<a href={`/api/resources/${resource.slug}/download`} target="_blank" rel="noreferrer" className="mt-8 inline-flex rounded-full bg-[#7e3518] px-7 py-3.5 text-sm font-medium text-white">Ouvrir / télécharger la ressource</a>:null}</div></section>
    {resource.image_url?<div className="mx-auto max-w-[1180px] px-6 pt-10 lg:px-12"><div className="h-[420px] rounded-[28px] bg-cover bg-center" style={{backgroundImage:`url(${resource.image_url})`}}/></div>:null}
    <section className="mx-auto max-w-[820px] px-6 py-14 lg:py-20">{paragraphs.length?paragraphs.map((p,i)=><p key={i} className="mb-7 text-[17px] leading-8 text-[#4d281d]/82">{p}</p>):<p className="text-[17px] leading-8 text-[#4d281d]/70">Cette ressource sera enrichie prochainement.</p>}<div className="mt-12 rounded-[24px] border border-[#5b2f22]/10 bg-[#f7ebe2] p-7"><p className="moony-serif text-3xl">Besoin d’aller plus loin ?</p><p className="mt-2 text-sm leading-6 text-[#5b2f22]/65">Découvrez les autres ressources MOONY ou contactez notre équipe pour être orientée.</p><div className="mt-5 flex flex-wrap gap-3"><Link href="/ressources" className="rounded-full bg-[#7e3518] px-6 py-3 text-sm font-medium text-white">Toutes les ressources</Link><Link href="/contact" className="rounded-full border border-[#5b2f22]/25 px-6 py-3 text-sm font-medium">Nous contacter</Link></div></div></section>
    <PublicFooter />
  </main>;
}
