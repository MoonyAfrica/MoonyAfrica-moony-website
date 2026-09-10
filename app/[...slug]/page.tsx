import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CmsSections } from "@/components/cms-sections";
import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";
import { getPublishedPage } from "@/lib/cms";
import { buildCmsMetadata } from "@/lib/seo";

function pathOf(slug:string[]){return `/${slug.join("/")}`;}
function safeBackgroundUrl(value:string){return value.replace(/["'\n\r()]/g,"");}

export async function generateMetadata({params}:{params:Promise<{slug:string[]}>}):Promise<Metadata>{
 const {slug}=await params;const path=pathOf(slug);const page=await getPublishedPage(path);
 if(!page)return{title:"Page introuvable — MOONY Africa",robots:{index:false,follow:false}};
 return buildCmsMetadata({page,fallbackTitle:`${page.title} — MOONY Africa`,fallbackDescription:page.hero?.body||"Découvrez cette page MOONY Africa.",path});
}

export default async function CmsPublicPage({params}:{params:Promise<{slug:string[]}>}){
 const {slug}=await params;const path=pathOf(slug);const page=await getPublishedPage(path);if(!page)notFound();
 const hero=page.hero??{};const hasImage=Boolean(hero.imageUrl);
 const style:CSSProperties|undefined=hasImage?{
  backgroundImage:`linear-gradient(90deg, rgba(255,248,240,.99) 0%, rgba(255,248,240,.93) 34%, rgba(255,248,240,.50) 58%, rgba(255,248,240,.12) 76%), url("${safeBackgroundUrl(hero.imageUrl||"")}")`,
  backgroundSize:"cover",backgroundPosition:`center, ${hero.imagePosition||"65% center"}`,
 }:undefined;
 return <main className="min-h-screen bg-[#fffaf4] text-[#5b2f22]">
  <section style={style} className={`relative min-h-[620px] overflow-hidden ${hasImage?"bg-[#f1e2d5]":"bg-[linear-gradient(120deg,#f8efe5_0%,#ead8ca_60%,#c88761_100%)]"}`}>
   <PublicHeader active={page.title}/>
   <div className="mx-auto flex min-h-[620px] max-w-[1500px] items-center px-6 pb-14 pt-36 lg:px-12"><div className="max-w-[720px]">{hero.eyebrow?<p className="mb-4 text-[11px] font-semibold uppercase tracking-[.3em] text-[#9d4c27]">{hero.eyebrow}</p>:null}<h1 className="moony-serif whitespace-pre-line text-[54px] leading-[.96] tracking-[-.045em] sm:text-[68px] lg:text-[78px]">{hero.title||page.title}</h1>{hero.body?<p className="mt-6 max-w-[610px] whitespace-pre-line text-[17px] leading-7 text-[#5b2f22]/76">{hero.body}</p>:null}<div className="mt-8 flex flex-wrap gap-3">{hero.primaryLabel&&hero.primaryHref?<Link href={hero.primaryHref} className="rounded-full bg-[#7e3518] px-7 py-3.5 text-sm font-medium text-white">{hero.primaryLabel}</Link>:null}{hero.secondaryLabel&&hero.secondaryHref?<Link href={hero.secondaryHref} className="rounded-full border border-[#5b2f22]/35 bg-white/25 px-7 py-3.5 text-sm font-medium">{hero.secondaryLabel}</Link>:null}</div></div></div>
  </section>
  <CmsSections sections={page.sections??[]}/>
  <PublicFooter/>
 </main>;
}
