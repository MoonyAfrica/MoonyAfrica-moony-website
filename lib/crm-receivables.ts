type CollectionResult={available:boolean;enabled:boolean;processed:number;missedPromises:number;unallocatedAlerts:number;agingAlerts:number;runs:number;errors:string[]};
function missing(error:any){return ["42P01","42703"].includes(String(error?.code||""))}
function day(value:string|null|undefined){if(!value)return null;const date=new Date(value.length===10?`${value}T00:00:00Z`:value);return Number.isNaN(date.getTime())?null:Math.floor(date.getTime()/86400000)}
function todayDay(){return Math.floor(Date.now()/86400000)}
function accountOf(value:any){return Array.isArray(value)?value[0]:value}

async function notify(supabase:any,sourceId:string,key:string,title:string,subtitle:string,severity:"info"|"warning"|"urgent"){
 let count=0;
 for(const role of ["founder","admin","sales"]){
  const result=await supabase.from("control_center_generated_notifications").insert({target_role:role,title,subtitle,href:`/admin/customer-success/collections?item=${sourceId}`,severity,source_type:"crm_collections",source_id:key});
  if(!result.error)count+=1;
 }
 return count;
}
async function beginRun(supabase:any,triggerType:"unallocated_payment"|"promise_missed"|"aging_balance",sourceId:string,triggerKey:string,summary:string){
 const result=await supabase.from("website_crm_collection_runs").insert({trigger_type:triggerType,source_id:sourceId,trigger_key:triggerKey,status:"success",summary}).select("id").single();
 if(result.error){if(result.error.code==="23505")return null;throw new Error(result.error.message)}
 return String(result.data.id);
}

export async function syncReceivablesCollections(supabase:any):Promise<CollectionResult>{
 const output:CollectionResult={available:true,enabled:false,processed:0,missedPromises:0,unallocatedAlerts:0,agingAlerts:0,runs:0,errors:[]};
 const settingsResult=await supabase.from("website_crm_collection_settings").select("*").eq("id","default").maybeSingle();
 if(settingsResult.error){if(missing(settingsResult.error))return {...output,available:false};throw new Error(settingsResult.error.message)}
 const settings=settingsResult.data??{enabled:false,unallocated_after_days:2,promise_grace_days:1,aging_alert_days:30};output.enabled=Boolean(settings.enabled);if(!output.enabled)return output;
 const [paymentsResult,allocationsResult,promisesResult,invoicesResult]=await Promise.all([
  supabase.from("website_crm_payments").select("id,client_id,reference,status,amount,currency,received_at,created_at,website_crm_client_accounts(account_name)").eq("status","received").order("received_at",{ascending:true}),
  supabase.from("website_crm_payment_allocations").select("payment_id,amount"),
  supabase.from("website_crm_collection_promises").select("id,client_id,invoice_id,status,promised_date,promised_amount,currency,website_crm_client_accounts(account_name)").eq("status","open").order("promised_date",{ascending:true}),
  supabase.from("website_crm_billing_invoices").select("id,client_id,reference,status,due_date,total_amount,amount_paid,currency,website_crm_client_accounts(account_name)").in("status",["issued","overdue"]).order("due_date",{ascending:true}),
 ]);
 for(const result of [paymentsResult,allocationsResult,promisesResult,invoicesResult])if(result.error&&!missing(result.error))output.errors.push(result.error.message);
 if([paymentsResult,allocationsResult,promisesResult,invoicesResult].some((result)=>result.error&&missing(result.error)))return {...output,available:false};
 const allocated=new Map<string,number>();for(const row of allocationsResult.data??[])allocated.set(row.payment_id,(allocated.get(row.payment_id)||0)+Number(row.amount||0));
 const today=todayDay(),unallocatedAfter=Math.max(0,Number(settings.unallocated_after_days||2)),promiseGrace=Math.max(0,Number(settings.promise_grace_days||1)),agingDays=Math.max(1,Number(settings.aging_alert_days||30));
 for(const payment of paymentsResult.data??[]){
  output.processed+=1;const received=day(payment.received_at||payment.created_at);const remainder=Math.max(0,Number(payment.amount||0)-(allocated.get(payment.id)||0));if(remainder<=0||received===null||today-received<unallocatedAfter)continue;
  const account=accountOf(payment.website_crm_client_accounts);const key=`unallocated:${payment.id}:${Number(payment.amount||0)}`;const run=await beginRun(supabase,"unallocated_payment",payment.id,key,`Paiement ${payment.reference} à rapprocher.`);
  if(run){output.runs+=1;output.unallocatedAlerts+=await notify(supabase,payment.id,key,"Encaissement à rapprocher",`${account?.account_name||"Compte client"} · ${payment.reference} · ${remainder.toLocaleString("fr-FR")} ${payment.currency} non alloués.`,"warning")}
 }
 for(const promise of promisesResult.data??[]){
  output.processed+=1;const promised=day(promise.promised_date);if(promised===null||today-promised<=promiseGrace)continue;
  const updated=await supabase.from("website_crm_collection_promises").update({status:"missed",updated_by:"MOONY Collections",updated_at:new Date().toISOString()}).eq("id",promise.id).eq("status","open");if(updated.error){output.errors.push(updated.error.message);continue}output.missedPromises+=1;
  const account=accountOf(promise.website_crm_client_accounts);const key=`promise-missed:${promise.id}:${promise.promised_date}`;const run=await beginRun(supabase,"promise_missed",promise.id,key,`Promesse de paiement non tenue au ${promise.promised_date}.`);
  if(run){output.runs+=1;await notify(supabase,promise.id,key,"Promesse de paiement à reprendre",`${account?.account_name||"Compte client"} · ${Number(promise.promised_amount||0).toLocaleString("fr-FR")} ${promise.currency} · date promise ${promise.promised_date}. Aucune relance n’a été envoyée automatiquement.`,"urgent")}
 }
 for(const invoice of invoicesResult.data??[]){
  output.processed+=1;const due=day(invoice.due_date),balance=Math.max(0,Number(invoice.total_amount||0)-Number(invoice.amount_paid||0));if(balance<=0||due===null||today-due<agingDays)continue;
  const account=accountOf(invoice.website_crm_client_accounts);const key=`aging:${invoice.id}:${invoice.due_date}:${agingDays}`;const run=await beginRun(supabase,"aging_balance",invoice.id,key,`Solde ${invoice.reference} dépasse ${agingDays} jours.`);
  if(run){output.runs+=1;output.agingAlerts+=await notify(supabase,invoice.id,key,"Créance vieillissante",`${account?.account_name||"Compte client"} · ${invoice.reference} · solde ${balance.toLocaleString("fr-FR")} ${invoice.currency} · plus de ${agingDays} jours.`,"urgent")}
 }
 return output;
}
