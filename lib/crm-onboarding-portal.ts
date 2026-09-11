import { createHash, timingSafeEqual } from "node:crypto";

export const ONBOARDING_DOCUMENT_BUCKET = "onboarding-documents";

export type OnboardingClientProfile = {
  legalName?:string;
  registrationNumber?:string;
  billingEmail?:string;
  billingAddress?:string;
  signatoryName?:string;
  signatoryTitle?:string;
  signatoryEmail?:string;
  operationsContactName?:string;
  operationsContactEmail?:string;
  operationsContactPhone?:string;
  clientNote?:string;
};

export type OnboardingPortalDocument = {
  onboarding:{
    id:string;status:string;owner:string|null;commercial_owner:string|null;handoff_at:string;kickoff_at:string|null;
    target_go_live_date:string|null;client_profile:OnboardingClientProfile;kickoff_response:string;kickoff_response_at:string|null;
    kickoff_response_name:string|null;kickoff_response_message:string|null;
  };
  client:{id:string;first_name:string;last_name:string;email:string;company:string|null;country:string|null}|null;
  opportunity:{id:string;name:string;amount:number;currency:string}|null;
  proposal:{id:string;reference:string;title:string;total_amount:number;currency:string}|null;
  contract:{reference:string;version:number;title:string;status:string;effective_date:string|null;signed_at:string|null}|null;
  tasks:Array<{id:string;title:string;category:string;status:string;required:boolean;due_at:string|null}>;
  documents:Array<{id:string;name:string;description:string|null;status:string;required:boolean;due_at:string|null;submissions:Array<{id:string;original_name:string;mime_type:string;file_size:number;status:string;created_at:string;download_url:string|null}>}>;
  progress:{completed:number;total:number;percent:number};
};

function relation<T>(value:T|T[]|null|undefined):T|null{return Array.isArray(value)?value[0]??null:value??null}

export function onboardingPortalTokenHash(onboardingId:string,token:string){
  return createHash("sha256").update(`${onboardingId}.${token}`).digest("hex");
}

export function verifyOnboardingPortalToken(onboardingId:string,token:string,storedHash:string|null|undefined){
  if(!token||!storedHash)return false;
  try{
    const expected=Buffer.from(storedHash,"hex");
    const actual=Buffer.from(onboardingPortalTokenHash(onboardingId,token),"hex");
    return expected.length===actual.length&&timingSafeEqual(expected,actual);
  }catch{return false}
}

export async function authorizeOnboardingPortal(supabase:any,id:string,token:string){
  const result=await supabase.from("website_crm_onboarding_cases").select("id,client_portal_token_hash,client_portal_enabled,status,lead_id,opportunity_id,proposal_id").eq("id",id).maybeSingle();
  if(result.error||!result.data||!result.data.client_portal_enabled||!verifyOnboardingPortalToken(id,token,result.data.client_portal_token_hash))return null;
  return result.data;
}

export async function loadOnboardingPortalDocument(supabase:any,id:string):Promise<OnboardingPortalDocument|null>{
  const caseResult=await supabase.from("website_crm_onboarding_cases").select("id,status,owner,commercial_owner,handoff_at,kickoff_at,target_go_live_date,client_profile,kickoff_response,kickoff_response_at,kickoff_response_name,kickoff_response_message,website_leads(id,first_name,last_name,email,company,country),website_crm_opportunities(id,name,amount,currency),website_crm_proposals(id,reference,title,total_amount,currency)").eq("id",id).maybeSingle();
  if(caseResult.error||!caseResult.data)return null;
  const [tasksResult,documentsResult,contractResult,submissionsResult]=await Promise.all([
    supabase.from("website_crm_onboarding_tasks").select("id,title,category,status,required,due_at").eq("onboarding_id",id).eq("client_visible",true).order("sort_order",{ascending:true}),
    supabase.from("website_crm_onboarding_documents").select("id,name,description,status,required,due_at").eq("onboarding_id",id).eq("client_visible",true).order("created_at",{ascending:true}),
    supabase.from("website_crm_contracts").select("reference,version,title,status,effective_date,signed_at").eq("onboarding_id",id).order("version",{ascending:false}).limit(1),
    supabase.from("website_crm_onboarding_submissions").select("id,document_id,original_name,storage_path,mime_type,file_size,status,created_at").eq("onboarding_id",id).order("created_at",{ascending:false}),
  ]);
  if(tasksResult.error||documentsResult.error)return null;
  const byDocument=new Map<string,any[]>();
  for(const row of submissionsResult.data??[]){
    let downloadUrl:string|null=null;
    const signed=await supabase.storage.from(ONBOARDING_DOCUMENT_BUCKET).createSignedUrl(row.storage_path,1800);
    if(!signed.error)downloadUrl=signed.data?.signedUrl??null;
    const item={id:String(row.id),original_name:String(row.original_name),mime_type:String(row.mime_type),file_size:Number(row.file_size||0),status:String(row.status),created_at:String(row.created_at),download_url:downloadUrl};
    const key=String(row.document_id);const list=byDocument.get(key)??[];list.push(item);byDocument.set(key,list);
  }
  const tasks=(tasksResult.data??[]).map((row:any)=>({...row,id:String(row.id),required:Boolean(row.required)}));
  const documents=(documentsResult.data??[]).map((row:any)=>({...row,id:String(row.id),required:Boolean(row.required),submissions:byDocument.get(String(row.id))??[]}));
  const total=tasks.length+documents.length;
  const completed=tasks.filter((row:any)=>row.status==="done").length+documents.filter((row:any)=>["validated","not_applicable"].includes(row.status)).length;
  const data=caseResult.data;
  return {
    onboarding:{id:String(data.id),status:String(data.status),owner:data.owner??null,commercial_owner:data.commercial_owner??null,handoff_at:String(data.handoff_at),kickoff_at:data.kickoff_at??null,target_go_live_date:data.target_go_live_date??null,client_profile:(data.client_profile??{}) as OnboardingClientProfile,kickoff_response:String(data.kickoff_response||"pending"),kickoff_response_at:data.kickoff_response_at??null,kickoff_response_name:data.kickoff_response_name??null,kickoff_response_message:data.kickoff_response_message??null},
    client:relation<any>(data.website_leads),
    opportunity:relation<any>(data.website_crm_opportunities),
    proposal:relation<any>(data.website_crm_proposals),
    contract:relation<any>(contractResult.data),
    tasks,
    documents,
    progress:{completed,total,percent:total?Math.round(completed/total*100):100},
  };
}
