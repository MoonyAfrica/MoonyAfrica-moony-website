import { HelpCircle, LockKeyhole, MessageCircleMore, ShieldCheck } from "lucide-react";
import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";
import { SupportForm } from "@/components/support-form";

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-[#fbf5ee] text-[#5b2f22]">
      <PublicHeader active="" />
      <section className="moony-paper border-b border-[#5b2f22]/10 pt-36">
        <div className="mx-auto grid max-w-[1500px] gap-10 px-6 pb-16 lg:grid-cols-[.85fr_1.15fr] lg:items-start lg:px-12 lg:pb-24">
          <div className="max-w-xl pt-5">
            <p className="text-[11px] font-semibold uppercase tracking-[.3em] text-[#9d4c27]">Service client</p>
            <h1 className="moony-serif mt-4 text-[54px] leading-[.96] tracking-[-.045em] sm:text-[68px]">Une question ?<br />Nous sommes là.</h1>
            <p className="mt-6 max-w-lg text-[16px] leading-7 text-[#5b2f22]/70">Pour une question sur le site, un abonnement professionnel, un accès, un paiement ou une demande générale, écrivez à l’équipe MOONY. Votre demande sera enregistrée dans notre espace de suivi afin de pouvoir vous répondre et suivre sa résolution.</p>
            <div className="mt-9 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[20px] border border-[#5b2f22]/10 bg-white/58 p-5"><MessageCircleMore size={20} strokeWidth={1.5} className="text-[#9d4c27]" /><h2 className="moony-serif mt-4 text-2xl">Suivi centralisé</h2><p className="mt-2 text-xs leading-5 text-[#5b2f22]/58">Chaque demande dispose d’un statut et d’un historique de réponses.</p></div>
              <div className="rounded-[20px] border border-[#5b2f22]/10 bg-white/58 p-5"><LockKeyhole size={20} strokeWidth={1.5} className="text-[#9d4c27]" /><h2 className="moony-serif mt-4 text-2xl">Données minimales</h2><p className="mt-2 text-xs leading-5 text-[#5b2f22]/58">Nous demandons uniquement ce qui est utile pour traiter votre requête.</p></div>
              <div className="rounded-[20px] border border-[#5b2f22]/10 bg-white/58 p-5"><HelpCircle size={20} strokeWidth={1.5} className="text-[#9d4c27]" /><h2 className="moony-serif mt-4 text-2xl">Bonne orientation</h2><p className="mt-2 text-xs leading-5 text-[#5b2f22]/58">Les demandes peuvent être affectées à la bonne personne dans l’équipe.</p></div>
              <div className="rounded-[20px] border border-[#5b2f22]/10 bg-white/58 p-5"><ShieldCheck size={20} strokeWidth={1.5} className="text-[#9d4c27]" /><h2 className="moony-serif mt-4 text-2xl">Confidentialité</h2><p className="mt-2 text-xs leading-5 text-[#5b2f22]/58">Le formulaire de support n’est pas destiné à recevoir un dossier médical complet.</p></div>
            </div>
          </div>
          <SupportForm />
        </div>
      </section>
      <PublicFooter />
    </main>
  );
}
