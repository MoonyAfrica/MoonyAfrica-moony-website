import type { Metadata } from "next";
import { CustomerFeedbackForm } from "@/components/customer-feedback-form";

export const metadata:Metadata={title:"Votre avis · MOONY",description:"Espace de retour client MOONY",robots:{index:false,follow:false,nocache:true}};

export default async function CustomerFeedbackPage({params}:{params:Promise<{id:string}>}){const {id}=await params;return <CustomerFeedbackForm surveyId={id}/>}
