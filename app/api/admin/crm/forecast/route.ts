import { NextResponse } from "next/server";
import { asText, requireAdmin, writeAuditLog } from "@/lib/admin-api";

const stages = ["new","to_contact","contacted","appointment","proposal","negotiation","won","lost"] as const;
const defaultProbabilities: Record<string, number> = {new:0.05,to_contact:0.10,contacted:0.20,appointment:0.35,proposal:0.55,negotiation:0.75,won:1,lost:0};
const labels: Record<string,string> = {new:"Nouveau",to_contact:"À contacter",contacted:"Contacté",appointment:"RDV planifié",proposal:"Proposition envoyée",negotiation:"Négociation",won:"Signé",lost:"Perdu"};

async function bodyOf(request: Request) { try { return await request.json() as Record<string, unknown>; } catch { return null; } }
function probability(value: unknown, fallback: number) { const number=Number(value);return Number.isFinite(number)?Math.max(0,Math.min(1,number)):fallback; }
function cleanProbabilities(value: unknown) { const source=value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{};return Object.fromEntries(stages.map((stage)=>[stage,stage==="won"?1:stage==="lost"?0:probability(source[stage],defaultProbabilities[stage])])) }
function moneyValue(value: unknown) { const number=Number(value);return Number.isFinite(number)?Math.max(0,number):0; }
function daysSince(value: string | null | undefined) { if(!value)return Number.POSITIVE_INFINITY;return Math.max(0,Math.floor((Date.now()-new Date(value).getTime())/86400000)); }
function relation(value:unknown){if(Array.isArray(value))return value[0]??null;return value&&typeof value==="object"?value as Record<string,unknown>:null}

type Deal={id:string;leadId:string;name:string;contact:string;stage:string;value:number;probability:number;currency:string;assignedTo:string|null;country:string|null;createdAt:string|null;lastContactedAt:string|null};

export async function GET(request: Request) {
  const { error, supabase } = requireAdmin(request, "crm.read");
  if (error || !supabase) return error;

  const [leadsResult,tasksResult,settingsResult,opportunitiesResult]=await Promise.all([
    supabase.from("website_leads").select("id,first_name,last_name,company,status,deal_value,country,assigned_to,created_at,updated_at,last_contacted_at").order("updated_at",{ascending:false}).limit(1000),
    supabase.from("website_crm_tasks").select("id,lead_id,title,due_at,status,priority,assigned_to").in("status",["todo","in_progress"]).order("due_at",{ascending:true,nullsFirst:false}).limit(500),
    supabase.from("website_crm_forecast_settings").select("stage_probabilities,monthly_target,currency,stale_after_days,updated_at").eq("id","default").maybeSingle(),
    supabase.from("website_crm_opportunities").select("id,lead_id,name,stage,probability,amount,currency,owner,website_leads(first_name,last_name,company,country,created_at,last_contacted_at)").order("updated_at",{ascending:false}).limit(1000),
  ]);

  if(leadsResult.error)return NextResponse.json({error:leadsResult.error.message},{status:500});
  const settingsAvailable=!settingsResult.error;
  const probabilities=cleanProbabilities(settingsResult.data?.stage_probabilities??defaultProbabilities);
  const configuredTarget=settingsAvailable&&settingsResult.data?.monthly_target!=null?moneyValue(settingsResult.data.monthly_target):null;
  const configuredCurrency=settingsAvailable?String(settingsResult.data?.currency||"EUR").toUpperCase():"EUR";
  const staleAfterDays=settingsAvailable?Math.max(1,Math.min(90,Number(settingsResult.data?.stale_after_days||7))):7;
  const leads=leadsResult.data??[];const tasks=tasksResult.error?[]:(tasksResult.data??[]);
  const opportunitiesAvailable=!opportunitiesResult.error;

  let opportunityDeals:Deal[]=[];
  if(opportunitiesAvailable){
    opportunityDeals=(opportunitiesResult.data??[]).map((opportunity)=>{const lead=relation(opportunity.website_leads);const person=`${String(lead?.first_name??"")} ${String(lead?.last_name??"")}`.trim();return{id:String(opportunity.id),leadId:String(opportunity.lead_id),name:String(opportunity.name||lead?.company||person||"Opportunité"),contact:person,stage:String(opportunity.stage),value:moneyValue(opportunity.amount),probability:probability(opportunity.probability,probabilities[String(opportunity.stage)]??0),currency:String(opportunity.currency||configuredCurrency).toUpperCase(),assignedTo:opportunity.owner?String(opportunity.owner):null,country:lead?.country?String(lead.country):null,createdAt:lead?.created_at?String(lead.created_at):null,lastContactedAt:lead?.last_contacted_at?String(lead.last_contacted_at):null}});
  }

  let currency=configuredCurrency;
  if(opportunitiesAvailable&&configuredTarget===null&&opportunityDeals.length){
    const counts=new Map<string,number>();for(const deal of opportunityDeals.filter((item)=>!["won","lost"].includes(item.stage)))counts.set(deal.currency,(counts.get(deal.currency)??0)+1);
    const dominant=[...counts.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0];if(dominant)currency=dominant;
  }

  const deals:Deal[]=opportunitiesAvailable
    ? opportunityDeals.filter((deal)=>deal.currency===currency)
    : leads.map((lead)=>({id:String(lead.id),leadId:String(lead.id),name:lead.company||`${lead.first_name||""} ${lead.last_name||""}`.trim()||"Prospect",contact:`${lead.first_name||""} ${lead.last_name||""}`.trim(),stage:String(lead.status),value:moneyValue(lead.deal_value),probability:probabilities[String(lead.status)]??0,currency,assignedTo:lead.assigned_to,country:lead.country,createdAt:lead.created_at,lastContactedAt:lead.last_contacted_at}));
  const monthlyTarget=currency===configuredCurrency?configuredTarget:null;
  const openStatuses=new Set(["new","to_contact","contacted","appointment","proposal","negotiation"]);

  const stageRows=stages.map((stage)=>{const rows=deals.filter((deal)=>deal.stage===stage);const value=rows.reduce((sum,deal)=>sum+deal.value,0);const weighted=rows.reduce((sum,deal)=>sum+deal.value*deal.probability,0);return{stage,label:labels[stage],count:rows.length,value,probability:probabilities[stage],weighted}});
  const openDeals=deals.filter((deal)=>openStatuses.has(deal.stage));
  const pipelineValue=openDeals.reduce((sum,deal)=>sum+deal.value,0);
  const weightedForecast=openDeals.reduce((sum,deal)=>sum+deal.value*deal.probability,0);
  const wonValue=deals.filter((deal)=>deal.stage==="won").reduce((sum,deal)=>sum+deal.value,0);
  const closedCount=deals.filter((deal)=>deal.stage==="won"||deal.stage==="lost").length;
  const wonCount=deals.filter((deal)=>deal.stage==="won").length;
  const winRate=closedCount?Math.round((wonCount/closedCount)*1000)/10:0;

  const taskByLead=new Map<string,typeof tasks>();for(const task of tasks){const key=String(task.lead_id||"");if(key)taskByLead.set(key,[...(taskByLead.get(key)??[]),task])}
  const now=Date.now();
  const atRisk=openDeals.map((deal)=>{const leadTasks=taskByLead.get(deal.leadId)??[];const overdue=leadTasks.filter((task)=>task.due_at&&new Date(task.due_at).getTime()<now).length;const staleDays=daysSince(deal.lastContactedAt||deal.createdAt);const reasons:string[]=[];if(staleDays>=staleAfterDays)reasons.push(`${staleDays} j sans contact`);if(overdue)reasons.push(`${overdue} relance${overdue>1?"s":""} en retard`);return{id:deal.leadId,opportunityId:deal.id,name:deal.name,contact:deal.contact,status:deal.stage,stageLabel:labels[deal.stage]||deal.stage,dealValue:deal.value,weightedValue:deal.value*deal.probability,assignedTo:deal.assignedTo,country:deal.country,staleDays,overdueTasks:overdue,reasons}}).filter((deal)=>deal.reasons.length).sort((a,b)=>b.dealValue-a.dealValue).slice(0,30);
  const overdueTasks=tasks.filter((task)=>task.due_at&&new Date(task.due_at).getTime()<now).length;
  const topDeals=[...openDeals].sort((a,b)=>b.value-a.value).slice(0,10).map((deal)=>({id:deal.leadId,opportunityId:deal.id,name:deal.name,stage:deal.stage,stageLabel:labels[deal.stage]||deal.stage,dealValue:deal.value,weightedValue:deal.value*deal.probability,assignedTo:deal.assignedTo}));

  return NextResponse.json({
    settings:{probabilities,monthlyTarget,currency,staleAfterDays,settingsAvailable,opportunitiesAvailable,configuredCurrency},
    metrics:{leads:leads.length,openDeals:openDeals.length,pipelineValue,weightedForecast,wonValue,winRate,overdueTasks,atRiskDeals:atRisk.length,targetCoverage:monthlyTarget&&monthlyTarget>0?Math.round((weightedForecast/monthlyTarget)*1000)/10:null},
    stages:stageRows,atRisk,topDeals,
  });
}

export async function PATCH(request: Request) {
  const { error, supabase, session } = requireAdmin(request, "crm.write");
  if (error || !supabase) return error;
  const body = await bodyOf(request);
  if (!body) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });

  const probabilities=cleanProbabilities(body.probabilities);
  const monthlyTarget=body.monthlyTarget===null||body.monthlyTarget===""?null:moneyValue(body.monthlyTarget);
  const currencyInput=asText(body.currency,3).toUpperCase();const currency=/^[A-Z]{3}$/.test(currencyInput)?currencyInput:"EUR";
  const staleAfterDays=Math.max(1,Math.min(90,Math.round(Number(body.staleAfterDays)||7)));
  const {data,error:upsertError}=await supabase.from("website_crm_forecast_settings").upsert({id:"default",stage_probabilities:probabilities,monthly_target:monthlyTarget,currency,stale_after_days:staleAfterDays,updated_by:session?.name||session?.email||"MOONY Admin",updated_at:new Date().toISOString()},{onConflict:"id"}).select("*").single();
  if(upsertError){if(upsertError.code==="42P01")return NextResponse.json({error:"Appliquez la migration CRM Forecast pour enregistrer ces paramètres."},{status:409});return NextResponse.json({error:upsertError.message},{status:500})}
  await writeAuditLog(supabase,session,"crm.forecast_settings_updated","crm_forecast","default","Paramètres de prévision commerciale modifiés",{monthlyTarget,currency,staleAfterDays,probabilities});
  return NextResponse.json({settings:data});
}
