import { randomUUID } from "node:crypto";
import { loadProposalPortalDocument } from "@/lib/crm-proposal-portal";

type EnsureInput={opportunityId:string;proposalId?:string|null;actor?:string|null};

function one<T>(value:T|T[]|null|undefined):T|null{return Array.isArray(value)?value[0]??null:value??null}
function text(value:unknown){return typeof value==="string"?value.trim():""}
function datePlus(days:number){return new Date(Date.now()+days*86400000).toISOString()}
function contractReference(){return `MNY-CTR-${new Date().getFullYear()}-${randomUUID().slice(0,8).toUpperCase()}`}

function contractBody(input:{client:string;opportunity:string;proposalReference?:string|null;total?:number|null;currency?:string|null;items?:Array<{name:string;quantity:number;total_amount:number}>}){
 const lines=(input.items??[]).map((item)=>`- ${item.name} · quantité ${item.quantity} · ${Number(item.total_amount||0).toLocaleString("fr-FR")} ${input.currency||""}`);
 return [
  "BROUILLON DE TRAVAIL — À VALIDER JURIDIQUEMENT AVANT ENVOI OU SIGNATURE",
  "",
  `Client : ${input.client}`,
  `Opportunité : ${input.opportunity}`,
  input.proposalReference?`Proposition commerciale de référence : ${input.proposalReference}`:"",
  input.total!=null?`Montant commercial de référence : ${Number(input.total||0).toLocaleString("fr-FR")} ${input.currency||""}`:"",
  "",
  "1. Objet",
  "Le présent brouillon reprend le périmètre commercial validé entre le client et MOONY afin de préparer la contractualisation et l'onboarding opérationnel.",
  "",
  "2. Périmètre de services",
  ...(lines.length?lines:["- À compléter à partir de l'offre ou du périmètre convenu."]),
  "",
  "3. Déploiement et onboarding",
  "Les modalités de démarrage, responsables, calendrier, livrables et prérequis sont suivis dans le dossier d'onboarding MOONY associé.",
  "",
  "4. Données, confidentialité et conformité",
  "Les clauses applicables à la confidentialité, à la protection des données et aux éventuels traitements de données de santé doivent être revues et validées par les conseils compétents avant signature.",
  "",
  "5. Conditions juridiques et financières",
  "À compléter et valider juridiquement : durée, paiement, résiliation, responsabilité, droit applicable, propriété intellectuelle, protection des données et annexes éventuelles.",
  "",
  "6. Signatures",
  "Les informations du ou des signataires et la version finale du contrat doivent être validées avant passage au statut Prêt à envoyer.",
 ].filter(Boolean).join("\n");
}

export async function ensureCrmOnboarding(supabase:any,input:EnsureInput){
 const existing=await supabase.from("website_crm_onboarding_cases").select("id,opportunity_id,proposal_id,status").eq("opportunity_id",input.opportunityId).maybeSingle();
 if(!existing.error&&existing.data)return{created:false,case:existing.data};
 if(existing.error&&!["PGRST116","42P01"].includes(existing.error.code||""))throw new Error(existing.error.message);
 if(existing.error?.code==="42P01")return{created:false,available:false,case:null};

 const opportunityResult=await supabase.from("website_crm_opportunities").select("id,lead_id,name,stage,owner,amount,currency,website_leads(id,first_name,last_name,email,company,country)").eq("id",input.opportunityId).maybeSingle();
 if(opportunityResult.error||!opportunityResult.data)throw new Error(opportunityResult.error?.message||"Opportunité introuvable.");
 const opportunity=opportunityResult.data;if(opportunity.stage!=="won")return{created:false,available:true,case:null,reason:"opportunity_not_won"};
 const lead=one<any>(opportunity.website_leads);
 let proposalId=input.proposalId||null;
 if(!proposalId){const accepted=await supabase.from("website_crm_proposals").select("id").eq("opportunity_id",input.opportunityId).eq("status","accepted").order("accepted_at",{ascending:false}).limit(1);proposalId=accepted.data?.[0]?.id??null}
 const actor=text(input.actor)||"MOONY Automatisation";
 const created=await supabase.from("website_crm_onboarding_cases").insert({opportunity_id:opportunity.id,proposal_id:proposalId,lead_id:opportunity.lead_id,status:"handoff",owner:null,commercial_owner:opportunity.owner||null,created_by:actor,updated_by:actor}).select("*").single();
 if(created.error){if(created.error.code==="23505"){const retry=await supabase.from("website_crm_onboarding_cases").select("*").eq("opportunity_id",input.opportunityId).single();return{created:false,available:true,case:retry.data}}throw new Error(created.error.message)}
 const onboarding=created.data;

 const tasks=[
  {template_key:"commercial-handoff",title:"Valider le passage Commercial → Opérations",category:"handoff",status:"todo",required:true,owner:opportunity.owner||null,due_at:datePlus(1),sort_order:10},
  {template_key:"contract-review",title:"Relire et valider juridiquement le contrat",category:"contract",status:"todo",required:true,due_at:datePlus(3),sort_order:20},
  {template_key:"documents-collect",title:"Collecter les documents et informations client",category:"documents",status:"todo",required:true,due_at:datePlus(5),sort_order:30},
  {template_key:"kickoff-schedule",title:"Planifier le rendez-vous de kickoff",category:"kickoff",status:"todo",required:true,due_at:datePlus(7),sort_order:40},
  {template_key:"implementation-plan",title:"Valider le plan de déploiement",category:"implementation",status:"todo",required:true,due_at:datePlus(10),sort_order:50},
  {template_key:"go-live-readiness",title:"Contrôler les prérequis avant mise en service",category:"launch",status:"todo",required:true,due_at:datePlus(14),sort_order:60},
 ];
 await supabase.from("website_crm_onboarding_tasks").insert(tasks.map((row)=>({...row,onboarding_id:onboarding.id})));
 // V7.1 only: this update is intentionally best-effort so CRM V7 remains usable before the portal migration is applied.
 await supabase.from("website_crm_onboarding_tasks").update({client_visible:true}).eq("onboarding_id",onboarding.id).in("template_key",["documents-collect","kickoff-schedule","implementation-plan","go-live-readiness"]);

 const documents=[
  {name:"Identité juridique de l'organisation",description:"Dénomination, adresse, identifiants légaux utiles au contrat et à la facturation.",status:"required",required:true,due_at:datePlus(5)},
  {name:"Coordonnées de facturation",description:"Contact, adresse et informations nécessaires à la facturation.",status:"required",required:true,due_at:datePlus(5)},
  {name:"Contact signataire",description:"Nom, fonction et coordonnées de la personne habilitée à signer.",status:"required",required:true,due_at:datePlus(3)},
  {name:"Éléments de déploiement",description:"Périmètre, population cible, interlocuteurs opérationnels et contraintes de démarrage.",status:"required",required:true,due_at:datePlus(7)},
  {name:"Accord de traitement des données si applicable",description:"À utiliser uniquement si le déploiement implique un traitement nécessitant un accord ou une annexe dédiée.",status:"required",required:false,due_at:datePlus(7)},
 ];
 await supabase.from("website_crm_onboarding_documents").insert(documents.map((row)=>({...row,onboarding_id:onboarding.id})));

 let proposalDocument:any=null;if(proposalId)proposalDocument=await loadProposalPortalDocument(supabase,proposalId);
 const client=lead?.company||`${lead?.first_name||""} ${lead?.last_name||""}`.trim()||"Client MOONY";
 const body=contractBody({client,opportunity:opportunity.name,proposalReference:proposalDocument?.proposal.reference??null,total:proposalDocument?.proposal.total_amount??opportunity.amount,currency:proposalDocument?.proposal.currency??opportunity.currency,items:proposalDocument?.items??[]});
 await supabase.from("website_crm_contracts").insert({onboarding_id:onboarding.id,proposal_id:proposalId,reference:contractReference(),version:1,title:`Convention commerciale — ${client}`,status:"draft",body,created_by:actor,updated_by:actor});
 await supabase.from("website_crm_onboarding_events").insert({onboarding_id:onboarding.id,event_type:"created",title:"Dossier d'onboarding créé",detail:`Opportunité « ${opportunity.name} » signée. Passage du commercial vers l'équipe opérationnelle à organiser.`,actor});

 for(const role of ["founder","admin","sales"]){await supabase.from("control_center_generated_notifications").insert({target_role:role,title:"Nouveau client à onboarder",subtitle:`${client} · dossier post-signature créé`,href:`/admin/onboarding?case=${onboarding.id}`,severity:"info",source_type:"crm_onboarding",source_id:String(onboarding.id)})}
 return{created:true,available:true,case:onboarding};
}

export async function syncWonOpportunitiesToOnboarding(supabase:any){
 const result=await supabase.from("website_crm_opportunities").select("id").eq("stage","won").order("updated_at",{ascending:false}).limit(250);
 if(result.error){if(result.error.code==="42P01")return{available:false,created:0,errors:[] as string[]};throw new Error(result.error.message)}
 let created=0;const errors:string[]=[];
 for(const row of result.data??[]){try{const outcome=await ensureCrmOnboarding(supabase,{opportunityId:String(row.id),actor:"MOONY Automatisation"});if(outcome.created)created+=1}catch(error){errors.push(error instanceof Error?error.message:"Erreur onboarding")}}
 return{available:true,created,errors};
}
