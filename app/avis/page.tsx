import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";
import { TestimonialForm } from "@/components/testimonial-form";

export default function TestimonialPage(){
 return <main className="min-h-screen bg-[#fffaf4] text-[#4d281d]"><PublicHeader active=""/><section className="bg-[linear-gradient(120deg,#f8efe5,#ead8ca)] px-6 pb-16 pt-40 lg:px-12"><div className="mx-auto max-w-[1050px]"><p className="text-xs font-semibold uppercase tracking-[.3em] text-[#9d4c27]">Votre expérience compte</p><h1 className="moony-serif mt-4 max-w-[850px] text-[58px] leading-[.98] tracking-[-.045em] sm:text-[72px]">Partagez votre expérience avec MOONY.</h1><p className="mt-6 max-w-[700px] text-lg leading-8 text-[#5b2f22]/70">Votre témoignage peut aider d’autres femmes à se projeter, comprendre et avancer. Chaque avis est relu avant publication.</p></div></section><section className="mx-auto grid max-w-[1050px] gap-8 px-6 py-14 lg:grid-cols-[.75fr_1.25fr] lg:px-12 lg:py-20"><div><h2 className="moony-serif text-4xl">Un espace respectueux.</h2><p className="mt-4 text-sm leading-6 text-[#5b2f22]/65">Nous ne publions aucun avis automatiquement. Vous gardez le contrôle sur les informations que vous choisissez de partager et nous évitons d’afficher des données personnelles inutiles.</p></div><TestimonialForm/></section><PublicFooter/></main>;
}
