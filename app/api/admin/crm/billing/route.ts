import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { asText, requireAdmin, writeAuditLog } from "@/lib/admin-api";
import { monthlyEquivalent, syncBillingOperations } from "@/lib/crm-billing-ops";

function missing(error:any){return ["42P01","42703"].includes(String(error?.code||""))}
async function bodyOf(request:Request){try{return await request.json() as Record<string,unknown>}catch{return null}}
function dateOnly(value:unknown){const text=asText(value,20);return /^\d{4}-\d{2}-\d{2}$/.test(text)?text:null}
function nullable(value:unknown,max=4000){const text=asText(value,max);return text||null}
function money(value:unknown){const number=Number(value);return Number.isFinite(number)&&number>=0?number:null}
function percent(value:unknown){const number=Number(value);return Number.isFinite(number)&&number>=0&&number<=100?number:null}
function actor(session:any){return session.name||session.email||"MOONY Admin"}
function invoiceReference(){const date=new Date();return `INV-${date.getUTCFullYear()}${String(date.getUTCMonth()+1).padStart(2,"0")}-${randomUUID().slice(0,8).toUpperCase()}`}

export async function GET(request:Request){
 const {error,supabase}=requireAdmin(request,"crm.read");if(error||!supabase)return error;
 const [settings,clients,subscriptions,invoices,catalog]=await Promise.all([
  supabase.from("website_crm_billing_settings").select("*").eq("id","default").maybeSingle(),
  supabase.from("website_crm_client_accounts").select("id,lead_id,account_name,status,owner,commercial_owner,renewal_date").eq("status","active").order("account_name"),
  supabase.from("website_crm_account_subscriptions").select("*,website_crm_client_accounts(account_name,status,owner)").order("updated_at",{ascending:false}),
  supabase.from("website_crm_billing_invoices").select("*,website_crm_client_accounts(account_name,status,owner),website_crm_account_subscriptions(name)").order("created_at",{ascending:false}).limit(300),
  supabase.from("website_crm_catalog_items").select("id,sku,name,category,billing_model,currency,unit_price,active").eq("active",true).order("name"),
 ]);
 if(settings.error&&missing(settings.error))return NextResponse.json({available:false,settings:null,clients:[],subscriptions:[],invoices:[],catalog:[],metrics:{activeSubscriptions:0,overdueInvoices:0,draftInvoices:0,currencies:{}}});
 const fatal=[settings.error,clients.error,subscriptions.error,invoices.error].find((item)=>item&&!missing(item));if(fatal)return NextResponse.json({error:fatal.message},{status:500});
 const currencyMetrics:Record<string,{mrr:number;arr:number;outstanding:number;overdue:number;due30:number}>={};
 const bucket=(currency:string)=>currencyMetrics[currency]??(currencyMetrics[currency]={mrr:0,arr:0,outstanding:0,overdue:0,due30:0});
 const decorated=(subscriptions.data??[]).map((row:any)=>{const monthly=row.status==="active"?monthlyEquivalent(Number(row.recurring_amount||0),row.billing_model):0;const values=bucket(row.currency||"XOF");values.mrr+=monthly;values.arr+=monthly*12;return {...row,mrr:monthly,arr:monthly*12}});
 const now=new Date().toISOString().slice(0,10),in30=new Date(Date.now()+30*86400000).toISOString().slice(0,10);
 for(const row of invoices.data??[]){if(!["issued","overdue"].includes(row.status))continue;const values=bucket(row.currency||"XOF"),amount=Math.max(0,Number(row.total_amount||0)-Number(row.amount_paid||0));values.outstanding+=amount;if(row.status==="overdue")values.overdue+=amount;if(row.due_date&&row.due_date>=now&&row.due_date<=in30)values.due30+=amount}
 return NextResponse.json({available:true,settings:settings.data??{id:"default",enabled:false,upcoming_days:7,overdue_grace_days:0},clients:clients.data??[],subscriptions:decorated,invoices:invoices.data??[],catalog:catalog.error?[]:catalog.data??[],metrics:{activeSubscriptions:decorated.filter((row:any)=>row.status==="active").length,overdueInvoices:(invoices.data??[]).filter((row:any)=>row.status==="overdue").length,draftInvoices:(invoices.data??[]).filter((row:any)=>row.status==="draft").length,currencies:currencyMetrics}});
}

export async function POST(request:Request){
 const {error,supabase,session}=requireAdmin(request,"crm.write");if(error||!supabase||!session)return error;const body=await bodyOf(request);if(!body)return NextResponse.json({error:"Requête invalide."},{status:400});
 const action=asText(body.action,40),who=actor(session),now=new Date().toISOString();
 if(action==="sync"){
  try{const result=await syncBillingOperations(supabase);await writeAuditLog(supabase,session,"crm.billing_sync","crm_billing",null,"Synchronisation Billing & Revenue Operations",result);return NextResponse.json(result)}catch(err){return NextResponse.json({error:err instanceof Error?err.message:"Synchronisation impossible."},{status:500})}
 }
 if(action==="settings"){
  const upcoming=Math.round(Number(body.upcomingDays)),grace=Math.round(Number(body.overdueGraceDays));if(!Number.isFinite(upcoming)||upcoming<1||upcoming>90||!Number.isFinite(grace)||grace<0||grace>30)return NextResponse.json({error:"Paramètres d’alerte invalides."},{status:422});
  const saved=await supabase.from("website_crm_billing_settings").upsert({id:"default",enabled:Boolean(body.enabled),upcoming_days:upcoming,overdue_grace_days:grace,updated_by:who,updated_at:now},{onConflict:"id"}).select("*").single();if(saved.error)return NextResponse.json({error:saved.error.message},{status:500});await writeAuditLog(supabase,session,"crm.billing_settings_updated","crm_billing_settings","default","Paramètres Billing mis à jour",{enabled:Boolean(body.enabled),upcomingDays:upcoming,overdueGraceDays:grace});return NextResponse.json({ok:true,settings:saved.data});
 }
 if(action==="subscription_create"){
  const clientId=asText(body.clientId,80),name=asText(body.name,240),billingModel=asText(body.billingModel,30),pricingUnit=asText(body.pricingUnit,30)||"account",currency=(asText(body.currency,3)||"XOF").toUpperCase(),quantity=money(body.quantity),unitPrice=money(body.unitPrice),discount=percent(body.discountPercent),recurring=money(body.recurringAmount);
  if(!clientId||!name||!["monthly","quarterly","semiannual","annual","custom"].includes(billingModel)||!["account","professional","employee","seat","custom"].includes(pricingUnit)||currency.length!==3||quantity===null||quantity<=0||unitPrice===null||discount===null||recurring===null)return NextResponse.json({error:"Données d’abonnement invalides."},{status:422});
  const client=await supabase.from("website_crm_client_accounts").select("id,status,account_name").eq("id",clientId).maybeSingle();if(client.error||!client.data)return NextResponse.json({error:"Client introuvable."},{status:404});
  const created=await supabase.from("website_crm_account_subscriptions").insert({client_id:clientId,catalog_item_id:asText(body.catalogItemId,80)||null,name,status:"active",billing_model:billingModel,pricing_unit:pricingUnit,quantity,unit_price:unitPrice,discount_percent:discount,recurring_amount:recurring,currency,start_date:dateOnly(body.startDate)||new Date().toISOString().slice(0,10),next_invoice_date:dateOnly(body.nextInvoiceDate),billing_notes:nullable(body.notes),created_by:who,updated_by:who}).select("*").single();if(created.error)return NextResponse.json({error:created.error.message},{status:500});await writeAuditLog(supabase,session,"crm.billing_subscription_created","crm_subscription",created.data.id,`${name} · ${client.data.account_name}`,{clientId,billingModel,pricingUnit,recurringAmount:recurring,currency});return NextResponse.json({ok:true,subscription:created.data},{status:201});
 }
 if(action==="subscription_update"){
  const id=asText(body.subscriptionId,80);if(!id)return NextResponse.json({error:"Abonnement obligatoire."},{status:422});const patch:Record<string,unknown>={updated_by:who,updated_at:now};
  if("status" in body){const value=asText(body.status,20);if(!["active","paused","cancelled","ended"].includes(value))return NextResponse.json({error:"Statut invalide."},{status:422});patch.status=value}
  if("quantity" in body){const value=money(body.quantity);if(value===null||value<=0)return NextResponse.json({error:"Quantité invalide."},{status:422});patch.quantity=value}
  if("unitPrice" in body){const value=money(body.unitPrice);if(value===null)return NextResponse.json({error:"Prix unitaire invalide."},{status:422});patch.unit_price=value}
  if("discountPercent" in body){const value=percent(body.discountPercent);if(value===null)return NextResponse.json({error:"Remise invalide."},{status:422});patch.discount_percent=value}
  if("recurringAmount" in body){const value=money(body.recurringAmount);if(value===null)return NextResponse.json({error:"Montant récurrent invalide."},{status:422});patch.recurring_amount=value}
  if("nextInvoiceDate" in body)patch.next_invoice_date=dateOnly(body.nextInvoiceDate);if("endDate" in body)patch.end_date=dateOnly(body.endDate);if("notes" in body)patch.billing_notes=nullable(body.notes);
  const updated=await supabase.from("website_crm_account_subscriptions").update(patch).eq("id",id).select("*").single();if(updated.error)return NextResponse.json({error:updated.error.message},{status:500});await writeAuditLog(supabase,session,"crm.billing_subscription_updated","crm_subscription",id,`Abonnement mis à jour · ${updated.data.name}`,patch);return NextResponse.json({ok:true,subscription:updated.data});
 }
 if(action==="invoice_create"){
  const clientId=asText(body.clientId,80),title=asText(body.title,240),currency=(asText(body.currency,3)||"XOF").toUpperCase(),subtotal=money(body.subtotal),tax=money(body.taxAmount);if(!clientId||!title||currency.length!==3||subtotal===null||tax===null)return NextResponse.json({error:"Données de facture invalides."},{status:422});const total=body.totalAmount==null?subtotal+tax:money(body.totalAmount);if(total===null)return NextResponse.json({error:"Total de facture invalide."},{status:422});
  const created=await supabase.from("website_crm_billing_invoices").insert({client_id:clientId,subscription_id:asText(body.subscriptionId,80)||null,reference:asText(body.reference,80)||invoiceReference(),title,status:"draft",issue_date:dateOnly(body.issueDate),due_date:dateOnly(body.dueDate),subtotal,tax_amount:tax,total_amount:total,currency,external_reference:nullable(body.externalReference,240),notes:nullable(body.notes),created_by:who,updated_by:who}).select("*").single();if(created.error)return NextResponse.json({error:created.error.message},{status:500});await writeAuditLog(supabase,session,"crm.billing_invoice_created","crm_invoice",created.data.id,`Facture ${created.data.reference} créée`,{clientId,totalAmount:total,currency});return NextResponse.json({ok:true,invoice:created.data},{status:201});
 }
 if(action==="invoice_status"){
  const id=asText(body.invoiceId,80),status=asText(body.status,20);if(!id||!["draft","issued","paid","cancelled"].includes(status))return NextResponse.json({error:"Facture ou statut invalide."},{status:422});const patch:Record<string,unknown>={status,updated_by:who,updated_at:now};if(status==="issued")patch.issue_date=dateOnly(body.issueDate)||new Date().toISOString().slice(0,10);if(status==="paid"){patch.paid_at=now;const current=await supabase.from("website_crm_billing_invoices").select("total_amount").eq("id",id).maybeSingle();if(current.error)return NextResponse.json({error:current.error.message},{status:500});if(!current.data)return NextResponse.json({error:"Facture introuvable."},{status:404});patch.amount_paid=Number(current.data.total_amount||0);patch.last_payment_at=now}else patch.paid_at=null;
  const updated=await supabase.from("website_crm_billing_invoices").update(patch).eq("id",id).select("*").single();if(updated.error)return NextResponse.json({error:updated.error.message},{status:500});await writeAuditLog(supabase,session,"crm.billing_invoice_status","crm_invoice",id,`${updated.data.reference} · ${status}`,{status,manualSettlement:status==="paid"});return NextResponse.json({ok:true,invoice:updated.data});
 }
 if(action==="create_task"){
  const clientId=asText(body.clientId,80),title=asText(body.title,240);if(!clientId||!title)return NextResponse.json({error:"Client et tâche obligatoires."},{status:422});const client=await supabase.from("website_crm_client_accounts").select("lead_id,owner,commercial_owner,account_name").eq("id",clientId).maybeSingle();if(client.error||!client.data)return NextResponse.json({error:"Client introuvable."},{status:404});const priority=asText(body.priority,20);const created=await supabase.from("website_crm_tasks").insert({lead_id:client.data.lead_id,title,due_at:body.dueAt?new Date(String(body.dueAt)).toISOString():new Date(Date.now()+24*3600000).toISOString(),status:"todo",priority:["normal","high","urgent"].includes(priority)?priority:"normal",assigned_to:client.data.owner||client.data.commercial_owner||who,notes:nullable(body.notes),metadata:{source:"crm-billing",client_id:clientId}}).select("id").single();if(created.error)return NextResponse.json({error:created.error.message},{status:500});await writeAuditLog(supabase,session,"crm.billing_task_created","crm_task",created.data.id,`Tâche Billing · ${client.data.account_name}`,{clientId});return NextResponse.json({ok:true,taskId:created.data.id},{status:201});
 }
 return NextResponse.json({error:"Action non prise en charge."},{status:422});
}
