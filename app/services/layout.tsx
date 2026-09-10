import type { Metadata } from "next";
import { getPublishedPage } from "@/lib/cms";
import { buildCmsMetadata } from "@/lib/seo";

const fallbackDescription="Prévention, accompagnement, soins et bien-être : MOONY réunit des services utiles, accessibles et fiables pour les femmes, les professionnels de santé et les organisations.";

export async function generateMetadata():Promise<Metadata>{
 const page=await getPublishedPage("/services");
 return buildCmsMetadata({page,fallbackTitle:"Nos services — MOONY Africa",fallbackDescription,path:"/services"});
}

export default function ServicesLayout({children}:{children:React.ReactNode}){return children;}
