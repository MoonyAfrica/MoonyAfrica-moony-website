import { Suspense } from "react";
import { ContactForm } from "@/components/contact-form";
import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-[#fbf5ee] text-[#5b2f22]">
      <PublicHeader active="" />
      <section className="mx-auto grid min-h-[820px] max-w-[1400px] gap-10 px-6 pb-16 pt-40 lg:grid-cols-[.85fr_1.15fr] lg:px-12">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.3em] text-[#a45b35]">Contact</p>
          <h1 className="moony-serif mt-4 text-6xl leading-[.98]">Parlons de vos besoins.</h1>
          <p className="mt-5 max-w-lg text-lg leading-8 text-[#5b2f22]/70">Vous représentez une entreprise, une institution, un professionnel de santé ou souhaitez simplement en savoir plus sur MOONY ? Notre équipe vous répond.</p>
          <div className="mt-10 space-y-5 text-sm">
            <div><strong className="moony-serif text-2xl font-normal">Professionnels</strong><p className="mt-1 max-w-md leading-6 text-[#5b2f22]/65">Abonnement, visibilité, rendez-vous et services MOONY Pro.</p></div>
            <div><strong className="moony-serif text-2xl font-normal">Entreprises & institutions</strong><p className="mt-1 max-w-md leading-6 text-[#5b2f22]/65">Démonstration, offre sur mesure, programmes collaborateurs et partenariats.</p></div>
            <div><strong className="moony-serif text-2xl font-normal">Partenaires & presse</strong><p className="mt-1 max-w-md leading-6 text-[#5b2f22]/65">Marketplace, contenus, collaborations, demandes médias et projets communs.</p></div>
          </div>
          <div className="mt-10 max-w-md rounded-[22px] border border-[#5b2f22]/10 bg-[#f4e3d7] p-5 text-xs leading-5 text-[#5b2f22]/62">Les informations envoyées ici servent uniquement à traiter votre demande commerciale, institutionnelle ou générale. N’envoyez pas de données médicales ou de documents de santé dans ce formulaire.</div>
        </div>
        <Suspense fallback={<div className="min-h-[560px] rounded-[28px] border border-[#5b2f22]/10 bg-white/60" />}>
          <ContactForm />
        </Suspense>
      </section>
      <PublicFooter />
    </main>
  );
}
