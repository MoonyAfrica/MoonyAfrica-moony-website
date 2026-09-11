import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { asNullableText, asText, requireAdmin, writeAuditLog } from "@/lib/admin-api";

const stages = new Set(["new","to_contact","contacted","appointment","proposal","negotiation","won","lost"]);
const proposalStatuses = new Set(["draft","sent","viewed","accepted","rejected","expired","superseded"]);
const buyingRoles = new Set(["decision_maker","champion","influencer","procurement","legal","user","other"]);
const influences = new Set(["high","medium","low"]);
const billingModels = new Set(["one_time","monthly","quarterly","semiannual","annual","custom"]);
const defaultProbabilities:Record<string,number>={new:.05,to_contact:.10,contacted:.20,appointment:.35,proposal:.55,negotiation:.75,won:1,lost:0};
const stageOrder:Record<string,number>={new:1,to_contact:2,contacted:3,appointment:4,proposal:5,negotiation:6,won:7,lost:0};

async function bodyOf(request:Request){try{return await request.json() as Record<string,unknown>}catch{return null}}
function numberValue(value:unknown,fallback=0){const parsed=Number(value);return Number.isFinite(parsed)?parsed:fallback}
function money(value:unknown){return Math.max(0,Math.round(numberValue(value)*100)/100)}
function probability(value:unknown,fallback=.05){return Math.max(0,Math.min(1,numberValue(value,fallback)))}
function currency(value:unknown,fallback="XOF"){const code=asText(value,3).toUpperCase();return /^[A-Z]{3}$/.test(code)?code:fallback}
function dateOnly(value:unknown){const text=asText(value,20);return /^\d{4}-\d{2}-\d{2}$/.test(text)?text:null}
function isoOrNull(value:unknown){const text=asText(value,80);if(!text)return null;const time=new Date(text).getTime();return Number.isFinite(time)?new Date(time).toISOString():null}
function actor(session:{name?:string;email?:string}|null){return session?.name||session?.email||"MOONY Admin"}

async function event(supabase:any,opportunityId:string,leadId:string|null,eventType:string,title:string,detail:string|null,actorName:string,beforeState?:unknown,afterState?:unknown){
  await supabase.from("website_crm_opportunity_events").insert({opportunity_id:opportunityId,lead_id:leadId,event_type:eventType,title,detail,before_state:beforeState??null,after_state:afterState??null,actor:actorName});
}

async function syncLeadSummary(supabase:any,leadId:string){
  const result=await supabase.from("website_crm_opportunities").select("stage,amount,owner,updated_at").eq("lead_id",leadId).order("updated_at",{ascending:false});
  if(result.error||!result.data?.length)return;
  const opportunities=result.data as Array<{stage:string;amount:number|null;owner:string|null;updated_at:string}>;
  const open=opportunities.filter((item)=>!["won","lost"].includes(item.stage));
  const won=opportunities.filter((item)=>item.stage==="won");
  const source=open.length?open:won.length?won:opportunities;
  const dealValue=source.reduce((sum,item)=>sum+money(item.amount),0);
  let status="lost";
  if(open.length)status=[...open].sort((a,b)=>(stageOrder[b.stage]??0)-(stageOrder[a.stage]??0))[0].stage;
  else if(won.length)status="won";
  const owner=source.find((item)=>item.owner)?.owner??null;
  const patch:Record<string,unknown>={deal_value:dealValue,status,updated_at:new Date().toISOString()};
  if(owner)patch.assigned_to=owner;
  await supabase.from("website_leads").update(patch).eq("id",leadId);
}

function groupBy<T extends Record<string,any>>(rows:T[],key:string){
  const grouped:Record<string,T[]>={};
  for(const row of rows){const id=String(row[key]??"");if(!id)continue;(grouped[id]??=[]).push(row)}
  return grouped;
}

export async function GET(request:Request){
  const {error,supabase}=requireAdmin(request,"crm.read");if(error||!supabase)return error;
  const opportunities=await supabase.from("website_crm_opportunities").select("*,website_leads(id,first_name,last_name,email,company,country,need,status,assigned_to)").order("updated_at",{ascending:false}).limit(500);
  if(opportunities.error){
    if(opportunities.error.code==="42P01")return NextResponse.json({available:false,opportunities:[],contacts:{},items:{},proposals:{},proposalItems:{},events:{},catalog:[],leads:[],metrics:{openCount:0,pipelineValue:0,weightedForecast:0,wonValue:0,proposalValue:0,closingSoon:0}});
    return NextResponse.json({error:opportunities.error.message},{status:500});
  }
  const ids=(opportunities.data??[]).map((item)=>String(item.id));
  const [contacts,items,proposals,events,catalog,leads]=await Promise.all([
    ids.length?supabase.from("website_crm_opportunity_contacts").select("*").in("opportunity_id",ids).order("is_primary",{ascending:false}).order("created_at",{ascending:true}):Promise.resolve({data:[],error:null}),
    ids.length?supabase.from("website_crm_opportunity_items").select("*").in("opportunity_id",ids).order("created_at",{ascending:true}):Promise.resolve({data:[],error:null}),
    ids.length?supabase.from("website_crm_proposals").select("*").in("opportunity_id",ids).order("created_at",{ascending:false}):Promise.resolve({data:[],error:null}),
    ids.length?supabase.from("website_crm_opportunity_events").select("*").in("opportunity_id",ids).order("created_at",{ascending:false}).limit(1500):Promise.resolve({data:[],error:null}),
    supabase.from("website_crm_catalog_items").select("*").eq("active",true).order("category",{ascending:true}).order("name",{ascending:true}),
    supabase.from("website_leads").select("id,first_name,last_name,email,company,country,need,status,assigned_to,deal_value").order("updated_at",{ascending:false}).limit(500),
  ]);
  const proposalRows=proposals.error?[]:(proposals.data??[]);
  const proposalIds=proposalRows.map((item:any)=>String(item.id));
  const proposalItems=proposalIds.length?await supabase.from("website_crm_proposal_items").select("*").in("proposal_id",proposalIds).order("sort_order",{ascending:true}):{data:[],error:null};
  const rows=opportunities.data??[];
  const open=rows.filter((item)=>!["won","lost"].includes(String(item.stage)));
  const today=Date.now(), horizon=today+30*86400000;
  const metrics={
    openCount:open.length,
    pipelineValue:open.reduce((sum,item)=>sum+money(item.amount),0),
    weightedForecast:open.reduce((sum,item)=>sum+money(item.amount)*probability(item.probability,defaultProbabilities[String(item.stage)]??.05),0),
    wonValue:rows.filter((item)=>item.stage==="won").reduce((sum,item)=>sum+money(item.amount),0),
    proposalValue:proposalRows.filter((item:any)=>["draft","sent","viewed"].includes(String(item.status))).reduce((sum:number,item:any)=>sum+money(item.total_amount),0),
    closingSoon:open.filter((item)=>item.expected_close_date&&new Date(String(item.expected_close_date)).getTime()>=today&&new Date(String(item.expected_close_date)).getTime()<=horizon).length,
  };
  return NextResponse.json({available:true,opportunities:rows,contacts:groupBy(contacts.error?[]:(contacts.data??[]),"opportunity_id"),items:groupBy(items.error?[]:(items.data??[]),"opportunity_id"),proposals:groupBy(proposalRows,"opportunity_id"),proposalItems:groupBy(proposalItems.error?[]:(proposalItems.data??[]),"proposal_id"),events:groupBy(events.error?[]:(events.data??[]),"opportunity_id"),catalog:catalog.error?[]:(catalog.data??[]),leads:leads.error?[]:(leads.data??[]),metrics});
}

export async function POST(request:Request){
  const {error,supabase,session}=requireAdmin(request,"crm.write");if(error||!supabase||!session)return error;
  const body=await bodyOf(request);if(!body)return NextResponse.json({error:"Requête invalide."},{status:400});
  const action=asText(body.action,40)||"create";const who=actor(session);

  if(action==="create"){
    const leadId=asText(body.leadId,80),name=asText(body.name,220);if(!leadId||!name)return NextResponse.json({error:"Prospect et nom de l’opportunité obligatoires."},{status:422});
    const stage=stages.has(asText(body.stage,40))?asText(body.stage,40):"new";
    const row={lead_id:leadId,name,stage,probability:stage==="won"?1:stage==="lost"?0:probability(body.probability,defaultProbabilities[stage]??.05),amount:money(body.amount),currency:currency(body.currency),expected_close_date:dateOnly(body.expectedCloseDate),owner:asNullableText(body.owner,180),next_step:asNullableText(body.nextStep,1000),next_step_due_at:isoOrNull(body.nextStepDueAt),source:asNullableText(body.source,120)||"control-center",notes:asNullableText(body.notes,6000),created_by:who,updated_by:who,updated_at:new Date().toISOString()};
    const created=await supabase.from("website_crm_opportunities").insert(row).select("*").single();if(created.error)return NextResponse.json({error:created.error.message},{status:500});
    await event(supabase,created.data.id,leadId,"created","Opportunité créée",`${name} · ${row.amount} ${row.currency}`,who,null,created.data);
    await syncLeadSummary(supabase,leadId);
    await writeAuditLog(supabase,session,"crm.opportunity_created","crm_opportunity",created.data.id,`Opportunité « ${name} » créée`,{leadId,amount:row.amount,currency:row.currency,stage});
    return NextResponse.json({opportunity:created.data},{status:201});
  }

  if(action==="contact"){
    const opportunityId=asText(body.opportunityId,80),name=asText(body.name,180);if(!opportunityId||!name)return NextResponse.json({error:"Opportunité et nom du contact obligatoires."},{status:422});
    const opp=await supabase.from("website_crm_opportunities").select("lead_id").eq("id",opportunityId).maybeSingle();if(opp.error||!opp.data)return NextResponse.json({error:"Opportunité introuvable."},{status:404});
    const buyingRole=buyingRoles.has(asText(body.buyingRole,40))?asText(body.buyingRole,40):"other";const influence=influences.has(asText(body.influence,20))?asText(body.influence,20):"medium";
    if(body.isPrimary===true)await supabase.from("website_crm_opportunity_contacts").update({is_primary:false}).eq("opportunity_id",opportunityId);
    const created=await supabase.from("website_crm_opportunity_contacts").insert({opportunity_id:opportunityId,name,email:asNullableText(body.email,240),phone:asNullableText(body.phone,80),role_title:asNullableText(body.roleTitle,180),buying_role:buyingRole,influence,is_primary:Boolean(body.isPrimary),notes:asNullableText(body.notes,2000)}).select("*").single();if(created.error)return NextResponse.json({error:created.error.message},{status:500});
    await event(supabase,opportunityId,opp.data.lead_id,"contact_added","Interlocuteur ajouté",`${name} · ${buyingRole}`,who,null,created.data);
    await writeAuditLog(supabase,session,"crm.opportunity_contact_added","crm_opportunity",opportunityId,`Interlocuteur ${name} ajouté`,{buyingRole,influence});
    return NextResponse.json({contact:created.data},{status:201});
  }

  if(action==="item"){
    const opportunityId=asText(body.opportunityId,80);if(!opportunityId)return NextResponse.json({error:"Opportunité obligatoire."},{status:422});
    const opp=await supabase.from("website_crm_opportunities").select("lead_id,currency").eq("id",opportunityId).maybeSingle();if(opp.error||!opp.data)return NextResponse.json({error:"Opportunité introuvable."},{status:404});
    let catalog:any=null;const catalogId=asText(body.catalogItemId,80);if(catalogId){const result=await supabase.from("website_crm_catalog_items").select("*").eq("id",catalogId).maybeSingle();catalog=result.data??null}
    const name=asText(body.name,220)||String(catalog?.name??"");if(!name)return NextResponse.json({error:"Nom de l’offre obligatoire."},{status:422});
    const quantity=Math.max(.01,numberValue(body.quantity,1)),unitPrice=money(body.unitPrice??catalog?.unit_price??0),discount=Math.max(0,Math.min(100,numberValue(body.discountPercent,0)));const total=Math.round(quantity*unitPrice*(1-discount/100)*100)/100;
    const billing=billingModels.has(asText(body.billingModel,40))?asText(body.billingModel,40):billingModels.has(String(catalog?.billing_model))?String(catalog.billing_model):"custom";
    const created=await supabase.from("website_crm_opportunity_items").insert({opportunity_id:opportunityId,catalog_item_id:catalogId||null,name,description:asNullableText(body.description,1000)??catalog?.description??null,quantity,unit_price:unitPrice,discount_percent:discount,total_amount:total,billing_model:billing,currency:currency(body.currency,catalog?.currency||opp.data.currency||"XOF")}).select("*").single();if(created.error)return NextResponse.json({error:created.error.message},{status:500});
    const sum=await supabase.from("website_crm_opportunity_items").select("total_amount").eq("opportunity_id",opportunityId);if(!sum.error){const amount=(sum.data??[]).reduce((acc,row)=>acc+money(row.total_amount),0);await supabase.from("website_crm_opportunities").update({amount,updated_by:who,updated_at:new Date().toISOString()}).eq("id",opportunityId)}
    await event(supabase,opportunityId,opp.data.lead_id,"item_added","Offre ajoutée",`${name} · ${total}`,who,null,created.data);await syncLeadSummary(supabase,opp.data.lead_id);
    await writeAuditLog(supabase,session,"crm.opportunity_item_added","crm_opportunity",opportunityId,`Offre « ${name} » ajoutée`,{total,billing});
    return NextResponse.json({item:created.data},{status:201});
  }

  if(action==="proposal"){
    const opportunityId=asText(body.opportunityId,80);if(!opportunityId)return NextResponse.json({error:"Opportunité obligatoire."},{status:422});
    const [opp,items,versions]=await Promise.all([supabase.from("website_crm_opportunities").select("*").eq("id",opportunityId).maybeSingle(),supabase.from("website_crm_opportunity_items").select("*").eq("opportunity_id",opportunityId).order("created_at",{ascending:true}),supabase.from("website_crm_proposals").select("version").eq("opportunity_id",opportunityId).order("version",{ascending:false}).limit(1)]);
    if(opp.error||!opp.data)return NextResponse.json({error:"Opportunité introuvable."},{status:404});
    const version=Number(versions.data?.[0]?.version||0)+1;const proposalCurrency=currency(body.currency,opp.data.currency||"XOF");const rows=items.error?[]:(items.data??[]);const subtotal=rows.length?rows.reduce((sum,row)=>sum+money(row.total_amount),0):money(opp.data.amount);const discountAmount=Math.min(subtotal,money(body.discountAmount));const taxAmount=money(body.taxAmount);const total=Math.max(0,Math.round((subtotal-discountAmount+taxAmount)*100)/100);const reference=`MNY-${new Date().getFullYear()}-${randomUUID().slice(0,8).toUpperCase()}`;
    const created=await supabase.from("website_crm_proposals").insert({opportunity_id:opportunityId,reference,version,title:asText(body.title,240)||`${opp.data.name} — Proposition v${version}`,status:"draft",currency:proposalCurrency,subtotal,discount_amount:discountAmount,tax_amount:taxAmount,total_amount:total,valid_until:dateOnly(body.validUntil),introduction:asNullableText(body.introduction,6000),terms:asNullableText(body.terms,8000),created_by:who,updated_by:who}).select("*").single();if(created.error)return NextResponse.json({error:created.error.message},{status:500});
    if(rows.length){const snapshots=rows.map((row,index)=>({proposal_id:created.data.id,catalog_item_id:row.catalog_item_id,name:row.name,description:row.description,quantity:row.quantity,unit_price:row.unit_price,discount_percent:row.discount_percent,total_amount:row.total_amount,billing_model:row.billing_model,sort_order:index}));const inserted=await supabase.from("website_crm_proposal_items").insert(snapshots);if(inserted.error)return NextResponse.json({error:inserted.error.message},{status:500})}
    const nextProbability=Math.max(probability(opp.data.probability,.55),.55);await supabase.from("website_crm_opportunities").update({stage:"proposal",probability:nextProbability,amount:total||opp.data.amount,updated_by:who,updated_at:new Date().toISOString()}).eq("id",opportunityId);
    await event(supabase,opportunityId,opp.data.lead_id,"proposal_created","Proposition créée",`${reference} · version ${version} · ${total} ${proposalCurrency}`,who,null,created.data);await syncLeadSummary(supabase,opp.data.lead_id);
    await writeAuditLog(supabase,session,"crm.proposal_created","crm_proposal",created.data.id,`Proposition ${reference} créée`,{opportunityId,version,total,currency:proposalCurrency});
    return NextResponse.json({proposal:created.data},{status:201});
  }

  if(action==="proposal_status"){
    const proposalId=asText(body.proposalId,80),status=asText(body.status,40);if(!proposalId||!proposalStatuses.has(status))return NextResponse.json({error:"Proposition ou statut invalide."},{status:422});
    const before=await supabase.from("website_crm_proposals").select("*,website_crm_opportunities(id,lead_id,stage,probability)").eq("id",proposalId).maybeSingle();if(before.error||!before.data)return NextResponse.json({error:"Proposition introuvable."},{status:404});
    const now=new Date().toISOString();const patch:Record<string,unknown>={status,updated_by:who,updated_at:now};if(status==="sent")patch.sent_at=now;if(status==="viewed")patch.viewed_at=now;if(status==="accepted")patch.accepted_at=now;if(status==="rejected")patch.rejected_at=now;
    const updated=await supabase.from("website_crm_proposals").update(patch).eq("id",proposalId).select("*").single();if(updated.error)return NextResponse.json({error:updated.error.message},{status:500});
    const relation=Array.isArray(before.data.website_crm_opportunities)?before.data.website_crm_opportunities[0]:before.data.website_crm_opportunities;const opportunityId=String(relation?.id||before.data.opportunity_id),leadId=String(relation?.lead_id||"");
    if(status==="accepted")await supabase.from("website_crm_opportunities").update({stage:"won",probability:1,updated_by:who,updated_at:now}).eq("id",opportunityId);else if(status==="sent"||status==="viewed")await supabase.from("website_crm_opportunities").update({stage:"proposal",probability:Math.max(.55,numberValue(relation?.probability,.55)),updated_by:who,updated_at:now}).eq("id",opportunityId);
    await event(supabase,opportunityId,leadId||null,"proposal_status",`Proposition ${status}`,`${before.data.reference} : ${before.data.status} → ${status}`,who,{status:before.data.status},{status});if(leadId)await syncLeadSummary(supabase,leadId);
    await writeAuditLog(supabase,session,"crm.proposal_status_updated","crm_proposal",proposalId,`Proposition ${before.data.reference} → ${status}`,{opportunityId,status});
    return NextResponse.json({proposal:updated.data});
  }

  return NextResponse.json({error:"Action non prise en charge."},{status:422});
}

export async function PATCH(request:Request){
  const {error,supabase,session}=requireAdmin(request,"crm.write");if(error||!supabase||!session)return error;const body=await bodyOf(request);if(!body)return NextResponse.json({error:"Requête invalide."},{status:400});
  const id=asText(body.id,80);if(!id)return NextResponse.json({error:"Opportunité introuvable."},{status:422});const before=await supabase.from("website_crm_opportunities").select("*").eq("id",id).maybeSingle();if(before.error||!before.data)return NextResponse.json({error:"Opportunité introuvable."},{status:404});
  const patch:Record<string,unknown>={updated_by:actor(session),updated_at:new Date().toISOString()};
  if("name" in body)patch.name=asText(body.name,220)||before.data.name;if("stage" in body&&stages.has(asText(body.stage,40)))patch.stage=asText(body.stage,40);if("amount" in body)patch.amount=money(body.amount);if("currency" in body)patch.currency=currency(body.currency,before.data.currency);if("probability" in body)patch.probability=probability(body.probability,before.data.probability);if("expectedCloseDate" in body)patch.expected_close_date=dateOnly(body.expectedCloseDate);if("owner" in body)patch.owner=asNullableText(body.owner,180);if("nextStep" in body)patch.next_step=asNullableText(body.nextStep,1000);if("nextStepDueAt" in body)patch.next_step_due_at=isoOrNull(body.nextStepDueAt);if("lossReason" in body)patch.loss_reason=asNullableText(body.lossReason,2000);if("notes" in body)patch.notes=asNullableText(body.notes,6000);
  if(patch.stage==="won")patch.probability=1;if(patch.stage==="lost")patch.probability=0;
  const updated=await supabase.from("website_crm_opportunities").update(patch).eq("id",id).select("*").single();if(updated.error)return NextResponse.json({error:updated.error.message},{status:500});
  await event(supabase,id,before.data.lead_id,"updated","Opportunité mise à jour",patch.stage&&patch.stage!==before.data.stage?`Étape : ${before.data.stage} → ${patch.stage}`:null,actor(session),before.data,updated.data);await syncLeadSummary(supabase,before.data.lead_id);
  await writeAuditLog(supabase,session,"crm.opportunity_updated","crm_opportunity",id,`Opportunité « ${updated.data.name} » mise à jour`,{stage:updated.data.stage,amount:updated.data.amount,probability:updated.data.probability});
  return NextResponse.json({opportunity:updated.data});
}

export async function DELETE(request:Request){
  const {error,supabase,session}=requireAdmin(request,"crm.write");if(error||!supabase||!session)return error;const url=new URL(request.url);const kind=url.searchParams.get("kind")||"opportunity";const id=url.searchParams.get("id")||"";if(!id)return NextResponse.json({error:"Identifiant manquant."},{status:422});
  if(kind==="contact"||kind==="item"){
    const table=kind==="contact"?"website_crm_opportunity_contacts":"website_crm_opportunity_items";const before=await supabase.from(table).select("*").eq("id",id).maybeSingle();if(before.error||!before.data)return NextResponse.json({error:"Élément introuvable."},{status:404});const opp=await supabase.from("website_crm_opportunities").select("lead_id").eq("id",before.data.opportunity_id).maybeSingle();const removed=await supabase.from(table).delete().eq("id",id);if(removed.error)return NextResponse.json({error:removed.error.message},{status:500});
    if(kind==="item"){const sum=await supabase.from("website_crm_opportunity_items").select("total_amount").eq("opportunity_id",before.data.opportunity_id);if(!sum.error)await supabase.from("website_crm_opportunities").update({amount:(sum.data??[]).reduce((acc,row)=>acc+money(row.total_amount),0),updated_at:new Date().toISOString()}).eq("id",before.data.opportunity_id)}
    if(opp.data?.lead_id)await syncLeadSummary(supabase,opp.data.lead_id);await writeAuditLog(supabase,session,`crm.opportunity_${kind}_deleted`,`crm_opportunity`,before.data.opportunity_id,`${kind==="contact"?"Interlocuteur":"Offre"} supprimé(e)`,{id});return NextResponse.json({ok:true});
  }
  const before=await supabase.from("website_crm_opportunities").select("id,name,lead_id").eq("id",id).maybeSingle();if(before.error||!before.data)return NextResponse.json({error:"Opportunité introuvable."},{status:404});const removed=await supabase.from("website_crm_opportunities").delete().eq("id",id);if(removed.error)return NextResponse.json({error:removed.error.message},{status:500});await syncLeadSummary(supabase,before.data.lead_id);await writeAuditLog(supabase,session,"crm.opportunity_deleted","crm_opportunity",id,`Opportunité « ${before.data.name} » supprimée`);return NextResponse.json({ok:true});
}
