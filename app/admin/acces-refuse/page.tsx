import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { MoonyLogo } from "@/components/moony-logo";

export default function AccessDeniedPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_left,#f2d9c7,transparent_36%),linear-gradient(135deg,#fbf7f2,#f5e9df)] px-5 text-[#4b271d]">
      <section className="w-full max-w-lg rounded-[30px] border border-[#5b2f22]/10 bg-white/90 p-8 shadow-[0_28px_100px_rgba(74,35,23,.12)] backdrop-blur-xl sm:p-10">
        <MoonyLogo compact />
        <div className="mt-10 grid h-12 w-12 place-items-center rounded-2xl bg-amber-50 text-amber-700"><ShieldAlert size={22} /></div>
        <h1 className="moony-serif mt-5 text-4xl">Accès limité</h1>
        <p className="mt-3 text-sm leading-6 text-[#5b2f22]/60">Votre compte est bien connecté, mais son rôle ne permet pas d’ouvrir cette partie du Control Center. Les données du module restent protégées côté serveur.</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/admin" className="inline-flex items-center gap-2 rounded-full bg-[#7e3518] px-5 py-3 text-sm font-semibold text-white"><ArrowLeft size={14} />Retour au Dashboard</Link>
          <Link href="/admin/mon-compte" className="rounded-full border border-[#5b2f22]/12 bg-white px-5 py-3 text-sm font-semibold text-[#5b2f22]">Voir mon compte</Link>
        </div>
        <p className="mt-7 text-[11px] leading-5 text-[#5b2f22]/40">Si vous avez besoin de ce module pour votre mission, un compte Founder peut ajuster votre rôle depuis « Équipe & rôles ».</p>
      </section>
    </main>
  );
}
