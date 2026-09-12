import { getRevenueCommandData } from "@/lib/crm-revenue-command";

type MoneyBucket={currency:string;amount:number;weighted?:number;count:number;unscored?:number;commit?:number;bestCase?:number;pipeline?:number};
export type ExecutiveMetrics={
 capturedAt:string;periodMonth:string;
 revenue:{available:boolean;baseline:string|null;currencies:any[];trend:any[];accounts:any[]};
 commercial:{leadsTotal:number;leadsCreatedInPeriod:number;leadStages:Record<string,number>;opportunitiesTotal:number;openOpportunities:number;wonOpportunities:number;lostOpportunities:number;proposalsTotal:number;proposalsAcceptedInPeriod:number;pipelineByCurrency:MoneyBucket[];wonByCurrency:MoneyBucket[]};
 customers:{total:number;active:number;healthy:number;watch:number;atRisk:number;critical:number;renewals90:number};
 forecast:{byCurrency:Array<MoneyBucket&{renewal:number;expansion:number}>};
 voice:{open:number;critical:number;planned:number;closed:number;topThemes:Array<{theme:string;count:number}>};
 escalations:{available:boolean;open:number;critical:number};
 dataQuality:{revenue:boolean;commercial:boolean;customerSuccess:boolean;renewalForecast:boolean;voiceOfCustomer:boolean;escalations:boolean;notes:string[]};
};

function missing(error:any){return ["42P01","42703"].includes(String(error?.code||""))}
function periodBounds(periodMonth:string){const start=new Date(`${periodMonth}T00:00:00Z`);const end=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+1,1));return{start:start.toISOString(),end:end.toISOString(),startDate:periodMonth,endDate:end.toISOString().slice(0,10)}}
function add<K extends string>(record:Record<K,number>,key:K,value=1){record[key]=(record[key]||0)+value}
function moneyBucket(map:Map<string,MoneyBucket>,currency:string){const code=String(currency||"XOF").toUpperCase();let row=map.get(code);if(!row){row={currency:code,amount:0,weighted:0,count:0,unscored:0};map.set(code,row)}return row}

export async function buildExecutiveMetrics(supabase:any,periodMonth:string):Promise<ExecutiveMetrics>{
 const now=new Date().toISOString(),bounds=periodBounds(periodMonth),notes:string[]=[];
 let revenue:any={available:false,baseline:null,currencies:[],trend:[],accounts:[]};
 try{const data=await getRevenueCommandData(supabase);revenue={available:data.available,baseline:data.baseline?.periodMonth??null,currencies:data.currencies??[],trend:data.trend??[],accounts:data.accounts??[]};if(!data.available)notes.push("Revenue Command indisponible : appliquer les migrations V8.7 à V8.10 avant de finaliser un board pack financier.")}catch(error){notes.push(`Revenue Command indisponible : ${error instanceof Error?error.message:String(error)}`)}
 const [leadsRes,oppsRes,proposalsRes,clientsRes,growthRes,feedbackRes,escalationsRes]=await Promise.all([
  supabase.from("website_leads").select("id,status,created_at,updated_at,country").limit(10000),
  supabase.from("website_crm_opportunities").select("id,stage,amount,currency,probability,created_at,updated_at,expected_close_date").limit(10000),
  supabase.from("website_crm_proposals").select("id,status,total_amount,currency,created_at,sent_at,accepted_at").limit(10000),
  supabase.from("website_crm_client_accounts").select("id,status,health_status,health_score,renewal_date,activated_at").limit(10000),
  supabase.from("website_crm_client_growth_opportunities").select("id,kind,status,estimated_value,currency,forecast_category,forecast_probability,expected_close_date").limit(10000),
  supabase.from("website_crm_feedback_items").select("id,priority,status,themes,feedback_kind,product_area,created_at").limit(10000),
  supabase.from("website_crm_escalation_cases").select("id,status,severity,created_at").limit(10000),
 ]);
 const commercialAvailable=!leadsRes.error&&!oppsRes.error&&!proposalsRes.error;if(!commercialAvailable)notes.push("Une ou plusieurs sources Commercial CRM sont indisponibles.");
 const customerSuccessAvailable=!clientsRes.error;if(!customerSuccessAvailable)notes.push("Customer Success est indisponible.");
 const forecastAvailable=!growthRes.error;if(!forecastAvailable)notes.push("Renewal Desk est indisponible.");
 const voiceAvailable=!feedbackRes.error;if(!voiceAvailable)notes.push("Voice of Customer est indisponible.");
 const escalationsAvailable=!escalationsRes.error;if(escalationsRes.error&&!missing(escalationsRes.error))notes.push(`Escalades indisponibles : ${escalationsRes.error.message}`);
 const leadStages:Record<string,number>={};const leads=leadsRes.error?[]:leadsRes.data??[];for(const row of leads)add(leadStages,row.status||"unknown");const leadsCreated=leads.filter((row:any)=>row.created_at>=bounds.start&&row.created_at<bounds.end).length;
 const opportunities=oppsRes.error?[]:oppsRes.data??[],pipelineMap=new Map<string,MoneyBucket>(),wonMap=new Map<string,MoneyBucket>();let openOpportunities=0,wonOpportunities=0,lostOpportunities=0;
 for(const row of opportunities){const amount=Number(row.amount||0),prob=Math.max(0,Math.min(1,Number(row.probability||0)));if(row.stage==="won"){wonOpportunities++;const b=moneyBucket(wonMap,row.currency);b.amount+=amount;b.count++}else if(row.stage==="lost")lostOpportunities++;else{openOpportunities++;const b=moneyBucket(pipelineMap,row.currency);b.amount+=amount;b.weighted=(b.weighted||0)+amount*prob;b.count++}}
 const proposals=proposalsRes.error?[]:proposalsRes.data??[];const proposalsAccepted=proposals.filter((row:any)=>row.accepted_at&&row.accepted_at>=bounds.start&&row.accepted_at<bounds.end).length;
 const clients=clientsRes.error?[]:clientsRes.data??[],active=clients.filter((row:any)=>row.status==="active");const renewalLimit=new Date(Date.now()+90*86400000).toISOString().slice(0,10),today=new Date().toISOString().slice(0,10);const customers={total:clients.length,active:active.length,healthy:active.filter((r:any)=>r.health_status==="healthy").length,watch:active.filter((r:any)=>r.health_status==="watch").length,atRisk:active.filter((r:any)=>r.health_status==="at_risk").length,critical:active.filter((r:any)=>r.health_status==="critical").length,renewals90:active.filter((r:any)=>r.renewal_date&&r.renewal_date>=today&&r.renewal_date<=renewalLimit).length};
 const forecastMap=new Map<string,MoneyBucket&{renewal:number;expansion:number}>();for(const row of growthRes.error?[]:growthRes.data??[]){if(["won","lost","dismissed"].includes(row.status))continue;const currency=String(row.currency||"XOF").toUpperCase();let b=forecastMap.get(currency);if(!b){b={currency,amount:0,weighted:0,count:0,unscored:0,commit:0,bestCase:0,pipeline:0,renewal:0,expansion:0};forecastMap.set(currency,b)}const value=Number(row.estimated_value||0),prob=row.forecast_probability==null?null:Number(row.forecast_probability)/100;b.amount+=value;b.count++;if(prob==null)b.unscored=(b.unscored||0)+1;else b.weighted=(b.weighted||0)+value*Math.max(0,Math.min(1,prob));if(row.forecast_category==="commit")b.commit=(b.commit||0)+value;else if(row.forecast_category==="best_case")b.bestCase=(b.bestCase||0)+value;else b.pipeline=(b.pipeline||0)+value;if(row.kind==="renewal")b.renewal+=value;else b.expansion+=value}
 const feedback=feedbackRes.error?[]:feedbackRes.data??[],themes=new Map<string,number>();for(const row of feedback){if(row.status==="declined")continue;for(const theme of row.themes??[]){const text=String(theme).trim();if(text)themes.set(text,(themes.get(text)||0)+1)}}const voice={open:feedback.filter((r:any)=>!["closed","declined"].includes(r.status)).length,critical:feedback.filter((r:any)=>r.priority==="critical"&&!["closed","declined"].includes(r.status)).length,planned:feedback.filter((r:any)=>["planned","in_progress"].includes(r.status)).length,closed:feedback.filter((r:any)=>r.status==="closed").length,topThemes:[...themes.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8).map(([theme,count])=>({theme,count}))};
 const escalationsRows=escalationsRes.error?[]:escalationsRes.data??[];const escalations={available:escalationsAvailable,open:escalationsRows.filter((r:any)=>!["resolved","closed"].includes(r.status)).length,critical:escalationsRows.filter((r:any)=>!["resolved","closed"].includes(r.status)&&r.severity==="critical").length};
 return{capturedAt:now,periodMonth,revenue,commercial:{leadsTotal:leads.length,leadsCreatedInPeriod:leadsCreated,leadStages,opportunitiesTotal:opportunities.length,openOpportunities,wonOpportunities,lostOpportunities,proposalsTotal:proposals.length,proposalsAcceptedInPeriod:proposalsAccepted,pipelineByCurrency:[...pipelineMap.values()].sort((a,b)=>a.currency.localeCompare(b.currency)),wonByCurrency:[...wonMap.values()].sort((a,b)=>a.currency.localeCompare(b.currency))},customers,forecast:{byCurrency:[...forecastMap.values()].sort((a,b)=>a.currency.localeCompare(b.currency))},voice,escalations,dataQuality:{revenue:Boolean(revenue.available),commercial:commercialAvailable,customerSuccess:customerSuccessAvailable,renewalForecast:forecastAvailable,voiceOfCustomer:voiceAvailable,escalations:escalationsAvailable,notes}};
}
