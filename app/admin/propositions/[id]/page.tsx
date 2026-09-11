import type { Metadata } from "next";
import Link from "next/link";
import { ProposalDocumentView } from "@/components/proposal-portal-client";
import { loadProposalPortalDocument } from "@/lib/crm-proposal-portal";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const metadata:Metadata={title:"Aperçu proposition | MOONY Control Center",robots:{index:false,follow:false}};

export default async function ProposalPreviewPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;const supabase=getSupabaseAdmin();const document=supabase?await loadProposalPortalDocument(supabase,id):null;
  if(!document)return <main className="grid min-h-screen place-items-center bg-[#f8f0e5] p-6 text-[#5b2f22]"><div className="max-w-lg rounded-3xl border border-[#d9c0ac] bg-[#fffaf4] p-8 text-center"><div className="text-2xl font-semibold tracking-[.16em]">MOONY</div><h1 className="mt-7 font-serif text-3xl">Aperçu indisponible</h1><p className="mt-3 text-sm leading-6 text-[#5b2f22]/60">Vérifiez que la proposition existe et que la migration CRM V6.1 est appliquée.</p><Link href="/admin/propositions" className="mt-6 inline-block rounded-full bg-[#7e3518] px-5 py-2.5 text-sm text-white">Retour aux propositions</Link></div></main>;
  return <ProposalDocumentView document={document}/>;
}
