import { NextResponse } from "next/server";
import { asText, requireAdmin, writeAuditLog } from "@/lib/admin-api";
import { buildExecutiveMetrics } from "@/lib/crm-executive-reporting";

function missing(error:any){return ["42P01","42703"].includes(String(error?.code||""))}
async function bodyOf(request:Request){try{return await request.json() as Record<string,unknown>}catch{return null}}
function monthKey(date=new Date()){return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,"0")}-01`}
function monthValue(value:unknown){const text=asText(value,20);return /^\d{4}-\d{2}-01$/.test(text)?text:null}
function actor(session:any){return session.name||session.email||"MOONY Admin"}
function nullable(value:unknown,max=10000){const text=asText(value,max);return text||null}

export async function GET(request:Request){
 const {error,supabase}=requireAdmin(request,"crm.read");if(error||!supabase)return error;const currentMonth=monthKey();
 const reports=await supabase.from("website_crm_executive_reports").select("*").order("period_month",{ascending:false}).limit(36);
 if(reports.error){if(missing(reports.error))return NextResponse.json({available:false,currentMonth,reports:[],live:null});return NextResponse.json({error:reports.error.message},{status:500})}
 try{const live=await buildExecutiveMetrics(supabase,currentMonth);return NextResponse.json({available:true,currentMonth,reports:reports.data??[],live})}catch(err){return NextResponse.json({available:true,currentMonth,reports:reports.data??[],live:null,liveError:err instanceof Error?err.message:"Reporting live indisponible."})}
}

export async function POST(request:Request){
 const {error,supabase,session}=requireAdmin(request,"crm.write");if(error||!supabase||!session)return error;const body=await bodyOf(request);if(!body)return NextResponse.json({error:"Requête invalide."},{status:400});const action=asText(body.action,40),who=actor(session),now=new Date().toISOString(),currentMonth=monthKey();
 if(action==="capture"){
  const periodMonth=monthValue(body.periodMonth)||currentMonth;if(periodMonth!==currentMonth)return NextResponse.json({error:"Les nouvelles captures sont limitées au mois courant afin de ne pas fabriquer un historique rétroactif."},{status:422});
  const existing=await supabase.from("website_crm_executive_reports").select("id,status,title").eq("period_month",periodMonth).maybeSingle();if(existing.error&&!missing(existing.error))return NextResponse.json({error:existing.error.message},{status:500});if(existing.data?.status==="final")return NextResponse.json({error:"Ce board pack est finalisé et verrouillé. Créez le rapport du mois suivant au lieu de réécrire l’historique."},{status:409});
  let metrics;try{metrics=await buildExecutiveMetrics(supabase,periodMonth)}catch(err){return NextResponse.json({error:err instanceof Error?err.message:"Capture impossible."},{status:500})}
  const title=asText(body.title,240)||existing.data?.title||`Executive & Investor Report · ${periodMonth.slice(0,7)}`;const payload={period_month:periodMonth,title,status:"draft",metrics,data_quality:metrics.dataQuality,captured_at:now,captured_by:who,updated_by:who,updated_at:now};
  const saved=existing.data?await supabase.from("website_crm_executive_reports").update(payload).eq("id",existing.data.id).select("*").single():await supabase.from("website_crm_executive_reports").insert({...payload,created_by:who}).select("*").single();if(saved.error){if(missing(saved.error))return NextResponse.json({error:"Appliquez la migration V8.12 avant de capturer un board pack."},{status:503});return NextResponse.json({error:saved.error.message},{status:500})}
  await writeAuditLog(supabase,session,"crm.executive_report_capture","crm_executive_report",saved.data.id,`Board pack capturé · ${title}`,{periodMonth,dataQuality:metrics.dataQuality});return NextResponse.json({ok:true,report:saved.data});
 }
 const id=asText(body.id,80);if(!id)return NextResponse.json({error:"Rapport obligatoire."},{status:422});const report=await supabase.from("website_crm_executive_reports").select("*").eq("id",id).maybeSingle();if(report.error||!report.data)return NextResponse.json({error:"Rapport introuvable."},{status:404});
 if(action==="notes"){
  if(report.data.status==="final")return NextResponse.json({error:"Un rapport finalisé est verrouillé."},{status:409});const patch={title:asText(body.title,240)||report.data.title,highlights:nullable(body.highlights),risks:nullable(body.risks),priorities:nullable(body.priorities),decisions:nullable(body.decisions),updated_by:who,updated_at:now};const updated=await supabase.from("website_crm_executive_reports").update(patch).eq("id",id).select("*").single();if(updated.error)return NextResponse.json({error:updated.error.message},{status:500});await writeAuditLog(supabase,session,"crm.executive_report_notes","crm_executive_report",id,`Commentaires exécutifs · ${updated.data.title}`,{});return NextResponse.json({ok:true,report:updated.data});
 }
 if(action==="finalize"){
  if(report.data.status==="final")return NextResponse.json({ok:true,report:report.data});const quality=report.data.data_quality||{};const missingCore=[] as string[];if(!quality.revenue)missingCore.push("Revenue Command");if(!quality.commercial)missingCore.push("Commercial CRM");if(!quality.customerSuccess)missingCore.push("Customer Success");if(missingCore.length)return NextResponse.json({error:`Impossible de finaliser : sources essentielles indisponibles (${missingCore.join(", ")}). La capture peut rester en brouillon.`},{status:422});
  const finalized=await supabase.from("website_crm_executive_reports").update({status:"final",finalized_at:now,finalized_by:who,updated_by:who,updated_at:now}).eq("id",id).select("*").single();if(finalized.error)return NextResponse.json({error:finalized.error.message},{status:500});await writeAuditLog(supabase,session,"crm.executive_report_finalize","crm_executive_report",id,`Board pack finalisé · ${finalized.data.title}`,{periodMonth:finalized.data.period_month});return NextResponse.json({ok:true,report:finalized.data});
 }
 return NextResponse.json({error:"Action non prise en charge."},{status:422});
}
