type BillingModel = "monthly" | "quarterly" | "semiannual" | "annual" | "custom";
type BillingResult = { available:boolean; enabled:boolean; processed:number; markedOverdue:number; alerts:number; runs:number; errors:string[] };

function missing(error:any){return ["42P01","42703"].includes(String(error?.code||""))}
function today(){return new Date().toISOString().slice(0,10)}
function plusDays(days:number){const date=new Date();date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10)}
function dueWithGrace(value:string|null|undefined,grace:number){if(!value)return null;const date=new Date(`${value}T00:00:00Z`);if(Number.isNaN(date.getTime()))return null;date.setUTCDate(date.getUTCDate()+grace);return date.toISOString().slice(0,10)}

export function monthlyEquivalent(amount:number,billingModel:BillingModel){
 const value=Math.max(0,Number(amount||0));
 if(billingModel==="monthly")return value;
 if(billingModel==="quarterly")return value/3;
 if(billingModel==="semiannual")return value/6;
 if(billingModel==="annual")return value/12;
 return 0;
}

async function notify(supabase:any,sourceId:string,key:string,title:string,subtitle:string,severity:"info"|"warning"|"urgent"){
 let count=0;
 for(const role of ["founder","admin","sales"]){
  const result=await supabase.from("control_center_generated_notifications").insert({target_role:role,title,subtitle,href:`/admin/customer-success/billing?item=${sourceId}`,severity,source_type:"crm_billing",source_id:key});
  if(!result.error)count+=1;
 }
 return count;
}

async function beginRun(supabase:any,triggerType:"invoice_overdue"|"invoice_due"|"subscription_due",sourceId:string,triggerKey:string,summary:string){
 const result=await supabase.from("website_crm_billing_runs").insert({trigger_type:triggerType,source_id:sourceId,trigger_key:triggerKey,status:"success",summary}).select("id").single();
 if(result.error){if(result.error.code==="23505")return null;throw new Error(result.error.message)}
 return String(result.data.id);
}

export async function syncBillingOperations(supabase:any):Promise<BillingResult>{
 const output:BillingResult={available:true,enabled:false,processed:0,markedOverdue:0,alerts:0,runs:0,errors:[]};
 const settingsResult=await supabase.from("website_crm_billing_settings").select("*").eq("id","default").maybeSingle();
 if(settingsResult.error){if(missing(settingsResult.error))return {...output,available:false};throw new Error(settingsResult.error.message)}
 const settings=settingsResult.data??{enabled:false,upcoming_days:7,overdue_grace_days:0};output.enabled=Boolean(settings.enabled);if(!output.enabled)return output;
 const [invoiceResult,subscriptionResult]=await Promise.all([
  supabase.from("website_crm_billing_invoices").select("id,client_id,reference,title,status,due_date,total_amount,amount_paid,currency,website_crm_client_accounts(account_name)").in("status",["issued","overdue"]).order("due_date",{ascending:true}),
  supabase.from("website_crm_account_subscriptions").select("id,client_id,name,status,next_invoice_date,recurring_amount,currency,website_crm_client_accounts(account_name)").eq("status","active").order("next_invoice_date",{ascending:true}),
 ]);
 if(invoiceResult.error){if(missing(invoiceResult.error))return {...output,available:false};output.errors.push(invoiceResult.error.message)}
 if(subscriptionResult.error){if(!missing(subscriptionResult.error))output.errors.push(subscriptionResult.error.message)}
 const now=today(),upcoming=plusDays(Number(settings.upcoming_days||7)),grace=Math.max(0,Number(settings.overdue_grace_days||0));
 for(const invoice of invoiceResult.data??[]){
  output.processed+=1;const account=Array.isArray(invoice.website_crm_client_accounts)?invoice.website_crm_client_accounts[0]:invoice.website_crm_client_accounts;const label=account?.account_name||"Compte client";const graceDate=dueWithGrace(invoice.due_date,grace);const balance=Math.max(0,Number(invoice.total_amount||0)-Number(invoice.amount_paid||0));if(balance<=0)continue;
  if(invoice.status==="issued"&&graceDate&&graceDate<now){
   const updated=await supabase.from("website_crm_billing_invoices").update({status:"overdue",updated_by:"MOONY Billing",updated_at:new Date().toISOString()}).eq("id",invoice.id).eq("status","issued");
   if(updated.error){output.errors.push(updated.error.message);continue}output.markedOverdue+=1;
  }
  if(graceDate&&graceDate<now){
   const key=`invoice-overdue:${invoice.id}:${invoice.due_date}`;const run=await beginRun(supabase,"invoice_overdue",invoice.id,key,`Facture ${invoice.reference} arrivée à échéance.`);
   if(run){output.runs+=1;output.alerts+=await notify(supabase,invoice.id,key,"Facture en retard",`${label} · ${invoice.reference} · reste dû ${balance.toLocaleString("fr-FR")} ${invoice.currency}. Aucune relance client n’a été envoyée automatiquement.`,"urgent")}
  }else if(invoice.status==="issued"&&invoice.due_date&&invoice.due_date>=now&&invoice.due_date<=upcoming){
   const key=`invoice-due:${invoice.id}:${invoice.due_date}`;const run=await beginRun(supabase,"invoice_due",invoice.id,key,`Facture ${invoice.reference} bientôt à échéance.`);
   if(run){output.runs+=1;output.alerts+=await notify(supabase,invoice.id,key,"Échéance de facture à surveiller",`${label} · ${invoice.reference} · reste dû ${balance.toLocaleString("fr-FR")} ${invoice.currency} · échéance ${invoice.due_date}.`,`warning`)}
  }
 }
 for(const subscription of subscriptionResult.data??[]){
  if(!subscription.next_invoice_date||subscription.next_invoice_date<now||subscription.next_invoice_date>upcoming)continue;
  output.processed+=1;const account=Array.isArray(subscription.website_crm_client_accounts)?subscription.website_crm_client_accounts[0]:subscription.website_crm_client_accounts;const label=account?.account_name||"Compte client";const key=`subscription-due:${subscription.id}:${subscription.next_invoice_date}`;const run=await beginRun(supabase,"subscription_due",subscription.id,key,`Échéance de facturation ${subscription.name}.`);
  if(run){output.runs+=1;output.alerts+=await notify(supabase,subscription.id,key,"Facture à préparer",`${label} · ${subscription.name} · prochaine échéance ${subscription.next_invoice_date}. La facture doit être créée et validée humainement.`,`info`)}
 }
 return output;
}
