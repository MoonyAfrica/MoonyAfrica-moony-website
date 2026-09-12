import { NextResponse } from "next/server";
import { asText, requireAdmin, writeAuditLog } from "@/lib/admin-api";
import { captureRevenueSnapshot, getRevenueCommandData, syncRevenueCommand } from "@/lib/crm-revenue-command";

async function bodyOf(request:Request){try{return await request.json() as Record<string,unknown>}catch{return null}}
function actor(session:any){return session.name||session.email||"MOONY Admin"}
function numberBetween(value:unknown,min:number,max:number){const n=Number(value);return Number.isFinite(n)&&n>=min&&n<=max?n:null}

export async function GET(request:Request){
 const {error,supabase}=requireAdmin(request,"crm.read");if(error||!supabase)return error;
 try{return NextResponse.json(await getRevenueCommandData(supabase))}catch(err){return NextResponse.json({error:err instanceof Error?err.message:"Revenue Command indisponible."},{status:500})}
}

export async function POST(request:Request){
 const {error,supabase,session}=requireAdmin(request,"crm.write");if(error||!supabase||!session)return error;const body=await bodyOf(request);if(!body)return NextResponse.json({error:"Requête invalide."},{status:400});const action=asText(body.action,40),who=actor(session),now=new Date().toISOString();
 if(action==="snapshot"){
  try{const result=await captureRevenueSnapshot(supabase,{actor:who});await writeAuditLog(supabase,session,"crm.revenue_command_snapshot","crm_revenue_snapshot",result.periodMonth,"Baseline revenu mensuel capturé",result);return NextResponse.json(result)}catch(err){return NextResponse.json({error:err instanceof Error?err.message:"Capture impossible."},{status:500})}
 }
 if(action==="sync"){
  try{const result=await syncRevenueCommand(supabase);await writeAuditLog(supabase,session,"crm.revenue_command_sync","crm_revenue_command",null,"Revenue Command analysé",result);return NextResponse.json(result)}catch(err){return NextResponse.json({error:err instanceof Error?err.message:"Analyse impossible."},{status:500})}
 }
 if(action==="settings"){
  const nrr=numberBetween(body.nrrFloorPercent,0,200),concentration=numberBetween(body.topClientConcentrationPercent,1,100),overdue=numberBetween(body.overdueRatioPercent,0,100);if(nrr===null||concentration===null||overdue===null)return NextResponse.json({error:"Seuils exécutifs invalides."},{status:422});
  const saved=await supabase.from("website_crm_revenue_command_settings").upsert({id:"default",alerts_enabled:Boolean(body.alertsEnabled),nrr_floor_percent:nrr,top_client_concentration_percent:concentration,overdue_ratio_percent:overdue,updated_by:who,updated_at:now},{onConflict:"id"}).select("*").single();if(saved.error)return NextResponse.json({error:saved.error.message},{status:500});await writeAuditLog(supabase,session,"crm.revenue_command_settings_updated","crm_revenue_command_settings","default","Seuils Revenue Command mis à jour",{alertsEnabled:Boolean(body.alertsEnabled),nrr,concentration,overdue});return NextResponse.json({ok:true,settings:saved.data});
 }
 return NextResponse.json({error:"Action non prise en charge."},{status:422});
}
