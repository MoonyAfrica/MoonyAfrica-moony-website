import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PublicFooter } from "./public-footer";
import { PublicHeader } from "./public-header";

type Section = {
  title: string;
  body: string;
};

type Props = {
  eyebrow: string;
  title: string;
  intro: string;
  sections: Section[];
  ctaLabel?: string;
  ctaHref?: string;
};

export function PublicInfoPage({ eyebrow, title, intro, sections, ctaLabel = "Nous contacter", ctaHref = "/contact" }: Props) {
  return (
    <main className="min-h-screen bg-[#fffaf4] text-[#4d281d]">
      <section className="relative overflow-hidden border-b border-[#5b2f22]/10 bg-[radial-gradient(circle_at_80%_10%,rgba(210,133,91,.24),transparent_28%),linear-gradient(105deg,#fffaf4_0%,#f3e4d7_100%)] pt-36">
        <PublicHeader active="" />
        <div className="mx-auto max-w-[1500px] px-6 pb-14 lg:px-12 lg:pb-20">
          <p className="text-[11px] font-semibold uppercase tracking-[.32em] text-[#9d4c27]">{eyebrow}</p>
          <h1 className="moony-serif mt-4 max-w-[900px] text-[54px] leading-[.96] tracking-[-.045em] sm:text-[66px] lg:text-[76px]">{title}</h1>
          <p className="mt-6 max-w-[760px] text-[17px] leading-7 text-[#5b2f22]/72">{intro}</p>
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] px-6 py-14 lg:px-12 lg:py-20">
        <div className="grid gap-4 md:grid-cols-2">
          {sections.map((section, index) => (
            <article key={section.title} className={`rounded-[24px] border border-[#5b2f22]/10 p-7 sm:p-8 ${index % 3 === 0 ? "bg-[#f7e9df]" : index % 3 === 1 ? "bg-white" : "bg-[#efe0d3]"}`}>
              <span className="text-[10px] font-semibold tracking-[.22em] text-[#a15837]">0{index + 1}</span>
              <h2 className="moony-serif mt-3 text-[32px] leading-[1.02]">{section.title}</h2>
              <p className="mt-4 text-sm leading-6 text-[#5b2f22]/68">{section.body}</p>
            </article>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-5 rounded-[26px] bg-[#4b271d] p-7 text-[#fff8f1] sm:p-9">
          <div><p className="moony-serif text-[32px] leading-none">Une question sur MOONY ?</p><p className="mt-2 text-sm text-white/62">Notre équipe peut vous répondre et vous orienter.</p></div>
          <Link href={ctaHref} className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/8 px-6 py-3 text-sm font-medium">{ctaLabel} <ArrowUpRight size={15} /></Link>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
