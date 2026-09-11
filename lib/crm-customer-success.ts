export type CustomerHealthStatus="healthy"|"watch"|"at_risk"|"critical";
export type CustomerHealthReason={code:string;label:string;delta:number;severity:"info"|"warning"|"critical"};
export type CustomerHealth={score:number;status:CustomerHealthStatus;reasons:CustomerHealthReason[]};

type HealthInput={
 status?:string|null;
 adoptionScore?:number|null;
 npsScore?:number|null;
 lastSuccessContactAt?:string|null;
 nextSuccessReviewAt?:string|null;
 renewalDate?:string|null;
 churnRiskNotes?:string|null;
 highPrioritySupportCount?:number;
};

function relation<T>(value:T|T[]|null|undefined):T|null{return Array.isArray(value)?value[0]??null:value??null}
function clamp(value:number,min:number,max:number){return Math.max(min,Math.min(max,value))}
function dayDiff(value:string|null|undefined,now=Date.now()){
 if(!value)return null;const time=new Date(value).getTime();if(Number.isNaN(time))return null;return Math.floor((now-time)/86400000);
}
function daysUntil(value:string|null|undefined,now=Date.now()){
 if(!value)return null;const time=new Date(value).getTime();if(Number.isNaN(time))return null;return Math.ceil((time-now)/86400000);
}
function healthStatus(score:number):CustomerHealthStatus{return score>=80?"healthy":score>=60?"watch":score>=40?"at_risk":"critical"}

export function computeCustomerHealth(input:HealthInput,now=Date.now()):CustomerHealth{
 let score=100;const reasons:CustomerHealthReason[]=[];
 const add=(code:string,label:string,delta:number,severity:CustomerHealthReason["severity"]="warning")=>{score+=delta;reasons.push({code,label,delta,severity})};
 if(input.status==="paused")add("paused","Compte client en pause",-25,"critical");
 if(input.status==="offboarded")return{score:0,status:"critical",reasons:[{code:"offboarded",label:"Client sorti du portefeuille actif",delta:-100,severity:"critical"}]};
 if(input.adoptionScore==null)add("adoption_unknown","Adoption non évaluée",-10,"info");
 else if(input.adoptionScore<30)add("adoption_critical",`Adoption faible (${input.adoptionScore} %)`,-35,"critical");
 else if(input.adoptionScore<60)add("adoption_low",`Adoption à renforcer (${input.adoptionScore} %)`,-20,"warning");
 else if(input.adoptionScore<80)add("adoption_watch",`Adoption encore perfectible (${input.adoptionScore} %)`,-8,"info");
 else if(input.adoptionScore>=90)add("adoption_strong",`Adoption forte (${input.adoptionScore} %)`,3,"info");
 if(input.npsScore==null)add("nps_unknown","NPS non mesuré",-5,"info");
 else if(input.npsScore<=6)add("nps_detractor",`NPS détracteur (${input.npsScore}/10)`,-25,"critical");
 else if(input.npsScore<=8)add("nps_passive",`NPS passif (${input.npsScore}/10)`,-8,"warning");
 else add("nps_promoter",`NPS promoteur (${input.npsScore}/10)`,5,"info");
 const contactAge=dayDiff(input.lastSuccessContactAt,now);
 if(contactAge==null)add("contact_unknown","Dernier contact Customer Success non renseigné",-15,"warning");
 else if(contactAge>60)add("contact_stale",`Aucun suivi Customer Success depuis ${contactAge} jours`,-20,"critical");
 else if(contactAge>30)add("contact_aging",`Dernier suivi il y a ${contactAge} jours`,-10,"warning");
 const reviewDelta=daysUntil(input.nextSuccessReviewAt,now);
 if(reviewDelta!=null&&reviewDelta<0)add("review_overdue",`Revue client en retard de ${Math.abs(reviewDelta)} jour${Math.abs(reviewDelta)>1?"s":""}`,-15,"critical");
 else if(reviewDelta!=null&&reviewDelta<=7)add("review_due",`Revue client prévue dans ${Math.max(0,reviewDelta)} jour${reviewDelta>1?"s":""}`,-5,"info");
 const renewalDelta=daysUntil(input.renewalDate,now);
 if(renewalDelta!=null&&renewalDelta>=0&&renewalDelta<=30&&(contactAge==null||contactAge>14))add("renewal_unprepared",`Renouvellement dans ${renewalDelta} jours sans suivi récent`,-10,"warning");
 const tickets=Number(input.highPrioritySupportCount||0);
 if(tickets>=2)add("support_multiple",`${tickets} tickets support prioritaires ouverts`,-20,"critical");
 else if(tickets===1)add("support_open","1 ticket support prioritaire ouvert",-10,"warning");
 if(input.churnRiskNotes?.trim())add("explicit_risk","Risque de churn signalé par l’équipe",-15,"critical");
 score=clamp(score,0,100);
 return{score,status:healthStatus(score),reasons};
}

export async function loadCustomerSuccessData(supabase:any){
 const accountsResult=await supabase.from("website_crm_client_accounts").select("*,website_leads(id,first_name,last_name,email,company,country,need,source),website_crm_onboarding_cases(id,status,actual_go_live_at),website_crm_opportunities(id,name,amount,currency,owner)").order("activated_at",{ascending:false}).limit(500);
 if(accountsResult.error){if(["42P01","42703"].includes(accountsResult.error.code||""))return{available:false,accounts:[],events:{},surveys:{},growth:{}};throw new Error(accountsResult.error.message)}
 const [surveyResult,eventResult,growthResult,supportResult]=await Promise.all([
  supabase.from("website_crm_client_surveys").select("*").order("sent_at",{ascending:false}).limit(2000),
  supabase.from("website_crm_client_success_events").select("*").order("occurred_at",{ascending:false}).limit(2500),
  supabase.from("website_crm_client_growth_opportunities").select("*").order("created_at",{ascending:false}).limit(1500),
  supabase.from("support_tickets").select("id,requester_email,priority,status").in("status",["open","in_progress"]).in("priority",["high","urgent"]).limit(2000),
 ]);
 if(surveyResult.error&&["42P01","42703"].includes(surveyResult.error.code||""))return{available:false,accounts:[],events:{},surveys:{},growth:{}};
 const surveys:Record<string,any[]>={},events:Record<string,any[]>={},growth:Record<string,any[]>={};
 for(const row of surveyResult.data??[])(surveys[String(row.client_id)]??=[]).push(row);
 for(const row of eventResult.data??[])(events[String(row.client_id)]??=[]).push(row);
 for(const row of growthResult.data??[])(growth[String(row.client_id)]??=[]).push(row);
 const highSupportByEmail=new Map<string,number>();
 if(!supportResult.error)for(const row of supportResult.data??[]){const email=String(row.requester_email||"").trim().toLowerCase();if(email)highSupportByEmail.set(email,(highSupportByEmail.get(email)||0)+1)}
 const now=Date.now();
 const accounts=(accountsResult.data??[]).map((raw:any)=>{
  const lead=relation<any>(raw.website_leads);const onboarding=relation<any>(raw.website_crm_onboarding_cases);const opportunity=relation<any>(raw.website_crm_opportunities);
  const clientSurveys=surveys[String(raw.id)]??[];const latestResponded=clientSurveys.find((row:any)=>row.status==="responded"&&row.score!=null)||null;
  const nps=latestResponded?Number(latestResponded.score):raw.last_nps_score==null?null:Number(raw.last_nps_score);
  const highPrioritySupportCount=lead?.email?highSupportByEmail.get(String(lead.email).toLowerCase())||0:0;
  const health=computeCustomerHealth({status:raw.status,adoptionScore:raw.adoption_score==null?null:Number(raw.adoption_score),npsScore:nps,lastSuccessContactAt:raw.last_success_contact_at,nextSuccessReviewAt:raw.next_success_review_at,renewalDate:raw.renewal_date,churnRiskNotes:raw.churn_risk_notes,highPrioritySupportCount},now);
  return{...raw,website_leads:lead,website_crm_onboarding_cases:onboarding,website_crm_opportunities:opportunity,latestSurvey:latestResponded,highPrioritySupportCount,health};
 });
 return{available:true,accounts,events,surveys,growth};
}

async function notifyOnce(supabase:any,input:{clientId:string;key:string;title:string;subtitle:string;severity:"info"|"warning"|"urgent";href?:string;dedupeDays?:number}){
 const sourceId=`${input.clientId}:${input.key}`;const since=new Date(Date.now()-(input.dedupeDays??7)*86400000).toISOString();
 const existing=await supabase.from("control_center_generated_notifications").select("id").eq("source_type","crm_customer_success").eq("source_id",sourceId).gte("created_at",since).limit(1);
 if(!existing.error&&existing.data?.length)return false;
 for(const role of ["founder","admin","sales"]){await supabase.from("control_center_generated_notifications").insert({target_role:role,title:input.title,subtitle:input.subtitle,href:input.href||`/admin/customer-success?client=${input.clientId}`,severity:input.severity,source_type:"crm_customer_success",source_id:sourceId})}
 return true;
}

export async function syncCustomerSuccessHealth(supabase:any,clientIds?:string[]){
 const now=new Date();const nowIso=now.toISOString();
 const expire=await supabase.from("website_crm_client_surveys").update({status:"expired",updated_at:nowIso}).in("status",["sent","opened"]).lt("expires_at",nowIso);
 if(expire.error&&!["42P01","42703"].includes(expire.error.code||""))throw new Error(expire.error.message);
 const data=await loadCustomerSuccessData(supabase);if(!data.available)return{available:false,updated:0,alerts:0,errors:[] as string[]};
 let updated=0,alerts=0;const errors:string[]=[];const wanted=clientIds?.length?new Set(clientIds):null;
 for(const account of data.accounts){
  if(wanted&&!wanted.has(String(account.id)))continue;
  try{
   const latest=account.latestSurvey;const health=account.health as CustomerHealth;const patch:any={health_score:health.score,health_status:health.status,health_updated_at:nowIso,health_summary:health.reasons.filter((item)=>item.delta<0).map((item)=>item.label).slice(0,5).join(" · ")||"Relation client saine."};
   if(latest?.score!=null){patch.last_nps_score=Number(latest.score);patch.last_nps_at=latest.responded_at||latest.updated_at||latest.sent_at}
   const result=await supabase.from("website_crm_client_accounts").update(patch).eq("id",account.id);if(result.error)throw new Error(result.error.message);updated+=1;
   if(account.status!=="active")continue;
   if(health.status==="critical"||health.status==="at_risk"){
    const created=await notifyOnce(supabase,{clientId:String(account.id),key:`health:${health.status}`,title:health.status==="critical"?"Client en risque critique":"Client à risque",subtitle:`${account.account_name} · santé ${health.score}/100 · ${patch.health_summary}`,severity:health.status==="critical"?"urgent":"warning",dedupeDays:7});if(created)alerts+=1;
   }
   const review=daysUntil(account.next_success_review_at,now.getTime());
   if(review!=null&&review<=0){const created=await notifyOnce(supabase,{clientId:String(account.id),key:`review:${String(account.next_success_review_at).slice(0,10)}`,title:"Revue client à effectuer",subtitle:`${account.account_name} · revue Customer Success arrivée à échéance.`,severity:"warning",dedupeDays:30});if(created)alerts+=1}
   const renewal=daysUntil(account.renewal_date,now.getTime());
   if(renewal!=null&&renewal>=0&&renewal<=45){const created=await notifyOnce(supabase,{clientId:String(account.id),key:`renewal:${account.renewal_date}`,title:"Renouvellement à préparer",subtitle:`${account.account_name} · renouvellement dans ${renewal} jour${renewal>1?"s":""}.`,severity:renewal<=15?"warning":"info",dedupeDays:120});if(created)alerts+=1}
  }catch(error){errors.push(`${account.account_name}: ${error instanceof Error?error.message:"Erreur Customer Success"}`)}
 }
 return{available:true,updated,alerts,errors};
}
