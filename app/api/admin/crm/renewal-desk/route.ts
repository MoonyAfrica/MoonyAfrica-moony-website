import { NextResponse } from "next/server";
import { asText, requireAdmin, writeAuditLog } from "@/lib/admin-api";
import { revenueForecastSignals, syncRevenueForecastAlerts, type RevenueForecastSettings } from "@/lib/crm-revenue-forecast";

function missing(error:any){return ["42P01","42703"].includes(String(error?.code||""))}
function relation(value:any){return Array.isArray(value)?value[0]??null:value??null}
async function bodyOf(request:Request){try{return await request.json() as Record<string,unknown>}catch{return null}}
function actor(session:any){return session.name||session.email||"MOONY Admin"}
function nullable(value:unknown,max=5000){const text=asText(value,max);return text||null}
function dateOnly(value:unknown){const text=asText(value,20);return /^\d{4}-\d{2}-\d{2}$/.test(text)?text:null}
function probability(value:unknown){if(value==null||value==="")return null;const number=Number(value);return Number.isFinite(number)&&number>=0&&number<=100?Math.round(number):Number.NaN}

async function loadDesk(supabase:any){
  const settingsResult=await supabase.from("website_crm_revenue_forecast_settings").select("*").eq("id","default").maybeSingle();
  if(settingsResult.error&&missing(settingsResult.error))return{available:false,items:[],accounts:[],currencySummary:[],metrics:{open:0,renewals:0,expansion:0,due30:0,commit:0,attention:0,unconfigured:0},settings:{enabled:false,attention_days:45,stale_after_days:14}};
  if(settingsResult.error)throw new Error(settingsResult.error.message);
  const settings:RevenueForecastSettings={enabled:Boolean(settingsResult.data?.enabled),attention_days:Number(settingsResult.data?.attention_days||45),stale_after_days:Number(settingsResult.data?.stale_after_days||14)};

  const [growthResult,accountsResult]=await Promise.all([
    supabase.from("website_crm_client_growth_opportunities").select("id,client_id,kind,status,title,estimated_value,currency,due_date,notes,created_at,updated_at,owner,forecast_category,forecast_probability,next_step,expected_close_date,forecast_notes,source,last_forecast_at,last_forecast_by,website_crm_client_accounts(id,lead_id,account_name,status,owner,commercial_owner,renewal_date,health_score,health_status,governance_score,governance_status,portfolio_tier)").order("updated_at",{ascending:false}).limit(2000),
    supabase.from("website_crm_client_accounts").select("id,lead_id,account_name,status,owner,commercial_owner,renewal_date,health_score,health_status,governance_score,governance_status,portfolio_tier").eq("status","active").order("account_name",{ascending:true}).limit(1000),
  ]);
  if(growthResult.error){if(missing(growthResult.error))return{available:false,items:[],accounts:[],currencySummary:[],metrics:{open:0,renewals:0,expansion:0,due30:0,commit:0,attention:0,unconfigured:0},settings};throw new Error(growthResult.error.message)}
  if(accountsResult.error)throw new Error(accountsResult.error.message);

  const items=(growthResult.data??[]).map((raw:any)=>{const account=relation(raw.website_crm_client_accounts);const row={...raw,website_crm_client_accounts:account};const signal=revenueForecastSignals(row,settings);return{...row,account,effectiveOwner:row.owner||account?.owner||account?.commercial_owner||null,signals:signal.reasons,attention:signal.attention,urgent:signal.urgent,daysToClose:signal.remaining,closeDate:signal.closeDate,weightedValue:row.forecast_probability==null?null:Math.round(Number(row.estimated_value||0)*Number(row.forecast_probability)/100*100)/100}});
  const open=items.filter((row:any)=>["open","planned"].includes(row.status));
  const currencyMap=new Map<string,any>();
  for(const row of open){const currency=String(row.currency||"XOF").toUpperCase();const current=currencyMap.get(currency)||{currency,pipeline:0,weighted:0,commit:0,bestCase:0,renewal:0,expansion:0,configured:0};const value=Number(row.estimated_value||0);current.pipeline+=value;if(row.forecast_probability!=null){current.weighted+=value*Number(row.forecast_probability)/100;current.configured+=1}if(row.forecast_category==="commit")current.commit+=value;if(row.forecast_category==="best_case")current.bestCase+=value;if(row.kind==="renewal")current.renewal+=value;else current.expansion+=value;currencyMap.set(currency,current)}
  const currencySummary=[...currencyMap.values()].map((row:any)=>({...row,pipeline:Math.round(row.pipeline*100)/100,weighted:Math.round(row.weighted*100)/100,commit:Math.round(row.commit*100)/100,bestCase:Math.round(row.bestCase*100)/100,renewal:Math.round(row.renewal*100)/100,expansion:Math.round(row.expansion*100)/100})).sort((a:any,b:any)=>b.pipeline-a.pipeline);
  const metrics={open:open.length,renewals:open.filter((row:any)=>row.kind==="renewal").length,expansion:open.filter((row:any)=>row.kind!=="renewal").length,due30:open.filter((row:any)=>row.kind==="renewal"&&row.daysToClose!=null&&row.daysToClose>=0&&row.daysToClose<=30).length,commit:open.filter((row:any)=>row.forecast_category==="commit").length,attention:open.filter((row:any)=>row.attention).length,unconfigured:open.filter((row:any)=>!row.owner||row.forecast_probability==null||!String(row.next_step||"").trim()).length};
  return{available:true,items,accounts:accountsResult.data??[],currencySummary,metrics,settings};
}

export async function GET(request:Request){const {error,supabase}=requireAdmin(request,"crm.read");if(error||!supabase)return error;try{return NextResponse.json(await loadDesk(supabase))}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Impossible de charger le Renewal Desk."},{status:500})}}

export async function POST(request:Request){
  const {error,supabase,session}=requireAdmin(request,"crm.write");if(error||!supabase||!session)return error;const body=await bodyOf(request);if(!body)return NextResponse.json({error:"Requête invalide."},{status:400});const action=asText(body.action,50),who=actor(session),now=new Date().toISOString();

  if(action==="sync"){
    try{const result=await syncRevenueForecastAlerts(supabase,{force:true});await writeAuditLog(supabase,session,"crm.revenue_forecast_sync","crm_revenue_forecast",null,"Renewal Desk analysé",result);return NextResponse.json(result)}catch(err){return NextResponse.json({error:err instanceof Error?err.message:"Analyse forecast impossible."},{status:500})}
  }

  if(action==="settings"){
    const attentionDays=Number(body.attentionDays),staleAfterDays=Number(body.staleAfterDays);if(!Number.isFinite(attentionDays)||attentionDays<1||attentionDays>365||!Number.isFinite(staleAfterDays)||staleAfterDays<1||staleAfterDays>90)return NextResponse.json({error:"Seuils de forecast invalides."},{status:422});
    const saved=await supabase.from("website_crm_revenue_forecast_settings").upsert({id:"default",enabled:Boolean(body.enabled),attention_days:Math.round(attentionDays),stale_after_days:Math.round(staleAfterDays),updated_by:who,updated_at:now},{onConflict:"id"}).select("*").single();if(saved.error)return NextResponse.json({error:saved.error.message},{status:500});await writeAuditLog(supabase,session,"crm.revenue_forecast_settings","crm_revenue_forecast_settings","default","Paramètres Renewal Desk mis à jour",{enabled:Boolean(body.enabled),attentionDays,staleAfterDays});return NextResponse.json({settings:saved.data});
  }

  if(action==="create"){
    const clientId=asText(body.clientId,80),kind=asText(body.kind,30),title=asText(body.title,260);if(!clientId||!["renewal","upsell","cross_sell"].includes(kind)||!title)return NextResponse.json({error:"Client, type et titre obligatoires."},{status:422});
    const account=await supabase.from("website_crm_client_accounts").select("id,lead_id,account_name,owner,commercial_owner,renewal_date").eq("id",clientId).maybeSingle();if(account.error||!account.data)return NextResponse.json({error:"Compte client introuvable."},{status:404});
    const value=Math.max(0,Number(body.estimatedValue||0)),prob=probability(body.forecastProbability);if(Number.isNaN(prob))return NextResponse.json({error:"Probabilité attendue entre 0 et 100."},{status:422});const category=asText(body.forecastCategory,30)||"pipeline";if(!["pipeline","best_case","commit"].includes(category))return NextResponse.json({error:"Catégorie forecast invalide."},{status:422});
    const expected=dateOnly(body.expectedCloseDate)||(kind==="renewal"?account.data.renewal_date:null);const created=await supabase.from("website_crm_client_growth_opportunities").insert({client_id:clientId,kind,status:"open",title,estimated_value:Number.isFinite(value)?value:0,currency:(asText(body.currency,10)||"XOF").toUpperCase(),due_date:expected,owner:nullable(body.owner,240)||account.data.owner||account.data.commercial_owner||null,forecast_category:category,forecast_probability:prob,next_step:nullable(body.nextStep,2000),expected_close_date:expected,forecast_notes:nullable(body.forecastNotes,5000),notes:nullable(body.notes,5000),source:"customer_success",last_forecast_at:now,last_forecast_by:who,created_by:who,updated_by:who}).select("*").single();if(created.error)return NextResponse.json({error:created.error.message},{status:500});await writeAuditLog(supabase,session,"crm.revenue_forecast_created","crm_client_growth",created.data.id,`${account.data.account_name} · ${title}`,{clientId,kind,category});return NextResponse.json({item:created.data},{status:201});
  }

  if(action==="update"){
    const growthId=asText(body.growthId,80);if(!growthId)return NextResponse.json({error:"Opportunité obligatoire."},{status:422});const existing=await supabase.from("website_crm_client_growth_opportunities").select("id,client_id,title,status,kind").eq("id",growthId).maybeSingle();if(existing.error||!existing.data)return NextResponse.json({error:"Opportunité Customer Success introuvable."},{status:404});
    const status=asText(body.status,30),kind=asText(body.kind,30),categoryInput=asText(body.forecastCategory,30);if(!["open","planned","won","lost","dismissed"].includes(status)||!["renewal","upsell","cross_sell"].includes(kind))return NextResponse.json({error:"Statut ou type invalide."},{status:422});let category=categoryInput;if(!["pipeline","best_case","commit","closed"].includes(category))return NextResponse.json({error:"Catégorie forecast invalide."},{status:422});let prob=probability(body.forecastProbability);if(Number.isNaN(prob))return NextResponse.json({error:"Probabilité attendue entre 0 et 100."},{status:422});if(["won","lost","dismissed"].includes(status)){category="closed";prob=status==="won"?100:0}else if(category==="closed")category="pipeline";
    const value=Math.max(0,Number(body.estimatedValue||0));const patch={kind,status,title:asText(body.title,260)||existing.data.title,estimated_value:Number.isFinite(value)?value:0,currency:(asText(body.currency,10)||"XOF").toUpperCase(),owner:nullable(body.owner,240),forecast_category:category,forecast_probability:prob,next_step:nullable(body.nextStep,2000),expected_close_date:dateOnly(body.expectedCloseDate),due_date:dateOnly(body.expectedCloseDate),forecast_notes:nullable(body.forecastNotes,5000),notes:nullable(body.notes,5000),last_forecast_at:now,last_forecast_by:who,updated_by:who,updated_at:now};
    const saved=await supabase.from("website_crm_client_growth_opportunities").update(patch).eq("id",growthId).select("*").single();if(saved.error)return NextResponse.json({error:saved.error.message},{status:500});await writeAuditLog(supabase,session,"crm.revenue_forecast_updated","crm_client_growth",growthId,patch.title,{clientId:existing.data.client_id,status,category,probability:prob});return NextResponse.json({item:saved.data});
  }

  if(action==="create_task"){
    const growthId=asText(body.growthId,80);if(!growthId)return NextResponse.json({error:"Opportunité obligatoire."},{status:422});const item=await supabase.from("website_crm_client_growth_opportunities").select("id,client_id,title,next_step,owner,expected_close_date,website_crm_client_accounts(lead_id,account_name,owner,commercial_owner)").eq("id",growthId).maybeSingle();if(item.error||!item.data)return NextResponse.json({error:"Opportunité introuvable."},{status:404});const account=relation(item.data.website_crm_client_accounts);if(!account?.lead_id)return NextResponse.json({error:"Compte client sans lead CRM associé."},{status:422});const title=asText(body.title,320)||item.data.next_step||`Suivre ${item.data.title}`;const priority=asText(body.priority,30);const task=await supabase.from("website_crm_tasks").insert({lead_id:account.lead_id,title,due_at:new Date(Date.now()+3*86400000).toISOString(),status:"todo",priority:["urgent","high","normal"].includes(priority)?priority:"normal",assigned_to:item.data.owner||account.owner||account.commercial_owner||"Customer Success",notes:`Créée depuis le Renewal Desk · ${item.data.title}`,metadata:{source:"crm-revenue-forecast",growth_id:growthId,client_id:item.data.client_id}}).select("id").single();if(task.error)return NextResponse.json({error:task.error.message},{status:500});await writeAuditLog(supabase,session,"crm.revenue_forecast_task","crm_task",task.data.id,`${account.account_name} · ${title}`,{growthId,clientId:item.data.client_id});return NextResponse.json({taskId:task.data.id});
  }

  return NextResponse.json({error:"Action non prise en charge."},{status:422});
}
