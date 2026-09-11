type ReadinessBlocker={code:string;label:string;detail?:string|null;severity:"warning"|"critical"};
export type OnboardingReadiness={
  ready:boolean;
  percent:number;
  blockers:ReadinessBlocker[];
  counts:{tasksDone:number;tasksRequired:number;documentsValidated:number;documentsRequired:number};
  contractSigned:boolean;
  kickoffConfirmed:boolean;
  ownerAssigned:boolean;
  targetDateSet:boolean;
};

type TaskRow={template_key?:string|null;title:string;status:string;required:boolean};
type DocumentRow={name:string;status:string;required:boolean};
type ContractRow={status:string}|null;
type CaseRow={owner?:string|null;target_go_live_date?:string|null;kickoff_at?:string|null;kickoff_response?:string|null;status?:string|null};

export function computeOnboardingReadiness(input:{caseRow:CaseRow;tasks:TaskRow[];documents:DocumentRow[];contract:ContractRow}):OnboardingReadiness{
  const blockers:ReadinessBlocker[]=[];
  const requiredTasks=input.tasks.filter((row)=>row.required&&row.template_key!=="go-live-readiness");
  const tasksDone=requiredTasks.filter((row)=>row.status==="done").length;
  const requiredDocuments=input.documents.filter((row)=>row.required);
  const documentsValidated=requiredDocuments.filter((row)=>["validated","not_applicable"].includes(row.status)).length;
  const contractSigned=input.contract?.status==="signed";
  const kickoffConfirmed=Boolean(input.caseRow.kickoff_at)&&input.caseRow.kickoff_response==="confirmed";
  const ownerAssigned=Boolean(input.caseRow.owner?.trim());
  const targetDateSet=Boolean(input.caseRow.target_go_live_date);

  if(input.caseRow.status==="blocked")blockers.push({code:"case_blocked",label:"Dossier marqué comme bloqué",severity:"critical"});
  for(const row of requiredTasks.filter((task)=>task.status!=="done"))blockers.push({code:`task:${row.title}`,label:`Tâche requise : ${row.title}`,detail:row.status==="blocked"?"Cette tâche est bloquée.":"À terminer avant la mise en service.",severity:row.status==="blocked"?"critical":"warning"});
  for(const row of requiredDocuments.filter((document)=>!["validated","not_applicable"].includes(document.status)))blockers.push({code:`document:${row.name}`,label:`Document requis : ${row.name}`,detail:row.status==="rejected"?"Le document doit être corrigé puis revalidé.":"Le document doit être reçu et validé.",severity:row.status==="rejected"?"critical":"warning"});
  if(!contractSigned)blockers.push({code:"contract",label:"Contrat non signé",detail:"La dernière version du contrat doit être au statut Signé.",severity:"critical"});
  if(!input.caseRow.kickoff_at)blockers.push({code:"kickoff_date",label:"Kickoff non planifié",severity:"warning"});
  else if(input.caseRow.kickoff_response!=="confirmed")blockers.push({code:"kickoff_confirmation",label:"Kickoff non confirmé par le client",severity:"warning"});
  if(!ownerAssigned)blockers.push({code:"owner",label:"Responsable opérations non assigné",severity:"critical"});
  if(!targetDateSet)blockers.push({code:"target_date",label:"Date cible de go-live manquante",severity:"warning"});

  const total=Math.max(1,requiredTasks.length+requiredDocuments.length+4);
  const completed=tasksDone+documentsValidated+(contractSigned?1:0)+(kickoffConfirmed?1:0)+(ownerAssigned?1:0)+(targetDateSet?1:0);
  return {ready:blockers.length===0,percent:Math.min(100,Math.round(completed/total*100)),blockers,counts:{tasksDone,tasksRequired:requiredTasks.length,documentsValidated,documentsRequired:requiredDocuments.length},contractSigned,kickoffConfirmed,ownerAssigned,targetDateSet};
}

function relation<T>(value:T|T[]|null|undefined):T|null{return Array.isArray(value)?value[0]??null:value??null}

export async function loadOnboardingReadiness(supabase:any,onboardingId:string){
  const caseResult=await supabase.from("website_crm_onboarding_cases").select("id,lead_id,opportunity_id,status,owner,commercial_owner,target_go_live_date,kickoff_at,kickoff_response,readiness_status,readiness_checked_at,readiness_checked_by,readiness_notes,actual_go_live_at,go_live_by,go_live_notes,website_leads(id,first_name,last_name,email,company,country),website_crm_opportunities(id,name,amount,currency,owner)").eq("id",onboardingId).maybeSingle();
  if(caseResult.error||!caseResult.data)return null;
  const [tasksResult,documentsResult,contractsResult,clientResult]=await Promise.all([
    supabase.from("website_crm_onboarding_tasks").select("id,template_key,title,status,required,owner,due_at").eq("onboarding_id",onboardingId).order("sort_order",{ascending:true}),
    supabase.from("website_crm_onboarding_documents").select("id,name,status,required,due_at,document_url").eq("onboarding_id",onboardingId).order("created_at",{ascending:true}),
    supabase.from("website_crm_contracts").select("id,reference,version,title,status,effective_date,signed_at,signed_by,signed_by_email").eq("onboarding_id",onboardingId).order("version",{ascending:false}).limit(1),
    supabase.from("website_crm_client_accounts").select("*").eq("onboarding_id",onboardingId).maybeSingle(),
  ]);
  if(tasksResult.error||documentsResult.error)return null;
  const caseRow={...caseResult.data,website_leads:relation(caseResult.data.website_leads),website_crm_opportunities:relation(caseResult.data.website_crm_opportunities)};
  const contract=contractsResult.data?.[0]??null;
  const readiness=computeOnboardingReadiness({caseRow,tasks:tasksResult.data??[],documents:documentsResult.data??[],contract});
  return {case:caseRow,tasks:tasksResult.data??[],documents:documentsResult.data??[],contract,clientAccount:clientResult.error?null:clientResult.data??null,readiness};
}
