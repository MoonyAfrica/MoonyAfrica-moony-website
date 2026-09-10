import { getFeaturedTestimonials, getPublishedPartners } from "@/lib/public-content";

export async function PublicProofStrip() {
  const [testimonials, partners] = await Promise.all([getFeaturedTestimonials(3), getPublishedPartners(10)]);
  if (!testimonials.length && !partners.length) return null;
  return <section className="border-b border-white/10 bg-[#3a2119] px-6 py-12 text-white sm:px-8 lg:px-12">
    <div className="mx-auto max-w-[1540px]">
      {partners.length ? <div><p className="text-center text-[10px] font-semibold uppercase tracking-[.28em] text-[#e9b78f]">Ils nous font confiance</p><div className="mt-6 flex flex-wrap items-center justify-center gap-3 sm:gap-4">{partners.map((partner)=><a key={partner.id} href={partner.website_url || undefined} target={partner.website_url?"_blank":undefined} rel={partner.website_url?"noreferrer":undefined} className="flex min-h-16 min-w-[150px] items-center justify-center rounded-xl border border-white/10 bg-white/[.055] px-5 py-3 text-center text-xs text-white/72">{partner.logo_url?<img src={partner.logo_url} alt={partner.name} className="max-h-9 max-w-[130px] object-contain"/>:<span>{partner.name}</span>}</a>)}</div></div>:null}
      {testimonials.length ? <div className={`${partners.length?"mt-10 border-t border-white/10 pt-10":""}`}><p className="text-center text-[10px] font-semibold uppercase tracking-[.28em] text-[#e9b78f]">Ce qu’elles disent de MOONY</p><div className="mt-6 grid gap-3 lg:grid-cols-3">{testimonials.map((item)=><blockquote key={item.id} className="rounded-[20px] border border-white/10 bg-white/[.045] p-5"><div className="text-[#e9b78f]">{"★".repeat(item.rating || 5)}</div><p className="moony-serif mt-4 text-[22px] leading-[1.2] text-white/92">« {item.quote} »</p><footer className="mt-4 text-xs text-white/50"><strong className="text-white/72">{item.author_name}</strong>{item.author_role?` · ${item.author_role}`:""}{item.author_location?` · ${item.author_location}`:""}</footer></blockquote>)}</div></div>:null}
    </div>
  </section>;
}
