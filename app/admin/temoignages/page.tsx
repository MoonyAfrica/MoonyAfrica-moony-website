import { AdminCard, AdminWorkspace } from "@/components/admin-workspace";

const testimonials = [
  ["Marie Koffi","Abidjan, Côte d’Ivoire","MOONY a changé ma vision de la maternité.","Approuvé"],
  ["Fatou Bâ","Dakar, Sénégal","Une marque qui comprend vraiment nos réalités.","Approuvé"],
  ["Claire Dubois","Bruxelles, Belgique","Des produits magnifiques et une ambiance bienveillante.","En attente"],
  ["Awa Diop","Saint-Louis, Sénégal","Enfin une marque qui célèbre notre féminité africaine.","Approuvé"],
];

export default function TestimonialsAdmin(){return <AdminWorkspace active="Témoignages" title="Témoignages" subtitle="Modérez, validez et mettez en avant les retours de la communauté MOONY." actions={<button className="rounded-lg bg-[#7e3518] px-5 py-2.5 text-sm text-white">+ Ajouter un témoignage</button>}>
<div className="grid gap-4 sm:grid-cols-4">{[["Tous","28"],["Approuvés","20"],["En attente","5"],["Mis en avant","6"]].map(([l,v])=><div key={l} className="admin-card admin-shadow p-5"><p className="text-xs text-[#5b2f22]/45">{l}</p><p className="moony-serif mt-2 text-4xl">{v}</p></div>)}</div>
<div className="mt-4"><AdminCard title="Témoignages clients"><div className="space-y-3">{testimonials.map(([name,place,text,status])=><div key={name} className="grid gap-4 rounded-xl border border-[#5b2f22]/8 bg-white p-4 md:grid-cols-[1fr_2fr_auto] md:items-center"><div><strong className="block text-sm">{name}</strong><span className="text-xs text-[#5b2f22]/45">{place}</span></div><div><div className="text-amber-500">★★★★★</div><p className="mt-1 text-sm text-[#5b2f22]/70">« {text} »</p></div><div className="flex items-center gap-3"><span className={`rounded-full px-3 py-1 text-xs ${status==="Approuvé"?"bg-emerald-100 text-emerald-800":"bg-amber-100 text-amber-800"}`}>{status}</span><button className="text-sm">•••</button></div></div>)}</div></AdminCard></div>
</AdminWorkspace>}
