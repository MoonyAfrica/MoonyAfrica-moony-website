const DAY=86400000;
function missing(error:any){return ["42P01","42703"].includes(String(error?.code||""))}
function dateKey(value:string|null|undefined){if(!value)return new Date().toISOString().slice(0,7);const date=new Date(value);return Number.isNaN(date.getTime())?String(value).slice(0,10):date.toISOString().slice(0,10)}
function dueIso(hours:number){return new Date(Date.now()+Math.max(1,hours)*3600000).toISOString()}
function daysUntil(value:string|null|undefined){if(!value)return null;const time=new Date(value).getTime();if(Number.isNaN(time))return null;return Math.ceil((time-Date.now())/DAY)}

async function notifyOnce(supabase:any,sourceId:string,title:string,subtitle:string,severity:"info"|"warning"|"urgent"){
 const existing=await supabase.from("control_center_generated_notifications").select("id").eq("source_type","crm_escalation").eq("source_id",sourceId).limit(1);
 if(!existing.error&&existing.data?.length)return 0;
 let count=0;
 for(const role of ["founder","admin"]){const inserted=await supabase.from("control_center_generated_notifications").insert({target_role:role,title,subtitle,href:`/admin/customer-success/escalations?case=${sourceId}`,severity,source_type:"crm_escalation",source_id:sourceId});if(!inserted.error)count+=1}
 return count;
}

async function openCase(supabase:any,input:{clientId:string;sourceType:string;sourceKey:string;title:string;summary:string;severity:"high"|"critical";owner:string|null;snapshot:Record<string,unknown>;slaHours:number}){
 const existing=await supabase.from("website_crm_escalation_cases").select("id,status").eq("client_id",input.clientId).eq("source_key",input.sourceKey).limit(1);
 if(existing.error){if(missing(existing.error))return{created:false,id:null};throw new Error(existing.error.message)}
 if(existing.data?.length)return{created:false,id:String(existing.data[0].id)};
 const now=new Date().toISOString();
 const inserted=await supabase.from("website_crm_escalation_cases").insert({client_id:input.clientId,source_type:input.sourceType,source_key:input.sourceKey,title:input.title,summary:input.summary,severity:input.severity,status:"open",owner:input.owner,due_at:dueIso(input.slaHours),next_review_at:dueIso(Math.min(input.slaHours,24)),source_snapshot:input.snapshot,created_by:"MOONY Automation",updated_by:"MOONY Automation",created_at:now,updated_at:now}).select("id").single();
 if(inserted.error){if(String(inserted.error.code||"")==="23505")return{created:false,id:null};throw new Error(inserted.error.message)}
 const id=String(inserted.data.id);
 await supabase.from("website_crm_escalation_actions").insert({escalation_id:id,title:"Qualifier la situation et confirmer le plan d’intervention",detail:"Vérifier les signaux opérationnels, confirmer le responsable, puis définir les prochaines actions avec validation humaine.",owner:input.owner,priority:input.severity==="critical"?"urgent":"high",status:"todo",due_at:dueIso(input.severity==="critical"?4:24),created_by:"MOONY Automation",updated_by:"MOONY Automation"});
 await supabase.from("website_crm_escalation_updates").insert({escalation_id:id,update_type:"risk",body:`Escalade ouverte automatiquement depuis le signal ${input.sourceType}. Aucune communication client n’a été envoyée.`,actor:"MOONY Automation"});
 return{created:true,id};
}

export async function syncCustomerSuccessEscalations(supabase:any){
 const result={available:true,enabled:false,accountsChecked:0,created:0,notifications:0,errors:[] as string[]};
 const settingsResult=await supabase.from("website_crm_escalation_settings").select("*").eq("id","default").maybeSingle();
 if(settingsResult.error){if(missing(settingsResult.error))return{...result,available:false};throw new Error(settingsResult.error.message)}
 const settings=settingsResult.data;
 if(!settings?.enabled)return result;
 result.enabled=true;
 const accountsResult=await supabase.from("website_crm_client_accounts").select("id,account_name,status,owner,commercial_owner,portfolio_tier,health_score,health_status,health_summary,health_updated_at,governance_score,governance_status,governance_summary,governance_updated_at,renewal_date").eq("status","active").limit(1000);
 if(accountsResult.error){if(missing(accountsResult.error))return{...result,available:false};throw new Error(accountsResult.error.message)}
 const retentionResult=settings.retention_urgent_enabled?await supabase.from("website_crm_retention_cases").select("id,client_id,title,status,priority,due_at,trigger_type").in("status",["open","in_progress"]).eq("priority","urgent").limit(2000):{data:[],error:null};
 if((retentionResult as any).error&&!missing((retentionResult as any).error))result.errors.push((retentionResult as any).error.message);
 const urgentByClient:Record<string,any[]>={};for(const row of (retentionResult as any).data??[])(urgentByClient[String(row.client_id)]??=[]).push(row);
 const accounts:any[]=accountsResult.data??[];result.accountsChecked=accounts.length;
 const criticalSla=Number(settings.critical_sla_hours||24),highSla=Number(settings.high_sla_hours||72);
 for(const account of accounts){
  const owner=account.owner||account.commercial_owner||null;
  const signals:{sourceType:string;sourceKey:string;title:string;summary:string;severity:"high"|"critical";snapshot:Record<string,unknown>;slaHours:number}[]=[];
  if(settings.health_critical_enabled&&account.health_status==="critical")signals.push({sourceType:"health",sourceKey:`health:critical:${dateKey(account.health_updated_at)}`,title:"Health Score critique",summary:account.health_summary||`${account.account_name} est en statut Customer Success critique (${account.health_score}/100).`,severity:"critical",snapshot:{healthScore:account.health_score,healthStatus:account.health_status},slaHours:criticalSla});
  if(settings.governance_critical_enabled&&account.governance_status==="critical")signals.push({sourceType:"governance",sourceKey:`governance:critical:${dateKey(account.governance_updated_at)}`,title:"Gouvernance de compte critique",summary:account.governance_summary||`${account.account_name} présente un risque critique de gouvernance (${account.governance_score}/100).`,severity:"critical",snapshot:{governanceScore:account.governance_score,governanceStatus:account.governance_status},slaHours:criticalSla});
  const strategicRisk=account.portfolio_tier==="strategic"&&(["at_risk","critical"].includes(account.health_status)||["at_risk","critical"].includes(account.governance_status));
  if(settings.strategic_risk_enabled&&strategicRisk&&account.health_status!=="critical"&&account.governance_status!=="critical")signals.push({sourceType:"strategic",sourceKey:`strategic:risk:${new Date().toISOString().slice(0,7)}`,title:"Compte stratégique à sécuriser",summary:`${account.account_name} est stratégique et présente un signal opérationnel à risque.`,severity:"high",snapshot:{portfolioTier:account.portfolio_tier,healthScore:account.health_score,healthStatus:account.health_status,governanceScore:account.governance_score,governanceStatus:account.governance_status},slaHours:highSla});
  const renewalDays=daysUntil(account.renewal_date);
  if(settings.renewal_overdue_enabled&&renewalDays!=null&&renewalDays<0)signals.push({sourceType:"renewal",sourceKey:`renewal:overdue:${dateKey(account.renewal_date)}`,title:"Renouvellement dépassé",summary:`L’échéance de renouvellement de ${account.account_name} est dépassée de ${Math.abs(renewalDays)} jour${Math.abs(renewalDays)>1?"s":""}.`,severity:account.portfolio_tier==="strategic"?"critical":"high",snapshot:{renewalDate:account.renewal_date,daysOverdue:Math.abs(renewalDays),portfolioTier:account.portfolio_tier},slaHours:account.portfolio_tier==="strategic"?criticalSla:highSla});
  for(const retention of urgentByClient[String(account.id)]??[])signals.push({sourceType:"retention",sourceKey:`retention:${retention.id}`,title:retention.title||"Dossier de rétention urgent",summary:`Un dossier anti-churn urgent est ouvert pour ${account.account_name}.`,severity:"critical",snapshot:{retentionCaseId:retention.id,triggerType:retention.trigger_type,dueAt:retention.due_at},slaHours:criticalSla});
  for(const signal of signals){try{const opened=await openCase(supabase,{clientId:String(account.id),owner,sourceType:signal.sourceType,sourceKey:signal.sourceKey,title:signal.title,summary:signal.summary,severity:signal.severity,snapshot:signal.snapshot,slaHours:signal.slaHours});if(opened.created&&opened.id){result.created+=1;result.notifications+=await notifyOnce(supabase,opened.id,signal.severity==="critical"?"Escalade Customer Success critique":"Escalade Customer Success",`${account.account_name} · ${signal.title}`,signal.severity==="critical"?"urgent":"warning")}}catch(error){result.errors.push(`${account.account_name}: ${error instanceof Error?error.message:"Erreur escalade"}`)}}
 }
 return result;
}
