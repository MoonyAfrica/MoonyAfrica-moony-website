import type { Metadata } from "next";
import { PublicProposalPortal } from "@/components/proposal-portal-client";

export const metadata:Metadata={
  title:"Proposition commerciale | MOONY",
  description:"Espace sécurisé de consultation d’une proposition commerciale MOONY.",
  robots:{index:false,follow:false},
  referrer:"no-referrer",
};

export default async function ProposalPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{token?:string|string[]}>}){
  const {id}=await params;const query=await searchParams;const token=Array.isArray(query.token)?query.token[0]??"":query.token??"";
  return <PublicProposalPortal proposalId={id} token={token}/>;
}
