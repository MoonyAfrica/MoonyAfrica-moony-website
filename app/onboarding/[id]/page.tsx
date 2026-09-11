import type { Metadata } from "next";
import { PublicOnboardingPortal } from "@/components/onboarding-portal-client";

export const metadata:Metadata={
  title:"Onboarding client | MOONY",
  description:"Espace sécurisé d’onboarding client MOONY.",
  robots:{index:false,follow:false},
  referrer:"no-referrer",
};

export default async function OnboardingClientPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{token?:string|string[]}>}){
  const {id}=await params;const query=await searchParams;const token=Array.isArray(query.token)?query.token[0]??"":query.token??"";
  return <PublicOnboardingPortal onboardingId={id} token={token}/>;
}
