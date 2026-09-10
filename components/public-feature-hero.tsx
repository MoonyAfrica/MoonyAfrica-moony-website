import Link from "next/link";
import { BookOpen, HeartHandshake, Sprout } from "lucide-react";
import { getPublishedPage, heroLines } from "@/lib/cms";
import { PublicFooter } from "./public-footer";
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

const featureIcons = [BookOpen, Sprout, HeartHandshake];
const slugs: Record<string, string> = {
  "Notre mission": "/notre-mission",
  "Notre approche": "/notre-approche",
  "À propos": "/a-propos",
};

function CmsTitle({ active, value, fallback }: { active: string; value?: string; fallback: React.ReactNode }) {
  if (!value?.trim()) return <>{fallback}</>;
  const lines = heroLines(value, []);
  if (active === "Notre mission" && lines.length > 1) {
    return <>{lines[0]}<br /><span className="block max-w-[600px] pt-4 text-[.56em] leading-[1.02] tracking-[-.035em]">{lines.slice(1).join(" ")}</span></>;
  }
  return <>{lines.map((line, index) => <span key={`${line}-${index}`}>{index ? <br /> : null}{line}</span>)}</>;
}

export async function PublicFeatureHero({
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
  const cms = slugs[active] ? await getPublishedPage(slugs[active]) : null;
  const hero = cms?.hero ?? {};
  const renderedEyebrow = hero.eyebrow ?? eyebrow;
  const renderedBody = hero.body ?? body;
  const renderedPrimaryLabel = hero.primaryLabel ?? primaryLabel;
  const renderedPrimaryHref = hero.primaryHref ?? primaryHref;
  const renderedSecondaryLabel = hero.secondaryLabel ?? secondaryLabel;
  const renderedSecondaryHref = hero.secondaryHref ?? secondaryHref;

  return (
    <main className="min-h-screen bg-[#f8f0e5] text-[#5b2f22]">
      <section className={`hero-photo ${heroClass} moony-grain relative min-h-[760px] overflow-hidden lg:min-h-screen`}>
        <PublicHeader active={active} />

        <div className="relative z-10 mx-auto flex min-h-[760px] max-w-[1660px] items-center px-5 pb-12 pt-36 sm:px-8 lg:min-h-screen lg:px-12">
          <div className="max-w-[650px]">
            {renderedEyebrow ? (
              <p className="mb-4 text-[13px] font-medium uppercase tracking-[.18em] text-[#8b4b32]">{renderedEyebrow}</p>
            ) : null}

            <h1 className="moony-serif max-w-[620px] text-[54px] leading-[.97] tracking-[-0.047em] sm:text-[66px] lg:text-[74px] xl:text-[80px]">
              <CmsTitle active={active} value={hero.title} fallback={title} />
            </h1>

            <p className="mt-6 max-w-[555px] text-[17px] leading-[1.45] text-[#5b2f22]/82 sm:text-[18px]">
              {renderedBody}
            </p>

            <div className="mt-8 flex flex-wrap gap-3 sm:gap-4">
              <Link
                href={renderedPrimaryHref}
                className="rounded-full bg-[#853718] px-7 py-3.5 text-[14px] font-medium text-white shadow-[0_12px_36px_rgba(91,47,34,.08)] transition hover:-translate-y-[1px]"
              >
                {renderedPrimaryLabel}
              </Link>
              {renderedSecondaryLabel && renderedSecondaryHref ? (
                <Link
                  href={renderedSecondaryHref}
                  className="rounded-full border border-[#5b2f22]/55 bg-[#fffaf4]/20 px-7 py-3.5 text-[14px] font-medium text-[#5b2f22] backdrop-blur-[2px] transition hover:bg-[#fffaf4]/45"
                >
                  {renderedSecondaryLabel}
                </Link>
              ) : null}
            </div>

            {features.length ? (
              <div className="mt-8 grid max-w-[625px] gap-0 border-t border-[#5b2f22]/14 pt-5 sm:grid-cols-3">
                {features.map((feature, index) => {
                  const Icon = featureIcons[index] ?? HeartHandshake;
                  return (
                    <div key={feature.title} className={`py-4 sm:px-5 ${index ? "sm:border-l sm:border-[#5b2f22]/14" : "sm:pr-5"}`}>
                      <div className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-[#f2d8c4]/88 text-[#934625]">
                        <Icon size={20} strokeWidth={1.55} />
                      </div>
                      <h2 className="moony-serif text-[25px] leading-none">{feature.title}</h2>
                      <p className="mt-2 max-w-[170px] text-[13px] leading-5 text-[#5b2f22]/72">{feature.body}</p>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      </section>
      <PublicFooter />
    </main>
  );
}
