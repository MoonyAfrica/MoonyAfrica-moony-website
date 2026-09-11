export type GovernanceStatus="healthy"|"watch"|"at_risk"|"critical";
export type GovernanceReason={code:string;label:string;delta:number;severity:"info"|"warning"|"critical"};
export type GovernanceResult={score:number;status:GovernanceStatus;reasons:GovernanceReason[]};

type Stakeholder={
 id:string;stakeholder_role:string;influence:string;sentiment:string;relationship_strength:number|null;is_primary:boolean;is_active:boolean;contact_cadence_days:number;last_contact_at:string|null;next_contact_at:string|null;
};

function clamp(value:number,min:number,max:number){return Math.max(min,Math.min(max,value))}
function statusFor(score:number):GovernanceStatus{return score>=80?"healthy":score>=60?"watch":score>=40?"at_risk":"critical"}
function daysSince(value:string|null|undefined,now=Date.now()){if(!value)return null;const time=new Date(value).getTime();if(Number.isNaN(time))return null;return Math.floor((now-time)/86400000)}

export function computeAccountGovernance(stakeholders:Stakeholder[],now=Date.now()):GovernanceResult{
 const active=stakeholders.filter((row)=>row.is_active!==false);let score=100;const reasons:GovernanceReason[]=[];const add=(code:string,label:string,delta:number,severity:GovernanceReason["severity"]="warning")=>{score+=delta;reasons.push({code,label,delta,severity})};
 if(active.length===0)add("no_contacts","Aucun interlocuteur actif cartographié",-45,"critical");
 else if(active.length===1)add("single_contact","Relation dépendante d’un seul interlocuteur",-30,"critical");
 else if(active.length===2)add("thin_network","Réseau relationnel encore concentré",-12,"warning");
 const highInfluence=active.filter((row)=>row.influence==="high");if(active.length>0&&highInfluence.length===0)add("no_high_influence","Aucun interlocuteur à forte influence identifié",-15,"warning");
 const sponsor=active.some((row)=>row.stakeholder_role==="executive_sponsor");const champion=active.some((row)=>row.stakeholder_role==="champion");const buyer=active.some((row)=>row.stakeholder_role==="economic_buyer");
 if(active.length>0&&!sponsor)add("missing_sponsor","Sponsor exécutif non identifié",-12,"warning");
 if(active.length>0&&!champion)add("missing_champion","Champion interne non identifié",-10,"warning");
 if(active.length>0&&!buyer)add("missing_buyer","Décideur économique non identifié",-8,"info");
 const resistant=active.filter((row)=>row.sentiment==="resistant");if(resistant.length)add("resistant_contacts",`${resistant.length} interlocuteur${resistant.length>1?"s":""} explicitement signalé${resistant.length>1?"s":""} comme réticent${resistant.length>1?"s":""}`,-Math.min(20,resistant.length*10),"critical");
 const overdue=active.filter((row)=>row.next_contact_at&&new Date(row.next_contact_at).getTime()<now);if(overdue.length)add("contact_overdue",`${overdue.length} suivi${overdue.length>1?"s":""} relationnel${overdue.length>1?"s":""} en retard`,-Math.min(20,overdue.length*5),overdue.length>=2?"critical":"warning");
 const primary=active.find((row)=>row.is_primary)||active.find((row)=>row.influence==="high");if(primary){const age=daysSince(primary.last_contact_at,now);if(age==null)add("primary_never_contacted","Dernier contact du référent principal non renseigné",-8,"info");else if(age>Math.max(45,Number(primary.contact_cadence_days||30)*2))add("primary_stale",`Référent principal sans contact depuis ${age} jours`,-15,"warning");}
 const strong=active.filter((row)=>row.relationship_strength!=null&&Number(row.relationship_strength)>=80);if(active.length>=3&&strong.length>=2&&sponsor&&champion)add("multi_threaded","Relation multi-interlocuteurs bien structurée",5,"info");
 score=clamp(score,0,100);return{score,status:statusFor(score),reasons};
}

async function notifyOnce(supabase:any,input:{clientId:string;key:string;title:string;subtitle:string;severity:"info"|"warning"|"urgent"}){
 const sourceId=`${input.clientId}:${input.key}`;const existing=await supabase.from("control_center_generated_notifications").select("id").eq("source_type","crm_account_governance").eq("source_id",sourceId).limit(1);if(!existing.error&&existing.data?.length)return 0;let count=0;for(const role of ["founder","admin","sales"]){const inserted=await supabase.from("control_center_generated_notifications").insert({target_role:role,title:input.title,subtitle:input.subtitle,href:`/admin/customer-success/governance?client=${input.clientId}`,severity:input.severity,source_type:"crm_account_governance",source_id:sourceId});if(!inserted.error)count+=1}return count;
}

async function beginRun(supabase:any,clientId:string,key:string,type:string,summary:string){const result=await supabase.from("website_crm_governance_runs").insert({client_id:clientId,trigger_key:key,trigger_type:type,status:"success",summary}).select("id").single();if(result.error){if(result.error.code==="23505")return null;throw new Error(result.error.message)}return String(result.data.id)}

export async function syncAccountGovernance(supabase:any){
 const result={available:true,updated:0,tasks:0,alerts:0,errors:[] as string[]};
 const accountsResult=await supabase.from("website_crm_client_accounts").select("id,lead_id,account_name,status,owner,commercial_owner").eq("status","active").limit(500);if(accountsResult.error){if(["42P01","42703"].includes(String(accountsResult.error.code||"")))return{...result,available:false};throw new Error(accountsResult.error.message)}
 const stakeholdersResult=await supabase.from("website_crm_account_stakeholders").select("*").eq("is_active",true).limit(5000);if(stakeholdersResult.error){if(["42P01","42703"].includes(String(stakeholdersResult.error.code||"")))return{...result,available:false};throw new Error(stakeholdersResult.error.message)}
 const grouped:Record<string,Stakeholder[]>={};for(const row of stakeholdersResult.data??[])(grouped[String(row.client_id)]??=[]).push(row as Stakeholder);
 const now=new Date(),nowIso=now.toISOString();
 for(const account of accountsResult.data??[]){try{const stakeholders=grouped[String(account.id)]??[];const governance=computeAccountGovernance(stakeholders);const summary=governance.reasons.filter((row)=>row.delta<0).map((row)=>row.label).slice(0,5).join(" · ")||"Gouvernance relationnelle structurée.";const update=await supabase.from("website_crm_client_accounts").update({governance_score:governance.score,governance_status:governance.status,governance_summary:summary,governance_updated_at:nowIso}).eq("id",account.id);if(update.error)throw new Error(update.error.message);result.updated+=1;
   if(governance.reasons.some((row)=>row.code==="single_contact")){const key=`single-contact:${now.toISOString().slice(0,7)}`;const runId=await beginRun(supabase,String(account.id),key,"single_contact","Risque single point of contact");if(runId){const task=await supabase.from("website_crm_tasks").insert({lead_id:account.lead_id,title:`Diversifier les interlocuteurs — ${account.account_name}`,due_at:new Date(Date.now()+5*86400000).toISOString(),status:"todo",priority:"high",assigned_to:account.owner||account.commercial_owner||"Customer Success",notes:"Le compte dépend actuellement d’un seul interlocuteur actif. Identifier au moins un sponsor, un champion ou un décideur supplémentaire. Aucun contact client n’est envoyé automatiquement.",metadata:{source:"crm-account-governance",client_id:account.id,trigger_key:key}}).select("id").single();if(!task.error)result.tasks+=1;result.alerts+=await notifyOnce(supabase,{clientId:String(account.id),key,title:"Risque single point of contact",subtitle:`${account.account_name} · un seul interlocuteur actif cartographié.`,severity:"warning"})}}
   for(const stakeholder of stakeholders.filter((row)=>row.next_contact_at&&new Date(String(row.next_contact_at)).getTime()<=Date.now())){const dateKey=String(stakeholder.next_contact_at).slice(0,10);const key=`contact-due:${stakeholder.id}:${dateKey}`;const runId=await beginRun(supabase,String(account.id),key,"contact_due",`Suivi relationnel en retard · ${stakeholder.id}`);if(!runId)continue;const task=await supabase.from("website_crm_tasks").insert({lead_id:account.lead_id,title:`Suivi relationnel — ${account.account_name}`,due_at:new Date(Date.now()+24*3600000).toISOString(),status:"todo",priority:stakeholder.influence==="high"?"high":"normal",assigned_to:account.owner||account.commercial_owner||"Customer Success",notes:"Un suivi prévu avec un interlocuteur du compte est arrivé à échéance. Vérifier le contexte avant toute prise de contact.",metadata:{source:"crm-account-governance",client_id:account.id,stakeholder_id:stakeholder.id,trigger_key:key}}).select("id").single();if(!task.error)result.tasks+=1;result.alerts+=await notifyOnce(supabase,{clientId:String(account.id),key,title:"Suivi relationnel à effectuer",subtitle:`${account.account_name} · un contact planifié est arrivé à échéance.`,severity:stakeholder.influence==="high"?"warning":"info"})}
   if(["at_risk","critical"].includes(governance.status)){result.alerts+=await notifyOnce(supabase,{clientId:String(account.id),key:`governance:${governance.status}:${now.toISOString().slice(0,7)}`,title:governance.status==="critical"?"Gouvernance compte critique":"Gouvernance compte à renforcer",subtitle:`${account.account_name} · score ${governance.score}/100 · ${summary}`,severity:governance.status==="critical"?"urgent":"warning"})}
  }catch(error){result.errors.push(`${account.account_name}: ${error instanceof Error?error.message:"Erreur gouvernance compte"}`)}}
 return result;
}
