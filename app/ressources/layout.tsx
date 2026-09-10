import type { Metadata } from "next";
import { getPublishedPage } from "@/lib/cms";
import { buildCmsMetadata } from "@/lib/seo";

const fallbackDescription="Des contenus fiables, accessibles et utiles pour toutes les femmes, à chaque étape de leur vie.";

export async function generateMetadata():Promise<Metadata>{
 const page=await getPublishedPage("/ressources");
 return buildCmsMetadata({page,fallbackTitle:"Ressources — MOONY Africa",fallbackDescription,path:"/ressources"});
}

export default function ResourcesLayout({children}:{children:React.ReactNode}){return children;}
