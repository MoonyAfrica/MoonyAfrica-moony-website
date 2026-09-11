"use client";

import Link from "next/link";
import {
  Activity, BarChart3, BookOpen, BookOpenCheck, Briefcase, Building2, CalendarDays, ClipboardCheck, ClipboardList, FileText, Flame, FolderOpen, Gauge, Handshake, HeartPulse, History,
  Image as ImageIcon, LayoutDashboard, Mail, Megaphone, Menu, MessageCircleMore, Network, Palette, Rocket, Settings,
  ShieldCheck, Sparkles, Target, TrendingUp, UserCog, Users, Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Session={permissions:string[]};
type Permission="site.read"|"content.read"|"crm.read"|"appointments.read"|"support.read"|"marketing.read"|"analytics.read"|"seo.read"|"settings.read"|"team.manage"|"audit.read";
type Item=readonly [string,string,typeof LayoutDashboard,Permission|null];

const groups:readonly {label:string;items:readonly Item[]}[]=[
 {label:"EXPÉRIENCE & CONTENU",items:[
  ["Dashboard","/admin",LayoutDashboard,null],
  ["Site & Design","/admin/site-design",Palette,"site.read"],
  ["Navigation & Footer","/admin/navigation",Menu,"site.read"],
  ["Pages","/admin/pages",FileText,"site.read"],
  ["Historique","/admin/historique",History,"site.read"],
  ["Médias","/admin/medias",ImageIcon,"content.read"],
  ["Ressources","/admin/ressources",FolderOpen,"content.read"],
  ["Articles","/admin/articles",BookOpen,"content.read"],
 ]},
 {label:"COMMERCIAL & RELATION CLIENT",items:[
  ["CRM","/admin/crm",Users,"crm.read"],
  ["Opportunités","/admin/opportunites",Briefcase,"crm.read"],
  ["Propositions","/admin/propositions",FileText,"crm.read"],
  ["Onboarding","/admin/onboarding",ClipboardCheck,"crm.read"],
  ["Portails clients","/admin/onboarding/portails",ShieldCheck,"crm.read"],
  ["Readiness","/admin/readiness",Rocket,"crm.read"],
  ["Clients actifs","/admin/clients",Building2,"crm.read"],
  ["Customer Success","/admin/customer-success",HeartPulse,"crm.read"],
  ["Portefeuille CS","/admin/customer-success/portfolio",BarChart3,"crm.read"],
  ["Escalades CS","/admin/customer-success/escalations",Flame,"crm.read"],
  ["Renewal Desk","/admin/customer-success/revenue",TrendingUp,"crm.read"],
  ["Plans de succès","/admin/customer-success/plans",Target,"crm.read"],
  ["Gouvernance compte","/admin/customer-success/governance",Network,"crm.read"],
  ["Rétention auto","/admin/customer-success/retention",Zap,"crm.read"],
  ["Scoring","/admin/scoring",Flame,"crm.read"],
  ["Playbooks","/admin/playbooks",BookOpenCheck,"crm.read"],
  ["Prévisions","/admin/previsions",TrendingUp,"crm.read"],
  ["Rendez-vous","/admin/rendez-vous",CalendarDays,"appointments.read"],
  ["Service client","/admin/service-client",MessageCircleMore,"support.read"],
 ]},
 {label:"MARKETING & ACQUISITION",items:[
  ["Marketing","/admin/marketing",Megaphone,"marketing.read"],
  ["Newsletters","/admin/newsletters",Mail,"marketing.read"],
  ["Pop-ups & bandeaux","/admin/popups",Sparkles,"marketing.read"],
 ]},
 {label:"MARQUE & CONFIANCE",items:[
  ["À propos","/admin/a-propos",ShieldCheck,"content.read"],
  ["Témoignages","/admin/temoignages",MessageCircleMore,"content.read"],
  ["Partenaires","/admin/partenaires",Handshake,"content.read"],
 ]},
 {label:"PERFORMANCE & SYSTÈME",items:[
  ["Centre d’activité","/admin/activite",Activity,null],
  ["Automatisations","/admin/automatisations",Zap,"settings.read"],
  ["Ciblage CRM","/admin/automatisations/crm",Target,"settings.read"],
  ["Analytique","/admin/analytics",BarChart3,"analytics.read"],
  ["SEO","/admin/seo",Gauge,"seo.read"],
  ["Paramètres","/admin/parametres",Settings,"settings.read"],
  ["Équipe & rôles","/admin/equipe",UserCog,"team.manage"],
  ["Journal d’activité","/admin/journal-activite",ClipboardList,"audit.read"],
 ]},
];

function allowed(session:Session|null,permission:Permission|null){
 if(permission===null)return true;
 if(!session)return false;
 return session.permissions.includes("*")||session.permissions.includes(permission);
}

export function AdminRoleNavigation({active}:{active:string}){
 const [session,setSession]=useState<Session|null>(null);const [loaded,setLoaded]=useState(false);
 useEffect(()=>{fetch("/api/admin/session",{cache:"no-store"}).then(r=>r.json()).then(data=>setSession(data.session??null)).finally(()=>setLoaded(true))},[]);
 const visible=useMemo(()=>groups.map(group=>({...group,items:group.items.filter(item=>allowed(session,item[3]))})).filter(group=>group.items.length),[session]);
 if(!loaded)return <div className="mt-6 space-y-3 border-t border-[#5b2f22]/10 pt-4" aria-label="Chargement de la navigation"><div className="h-7 animate-pulse rounded-lg bg-white/45"/><div className="h-7 animate-pulse rounded-lg bg-white/35"/><div className="h-7 animate-pulse rounded-lg bg-white/25"/></div>;
 return <div className="mt-6 border-t border-[#5b2f22]/10 pt-3">{visible.map(group=><div key={group.label} className="mb-4"><p className="mb-1.5 px-3 text-[8px] font-semibold uppercase tracking-[.15em] text-[#5b2f22]/42">{group.label}</p><nav className="space-y-[2px]" aria-label={group.label}>{group.items.map(([label,href,Icon])=><Link key={href} href={href} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[12px] transition ${active===label?"bg-[#ead1bf] font-semibold text-[#6f2d17] shadow-[inset_3px_0_0_#a95832]":"text-[#42271f]/74 hover:bg-white/55 hover:text-[#5b2f22]"}`}><Icon size={16} strokeWidth={1.65}/><span>{label}</span></Link>)}</nav></div>)}</div>;
}
