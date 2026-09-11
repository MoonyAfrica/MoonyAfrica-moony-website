type SyncResult={available:boolean;prepared:number;tasks:number;alerts:number;errors:string[]};

function missing(error:any){return ["42P01","42703"].includes(String(error?.code||""))}
function relation<T>(value:T|T[]|null|undefined):T|null{return Array.isArray(value)?value[0]??null:value??null}
function dateOnly(value:string|null|undefined){if(!value)return null;const date=new Date(value);return Number.isNaN(date.getTime())?null:date.toISOString().slice(0,10)}
function accountName(account:any){return String(account?.account_name||"Client MOONY")}
function ownerOf(account:any,plan:any){return plan?.owner||account?.owner||account?.commercial_owner||"Customer Success"}

async function notifyOnce(supabase:any,planId:string,clientId:string,reviewKey:string,title:string,subtitle:string){
 const sourceId=`${planId}:${reviewKey}`;
 const existing=await supabase.from("control_center_generated_notifications").select("id").eq("source_type","crm_success_plan").eq("source_id",sourceId).limit(1);
 if(!existing.error&&existing.data?.length)return 0;
 let count=0;
 for(const role of ["founder","admin","sales"]){
  const inserted=await supabase.from("control_center_generated_notifications").insert({target_role:role,title,subtitle,href:`/admin/customer-success/plans?client=${clientId}`,severity:"info",source_type:"crm_success_plan",source_id:sourceId});
  if(!inserted.error)count+=1;
 }
 return count;
}

export async function syncSuccessPlanReviews(supabase:any):Promise<SyncResult>{
 const result:SyncResult={available:true,prepared:0,tasks:0,alerts:0,errors:[]};
 const horizon=new Date(Date.now()+14*86400000).toISOString();
 const plansResult=await supabase.from("website_crm_success_plans").select("*,website_crm_client_accounts(id,lead_id,account_name,status,owner,commercial_owner,health_score,health_status,health_summary,adoption_score,last_nps_score,last_success_contact_at,next_success_review_at,renewal_date)").eq("status","active").not("next_review_at","is",null).lte("next_review_at",horizon).order("next_review_at",{ascending:true}).limit(250);
 if(plansResult.error){if(missing(plansResult.error))return{...result,available:false};throw new Error(plansResult.error.message)}
 for(const plan of plansResult.data??[]){
  const account=relation<any>(plan.website_crm_client_accounts);if(!account||account.status!=="active")continue;
  try{
   const scheduledAt=String(plan.next_review_at);const scheduledDate=dateOnly(scheduledAt);if(!scheduledDate)continue;
   const reviewKey=`review:${scheduledDate}`;
   const existing=await supabase.from("website_crm_qbrs").select("id,status").eq("plan_id",plan.id).eq("review_key",reviewKey).maybeSingle();
   if(existing.error&&!missing(existing.error))throw new Error(existing.error.message);
   if(existing.data)continue;
   const periodStart=dateOnly(plan.last_review_at)||String(plan.start_date||scheduledDate);
   const inserted=await supabase.from("website_crm_qbrs").insert({
    client_id:account.id,plan_id:plan.id,review_key:reviewKey,status:"preparing",scheduled_at:scheduledAt,period_start:periodStart,period_end:scheduledDate,
    executive_summary:`Revue préparée automatiquement pour ${accountName(account)}. Complétez les résultats, décisions et prochaines étapes avant le rendez-vous.`,
    risks:account.health_summary||null,adoption_snapshot:account.adoption_score??null,nps_snapshot:account.last_nps_score??null,health_snapshot:account.health_score??null,
    prepared_at:new Date().toISOString(),created_by:"MOONY Success Plans",updated_by:"MOONY Success Plans",
   }).select("id").single();
   if(inserted.error){if(inserted.error.code==="23505")continue;throw new Error(inserted.error.message)}
   result.prepared+=1;
   const reviewTime=new Date(scheduledAt).getTime();const dueTime=Math.max(Date.now()+3600000,reviewTime-48*3600000);
   const task=await supabase.from("website_crm_tasks").insert({lead_id:account.lead_id,title:`Préparer la revue client — ${accountName(account)}`,due_at:new Date(dueTime).toISOString(),status:"todo",priority:reviewTime-Date.now()<=3*86400000?"high":"normal",assigned_to:ownerOf(account,plan),notes:"Revue Customer Success pré-créée automatiquement. Vérifier les objectifs, l’adoption, le NPS, les risques, les décisions attendues et les prochaines étapes.",metadata:{source:"crm-success-plan",client_id:account.id,plan_id:plan.id,qbr_id:inserted.data.id,review_key:reviewKey}}).select("id").single();
   if(!task.error)result.tasks+=1;
   result.alerts+=await notifyOnce(supabase,String(plan.id),String(account.id),reviewKey,"Revue client à préparer",`${accountName(account)} · revue prévue le ${new Intl.DateTimeFormat("fr-FR").format(new Date(scheduledAt))}.`);
   await supabase.from("website_crm_client_success_events").insert({client_id:account.id,event_type:"review",title:"Revue client préparée",detail:`Une revue a été préparée automatiquement pour le ${scheduledDate}.`,actor:"MOONY Success Plans"});
  }catch(error){result.errors.push(`${accountName(account)}: ${error instanceof Error?error.message:"Erreur Success Plan"}`)}
 }
 return result;
}

export function computePlanProgress(objectives:Array<{progress?:number|null;weight?:number|null}>){
 if(!objectives.length)return 0;let weighted=0,total=0;for(const objective of objectives){const weight=Math.max(1,Number(objective.weight||1));weighted+=Math.max(0,Math.min(100,Number(objective.progress||0)))*weight;total+=weight}return total?Math.round(weighted/total):0;
}
