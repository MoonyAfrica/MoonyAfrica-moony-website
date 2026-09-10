import Link from "next/link";
import { PublicHeader } from "./public-header";

type Feature = { title: string; body: string; icon?: string };

type Props = {
  active: string;
  eyebrow?: string;
  title: React.ReactNode;
  body: string;
  heroClass: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  features?: Feature[];
};

export function PublicFeatureHero({
  active,
  eyebrow,
  title,
  body,
  heroClass,
  primaryLabel,
  primaryHref,
  secondaryLabel,
  secondaryHref,
  features = [],
}: Props) {
  return (
    <main className="min-h-screen bg-[#f8f0e5]">
      <section className={`hero-photo ${heroClass} moony-grain relative min-h-screen overflow-hidden`}>
        <PublicHeader active={active} />
        <div className="relative z-10 mx-auto flex min-h-screen max-w-[1560px] items-center px-6 pb-10 pt-36 lg:px-12">
          <div className="max-w-[650px] text-[#5b2f22]">
            {eyebrow ? <p className="mb-4 text-[15px] font-medium">{eyebrow}</p> : null}
            <h1 className="moony-serif text-[56px] leading-[.98] tracking-[-0.045em] sm:text-[68px] lg:text-[78px]">{title}</h1>
            <p className="mt-6 max-w-[540px] text-[19px] leading-[1.38] text-[#5b2f22]/90">{body}</p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link href={primaryHref} className="rounded-full bg-[#8d3b19] px-8 py-4 text-[15px] font-medium text-white">
                {primaryLabel}
              </Link>
              {secondaryLabel && secondaryHref ? (
                <Link href={secondaryHref} className="rounded-full border border-[#5b2f22]/65 px-8 py-4 text-[15px] font-medium text-[#5b2f22]">
                  {secondaryLabel}
                </Link>
              ) : null}
            </div>
            {features.length ? (
              <div className="mt-8 grid max-w-[620px] gap-0 border-t border-[#5b2f22]/16 pt-5 sm:grid-cols-3">
                {features.map((feature, index) => (
                  <div key={feature.title} className={`px-1 py-4 sm:px-5 ${index ? "sm:border-l sm:border-[#5b2f22]/16" : ""}`}>
                    <div className="mb-3 grid h-10 w-10 place-items-center rounded-full bg-[#f3d7c1] text-xl">{feature.icon ?? "◌"}</div>
                    <h2 className="moony-serif text-[26px] leading-none">{feature.title}</h2>
                    <p className="mt-2 text-[14px] leading-5 text-[#5b2f22]/78">{feature.body}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
