import { AdminCard, AdminWorkspace } from "@/components/admin-workspace";

const pages = [
  ["Accueil", "/", "Publié"], ["Notre mission", "/notre-mission", "Publié"], ["Notre approche", "/notre-approche", "Publié"], ["À propos", "/a-propos", "Publié"], ["Nos services", "/services", "Publié"], ["Communauté", "/communaute", "Publié"], ["Ressources", "/ressources", "Publié"], ["Nous contacter", "/contact", "Brouillon"], ["Mentions légales", "/mentions-legales", "Brouillon"]
];

export default function PagesAdmin() {
  return <AdminWorkspace active="Pages" title="Pages" subtitle="Gérez la structure, le contenu et la publication de toutes les pages du site." actions={<button className="rounded-lg bg-[#7e3518] px-5 py-2.5 text-sm text-white">+ Nouvelle page</button>}>
    <AdminCard title="Toutes les pages"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="text-xs text-[#5b2f22]/45"><tr><th className="pb-3">Titre</th><th>URL</th><th>Dernière modification</th><th>Statut</th><th></th></tr></thead><tbody>{pages.map(([title,url,status],i)=><tr key={title} className="border-t border-[#5b2f22]/8"><td className="py-4 font-medium">{title}</td><td className="text-[#5b2f22]/55">{url}</td><td className="text-[#5b2f22]/55">{30-i*2} mai 2024</td><td><span className={`rounded-full px-3 py-1 text-xs ${status==="Publié"?"bg-emerald-100 text-emerald-800":"bg-amber-100 text-amber-800"}`}>{status}</span></td><td className="text-right">•••</td></tr>)}</tbody></table></div></AdminCard>
  </AdminWorkspace>;
}
