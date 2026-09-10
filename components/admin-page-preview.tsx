"use client";

import type { CSSProperties } from "react";
import type { CmsSection } from "@/lib/cms-types";

type HeroContent={eyebrow?:string;title?:string;body?:string;primaryLabel?:string;primaryHref?:string;secondaryLabel?:string;secondaryHref?:string;imageUrl?:string;imageAlt?:string;imagePosition?:string};
type PreviewPage={title:string;slug:string;status:"draft"|"published"|"archived";hero:HeroContent;sections:CmsSection[]};

const tones:Record<NonNullable<CmsSection["background"]>,string>={
  ivory:"bg-[#fffaf4] text-[#5b2f22]",
  peach:"bg-[#f5e2d5] text-[#5b2f22]",
  terracotta:"bg-[#b9693d] text-white",
  brown:"bg-[#4b271d] text-white",
};
function safeBackgroundUrl(value:string){return value.replace(/["'\n\r()]/g,"");}

function Heading({section}:{section:CmsSection}){
  return <>{section.eyebrow?<p className="text-[7px] font-semibold uppercase tracking-[.24em] opacity-60">{section.eyebrow}</p>:null}{section.title?<h3 className="moony-serif mt-1.5 whitespace-pre-line text-[22px] leading-[1.02]">{section.title}</h3>:null}</>;
}

function SectionPreview({section}:{section:CmsSection}){
  if(section.hidden)return null;
  const tone=tones[section.background??"ivory"];
  if(section.type==="spacer")return <div className="h-5 bg-[#fffaf4]"/>;
  if(section.type==="text")return <section className={`${tone} border-t border-black/5 px-7 py-7`}><Heading section={section}/><p className="mt-2.5 max-w-[520px] whitespace-pre-line text-[9px] leading-4 opacity-65">{section.body}</p></section>;
  if(section.type==="image_text")return <section className={`${tone} grid gap-4 border-t border-black/5 px-7 py-7 sm:grid-cols-2 sm:items-center`}><div className={section.imageSide==="left"?"sm:order-2":""}><Heading section={section}/><p className="mt-2 text-[9px] leading-4 opacity-65">{section.body}</p>{section.ctaLabel?<span className="mt-3 inline-block rounded-full bg-[#7e3518] px-3 py-1.5 text-[8px] text-white">{section.ctaLabel}</span>:null}</div><div className={`overflow-hidden rounded-xl bg-black/5 ${section.imageSide==="left"?"sm:order-1":""}`}>{section.imageUrl?<img src={section.imageUrl} alt={section.imageAlt??""} className="h-32 w-full object-cover"/>:<div className="grid h-32 place-items-center text-[8px] opacity-35">Image</div>}</div></section>;
  if(section.type==="cards")return <section className={`${tone} border-t border-black/5 px-7 py-7`}><Heading section={section}/><div className="mt-4 grid gap-2 sm:grid-cols-3">{(section.items??[]).slice(0,4).map((item,index)=><div key={index} className="rounded-xl border border-current/10 bg-white/20 p-3"><span className="text-[7px] opacity-45">0{index+1}</span><p className="moony-serif mt-2 text-[14px] leading-tight">{item.title}</p><p className="mt-1 text-[8px] leading-3 opacity-60">{item.body}</p></div>)}</div></section>;
  if(section.type==="stats")return <section className={`${tone} border-t border-black/5 px-7 py-7`}><Heading section={section}/><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{(section.items??[]).map((item,index)=><div key={index} className="border-l border-current/15 pl-3"><strong className="moony-serif block text-xl font-normal">{item.value}</strong><span className="text-[8px] opacity-55">{item.label}</span></div>)}</div></section>;
  if(section.type==="cta")return <section className={`${tone} flex items-center justify-between gap-4 border-t border-black/5 px-7 py-6`}><div><Heading section={section}/><p className="mt-2 text-[8px] opacity-62">{section.body}</p></div>{section.ctaLabel?<span className="shrink-0 rounded-full border border-current/30 px-3 py-1.5 text-[8px]">{section.ctaLabel}</span>:null}</section>;
  if(section.type==="quote")return <section className={`${tone} border-t border-black/5 px-8 py-8 text-center`}><p className="moony-serif text-[23px] italic leading-[1.1]">“{section.body}”</p></section>;
  if(section.type==="faq")return <section className={`${tone} border-t border-black/5 px-7 py-7`}><Heading section={section}/><div className="mt-4 divide-y divide-current/10 border-y border-current/10">{(section.items??[]).slice(0,4).map((item,index)=><div key={index} className="flex items-center justify-between py-2.5 text-[9px]"><span>{item.title}</span><span>+</span></div>)}</div></section>;
  if(section.type==="testimonials"||section.type==="partners")return <section className="border-t border-black/5 bg-[#f8eee7] px-7 py-7 text-[#5b2f22]"><Heading section={section}/><div className="mt-4 grid grid-cols-3 gap-2">{[1,2,3].map(value=><div key={value} className="grid h-16 place-items-center rounded-xl border border-[#5b2f22]/8 bg-white text-[8px] text-[#5b2f22]/38">{section.type==="testimonials"?"Avis approuvé":"Partenaire publié"}</div>)}</div></section>;
  if(section.type==="newsletter")return <section className={`${tone} grid gap-4 border-t border-black/5 px-7 py-7 sm:grid-cols-2 sm:items-center`}><div><Heading section={section}/><p className="mt-2 text-[8px] opacity-62">{section.body}</p></div><div className="flex rounded-full border border-current/12 bg-white/40 p-1"><span className="flex-1 px-3 py-1.5 text-[8px] opacity-45">votre@email.com</span><span className="rounded-full bg-[#7e3518] px-3 py-1.5 text-[8px] text-white">S’inscrire</span></div></section>;
  return null;
}

export function AdminPagePreview({page}:{page:PreviewPage}){
  const visible=(page.sections??[]).filter(section=>!section.hidden);
  const hasImage=Boolean(page.hero.imageUrl);
  const heroStyle:CSSProperties|undefined=hasImage?{
    backgroundImage:`linear-gradient(90deg, rgba(255,248,240,.98) 0%, rgba(255,248,240,.90) 38%, rgba(255,248,240,.30) 70%), url("${safeBackgroundUrl(page.hero.imageUrl||"")}")`,
    backgroundSize:"cover",
    backgroundPosition:`center, ${page.hero.imagePosition||"65% center"}`,
  }:undefined;
  return <div className="overflow-hidden rounded-[18px] border border-[#5b2f22]/10 bg-white shadow-[0_16px_45px_rgba(63,30,20,.08)]">
    <div className="flex items-center gap-2 border-b border-[#5b2f22]/8 bg-[#fffdf9] px-4 py-2 text-[8px] text-[#5b2f22]/50"><span className="h-2 w-2 rounded-full bg-red-300"/><span className="h-2 w-2 rounded-full bg-amber-300"/><span className="h-2 w-2 rounded-full bg-emerald-300"/><span className="ml-3 flex-1 rounded-md bg-[#f4ebe4] px-3 py-1 text-center">moonyafrica.com{page.slug}</span><span className={`rounded-full px-2 py-1 ${page.status==="published"?"bg-emerald-100 text-emerald-700":"bg-amber-100 text-amber-700"}`}>{page.status==="published"?"Publié":"Aperçu"}</span></div>
    <div className="max-h-[680px] overflow-y-auto">
      <section style={heroStyle} className={`relative min-h-[330px] overflow-hidden px-8 py-8 ${hasImage?"bg-[#f3e4d6] text-[#5b2f22]":"bg-[linear-gradient(120deg,#6b321f_0%,#a65f3b_48%,#dfb08e_100%)] text-white"}`}>
        <div className="mb-12 flex items-center justify-between text-[8px]"><span className="moony-serif text-lg">MOONY</span><div className="hidden gap-4 sm:flex"><span>Accueil</span><span>Mission</span><span>Services</span><span>Communauté</span></div></div>
        <div className="max-w-[470px]">{page.hero.eyebrow?<p className={`text-[7px] font-semibold uppercase tracking-[.28em] ${hasImage?"text-[#8d3b19]":"text-white/70"}`}>{page.hero.eyebrow}</p>:null}<h2 className="moony-serif mt-2 whitespace-pre-line text-[38px] leading-[.96] tracking-[-.04em]">{page.hero.title||page.title}</h2>{page.hero.body?<p className={`mt-4 max-w-[400px] text-[10px] leading-4 ${hasImage?"text-[#5b2f22]/75":"text-white/78"}`}>{page.hero.body}</p>:null}<div className="mt-5 flex flex-wrap gap-2">{page.hero.primaryLabel?<span className="rounded-full bg-[#7e3518] px-4 py-2 text-[8px] text-white">{page.hero.primaryLabel}</span>:null}{page.hero.secondaryLabel?<span className={`rounded-full border px-4 py-2 text-[8px] ${hasImage?"border-[#5b2f22]/35":"border-white/55"}`}>{page.hero.secondaryLabel}</span>:null}</div></div>
      </section>
      {visible.map(section=><SectionPreview key={section.id} section={section}/>)}
      {!visible.length?<div className="bg-[#fffaf4] px-8 py-10 text-center text-[9px] text-[#5b2f22]/42">Le hero est prêt. Ajoutez des blocs de contenu pour compléter la page.</div>:null}
      <footer className="bg-[#3f2118] px-8 py-6 text-center text-[8px] text-white/55">MOONY — Pour la santé des femmes, à chaque étape de leur vie.</footer>
    </div>
  </div>;
}
