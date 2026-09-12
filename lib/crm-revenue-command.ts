import { monthlyEquivalent } from "@/lib/crm-billing-ops";

type CurrencyMetrics={
 currency:string;currentMrr:number;currentArr:number;startingMrr:number;newMrr:number;expansionMrr:number;contractionMrr:number;churnMrr:number;nrr:number|null;grr:number|null;topClientShare:number;top5Share:number;
 invoicedMonth:number;collectedMonth:number;outstanding:number;overdue:number;overdueRatio:number;dso:number|null;aging:{current:number;d1_30:number;d31_60:number;d61_90:number;d90plus:number};
 clients:{total:number;new:number;expanded:number;contracted:number;churned:number};
};
export type RevenueCommandData={available:boolean;baseline:{periodMonth:string;capturedAt:string|null}|null;currentMonth:string;currencies:CurrencyMetrics[];trend:Array<{periodMonth:string;currency:string;mrr:number;arr:number;clients:number}>;accounts:Array<{clientId:string;accountName:string;owner:string|null;country:string|null;currency:string;mrr:number;arr:number;share:number;subscriptions:number}>;products:Array<{name:string;currency:string;mrr:number;arr:number;subscriptions:number}>;settings:any};

function missing(error:any){return ["42P01","42703"].includes(String(error?.code||""))}
function relation(value:any){return Array.isArray(value)?value[0]??null:value??null}
function monthKey(date=new Date()){return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,"0")}-01`}
function dayOnly(date=new Date()){return date.toISOString().slice(0,10)}
function daysBetween(a:string,b:string){return Math.max(0,Math.floor((new Date(`${b}T00:00:00Z`).getTime()-new Date(`${a}T00:00:00Z`).getTime())/86400000))}
function bucket<T>(map:Map<string,T>,key:string,factory:()=>T){let value=map.get(key);if(!value){value=factory();map.set(key,value)}return value}
function clientKey(clientId:string,currency:string){return `${clientId}::${currency}`}

export async function captureRevenueSnapshot(supabase:any,options:{actor?:string;periodMonth?:string}={}){
 const periodMonth=options.periodMonth||monthKey(),actor=options.actor||"MOONY Revenue Command";
 const existing=await supabase.from("website_crm_revenue_snapshots").select("id,captured_at").eq("period_month",periodMonth).limit(1);
 if(existing.error){if(missing(existing.error))return{available:false,created:false,rows:0,periodMonth};throw new Error(existing.error.message)}
 if(existing.data?.length)return{available:true,created:false,rows:0,periodMonth,capturedAt:existing.data[0].captured_at};
 const subscriptions=await supabase.from("website_crm_account_subscriptions").select("id,client_id,name,status,billing_model,recurring_amount,currency,updated_at,website_crm_client_accounts(account_name,owner,commercial_owner,website_leads(country))").eq("status","active").order("id");
 if(subscriptions.error){if(missing(subscriptions.error))return{available:false,created:false,rows:0,periodMonth};throw new Error(subscriptions.error.message)}
 const rows=(subscriptions.data??[]).map((row:any)=>{const account=relation(row.website_crm_client_accounts),lead=relation(account?.website_leads),mrr=monthlyEquivalent(Number(row.recurring_amount||0),row.billing_model);return{period_month:periodMonth,client_id:row.client_id,subscription_id:row.id,account_name:account?.account_name||"Compte client",owner:account?.owner||account?.commercial_owner||null,country:lead?.country||null,product_name:row.name,currency:String(row.currency||"XOF").toUpperCase(),mrr,arr:mrr*12,billing_model:row.billing_model,subscription_status:row.status,source_updated_at:row.updated_at,captured_by:actor}});
 if(rows.length){const inserted=await supabase.from("website_crm_revenue_snapshots").insert(rows);if(inserted.error)throw new Error(inserted.error.message)}
 const run=await supabase.from("website_crm_revenue_command_runs").insert({trigger_key:`snapshot:${periodMonth}`,trigger_type:"snapshot",status:"success",summary:`${rows.length} abonnement(s) récurrent(s) capturé(s) pour ${periodMonth}.`});
 if(run.error&&run.error.code!=="23505"&&!missing(run.error))throw new Error(run.error.message);
 return{available:true,created:true,rows:rows.length,periodMonth,capturedAt:new Date().toISOString()};
}

export async function getRevenueCommandData(supabase:any):Promise<RevenueCommandData>{
 const currentMonth=monthKey(),today=dayOnly(),monthStart=currentMonth,trail90=new Date(Date.now()-90*86400000).toISOString().slice(0,10);
 const [settingsRes,snapshotsRes,subsRes,invoicesRes,paymentsRes]=await Promise.all([
  supabase.from("website_crm_revenue_command_settings").select("*").eq("id","default").maybeSingle(),
  supabase.from("website_crm_revenue_snapshots").select("*").order("period_month",{ascending:false}).order("captured_at",{ascending:false}).limit(5000),
  supabase.from("website_crm_account_subscriptions").select("id,client_id,name,status,billing_model,recurring_amount,currency,website_crm_client_accounts(account_name,owner,commercial_owner,website_leads(country))").eq("status","active"),
  supabase.from("website_crm_billing_invoices").select("id,client_id,status,issue_date,due_date,paid_at,last_payment_at,total_amount,amount_paid,currency").neq("status","cancelled").limit(5000),
  supabase.from("website_crm_payments").select("id,status,amount,currency,received_at").eq("status","received").limit(5000),
 ]);
 if(settingsRes.error&&missing(settingsRes.error))return{available:false,baseline:null,currentMonth,currencies:[],trend:[],accounts:[],products:[],settings:null};
 const fatal=[settingsRes.error,snapshotsRes.error,subsRes.error,invoicesRes.error,paymentsRes.error].find((e:any)=>e&&!missing(e));if(fatal)throw new Error(fatal.message);
 const snapshots=snapshotsRes.data??[],periods=[...new Set(snapshots.map((r:any)=>r.period_month))].sort().reverse(),baselinePeriod=periods[0]||null,baselineRows=baselinePeriod?snapshots.filter((r:any)=>r.period_month===baselinePeriod):[];
 const baseline={periodMonth:baselinePeriod,capturedAt:baselineRows[0]?.captured_at||null};
 const currentByClient=new Map<string,number>(),baselineByClient=new Map<string,number>(),accountMeta=new Map<string,{clientId:string;accountName:string;owner:string|null;country:string|null;currency:string;mrr:number;subscriptions:number}>(),productMeta=new Map<string,{name:string;currency:string;mrr:number;subscriptions:number}>();
 for(const row of subsRes.data??[]){const account=relation(row.website_crm_client_accounts),lead=relation(account?.website_leads),currency=String(row.currency||"XOF").toUpperCase(),mrr=monthlyEquivalent(Number(row.recurring_amount||0),row.billing_model),key=clientKey(row.client_id,currency);currentByClient.set(key,(currentByClient.get(key)||0)+mrr);const meta=bucket(accountMeta,key,()=>({clientId:row.client_id,accountName:account?.account_name||"Compte client",owner:account?.owner||account?.commercial_owner||null,country:lead?.country||null,currency,mrr:0,subscriptions:0}));meta.mrr+=mrr;meta.subscriptions+=1;const pk=`${row.name}::${currency}`,product=bucket(productMeta,pk,()=>({name:row.name,currency,mrr:0,subscriptions:0}));product.mrr+=mrr;product.subscriptions+=1}
 for(const row of baselineRows){const key=clientKey(row.client_id,row.currency);baselineByClient.set(key,(baselineByClient.get(key)||0)+Number(row.mrr||0))}
 const currencies=new Set<string>([...currentByClient.keys(),...baselineByClient.keys()].map(k=>k.split("::").pop()||"XOF"));for(const r of invoicesRes.data??[])currencies.add(String(r.currency||"XOF"));for(const r of paymentsRes.data??[])currencies.add(String(r.currency||"XOF"));
 const metrics:CurrencyMetrics[]=[];
 for(const currency of [...currencies].sort()){
  const keys=new Set([...currentByClient.keys(),...baselineByClient.keys()].filter(k=>k.endsWith(`::${currency}`)));let startingMrr=0,currentMrr=0,newMrr=0,expansionMrr=0,contractionMrr=0,churnMrr=0,newClients=0,expanded=0,contracted=0,churned=0;
  for(const key of keys){const start=baselineByClient.get(key)||0,current=currentByClient.get(key)||0;startingMrr+=start;currentMrr+=current;if(start===0&&current>0){newMrr+=current;newClients++}else if(start>0&&current===0){churnMrr+=start;churned++}else if(current>start){expansionMrr+=current-start;expanded++}else if(current<start){contractionMrr+=start-current;contracted++}}
  const accountValues=[...accountMeta.values()].filter(a=>a.currency===currency).map(a=>a.mrr).sort((a,b)=>b-a),topClientShare=currentMrr>0?(accountValues[0]||0)/currentMrr*100:0,top5Share=currentMrr>0?accountValues.slice(0,5).reduce((a,b)=>a+b,0)/currentMrr*100:0;
  let invoicedMonth=0,invoiced90=0,outstanding=0,overdue=0;const aging={current:0,d1_30:0,d31_60:0,d61_90:0,d90plus:0};
  for(const invoice of invoicesRes.data??[]){if(String(invoice.currency||"")!==currency)continue;const total=Number(invoice.total_amount||0),balance=Math.max(0,total-Number(invoice.amount_paid||0));if(invoice.issue_date&&invoice.issue_date>=monthStart&&invoice.issue_date<=today)invoicedMonth+=total;if(invoice.issue_date&&invoice.issue_date>=trail90&&invoice.issue_date<=today)invoiced90+=total;if(!["issued","overdue"].includes(invoice.status)||balance<=0)continue;outstanding+=balance;const due=invoice.due_date;if(!due||due>=today){aging.current+=balance;continue}const days=daysBetween(due,today);overdue+=balance;if(days<=30)aging.d1_30+=balance;else if(days<=60)aging.d31_60+=balance;else if(days<=90)aging.d61_90+=balance;else aging.d90plus+=balance}
  let collectedMonth=0;for(const payment of paymentsRes.data??[]){if(String(payment.currency||"")===currency&&payment.received_at&&payment.received_at.slice(0,10)>=monthStart&&payment.received_at.slice(0,10)<=today)collectedMonth+=Number(payment.amount||0)}
  const nrr=startingMrr>0?(startingMrr+expansionMrr-contractionMrr-churnMrr)/startingMrr*100:null,grr=startingMrr>0?(startingMrr-contractionMrr-churnMrr)/startingMrr*100:null,dso=invoiced90>0?outstanding/invoiced90*90:null;
  metrics.push({currency,currentMrr,currentArr:currentMrr*12,startingMrr,newMrr,expansionMrr,contractionMrr,churnMrr,nrr,grr,topClientShare,top5Share,invoicedMonth,collectedMonth,outstanding,overdue,overdueRatio:outstanding>0?overdue/outstanding*100:0,dso,aging,clients:{total:accountValues.length,new:newClients,expanded,contracted,churned}})
 }
 const trendMap=new Map<string,{periodMonth:string;currency:string;mrr:number;arr:number;clients:Set<string>}>();for(const row of snapshots){const key=`${row.period_month}::${row.currency}`,item=bucket(trendMap,key,()=>({periodMonth:row.period_month,currency:row.currency,mrr:0,arr:0,clients:new Set<string>()}));item.mrr+=Number(row.mrr||0);item.arr+=Number(row.arr||0);item.clients.add(row.client_id)}
 const trend=[...trendMap.values()].map(r=>({periodMonth:r.periodMonth,currency:r.currency,mrr:r.mrr,arr:r.arr,clients:r.clients.size})).sort((a,b)=>a.periodMonth.localeCompare(b.periodMonth)||a.currency.localeCompare(b.currency));
 const totalsByCurrency=new Map(metrics.map(m=>[m.currency,m.currentMrr]));const accounts=[...accountMeta.values()].map(a=>({...a,arr:a.mrr*12,share:(totalsByCurrency.get(a.currency)||0)>0?a.mrr/(totalsByCurrency.get(a.currency)||1)*100:0})).sort((a,b)=>b.mrr-a.mrr);const products=[...productMeta.values()].map(p=>({...p,arr:p.mrr*12})).sort((a,b)=>b.mrr-a.mrr);
 return{available:true,baseline:baselinePeriod?baseline:null,currentMonth,currencies:metrics,trend,accounts,products,settings:settingsRes.data??{id:"default",alerts_enabled:false,nrr_floor_percent:90,top_client_concentration_percent:35,overdue_ratio_percent:20}};
}

async function notify(supabase:any,key:string,title:string,subtitle:string,severity:"warning"|"urgent"){
 let count=0;for(const role of ["founder","admin"]){const result=await supabase.from("control_center_generated_notifications").insert({target_role:role,title,subtitle,href:"/admin/customer-success/revenue-command",severity,source_type:"crm_revenue_command",source_id:key});if(!result.error)count++}return count;
}
async function beginRun(supabase:any,type:"nrr_below_floor"|"client_concentration"|"overdue_ratio",currency:string,key:string,summary:string){const result=await supabase.from("website_crm_revenue_command_runs").insert({trigger_key:key,trigger_type:type,currency,status:"success",summary}).select("id").single();if(result.error){if(result.error.code==="23505")return false;throw new Error(result.error.message)}return true}
export async function syncRevenueCommand(supabase:any){
 const snapshot=await captureRevenueSnapshot(supabase);if(snapshot.available===false)return{available:false,snapshot,alerts:0,errors:[] as string[]};const data=await getRevenueCommandData(supabase);if(!data.available)return{available:false,snapshot,alerts:0,errors:[] as string[]};const settings=data.settings||{},enabled=Boolean(settings.alerts_enabled);let alerts=0;const errors:string[]=[];if(!enabled)return{available:true,snapshot,alerts,errors,enabled:false};
 for(const m of data.currencies){const period=data.currentMonth;if(m.nrr!==null&&m.nrr<Number(settings.nrr_floor_percent||90)){const key=`nrr:${m.currency}:${period}`;try{if(await beginRun(supabase,"nrr_below_floor",m.currency,key,`NRR ${m.nrr.toFixed(1)}%`))alerts+=await notify(supabase,key,"NRR sous le seuil",`${m.currency} · NRR ${m.nrr.toFixed(1)}% · seuil ${Number(settings.nrr_floor_percent||90).toFixed(1)}%.`,"urgent")}catch(e){errors.push(e instanceof Error?e.message:String(e))}}
  if(m.topClientShare>Number(settings.top_client_concentration_percent||35)){const key=`concentration:${m.currency}:${period}`;try{if(await beginRun(supabase,"client_concentration",m.currency,key,`Top client ${m.topClientShare.toFixed(1)}%`))alerts+=await notify(supabase,key,"Concentration revenu élevée",`${m.currency} · le premier compte représente ${m.topClientShare.toFixed(1)}% du MRR.`,"warning")}catch(e){errors.push(e instanceof Error?e.message:String(e))}}
  if(m.overdueRatio>Number(settings.overdue_ratio_percent||20)){const key=`overdue-ratio:${m.currency}:${period}`;try{if(await beginRun(supabase,"overdue_ratio",m.currency,key,`Retard ${m.overdueRatio.toFixed(1)}%`))alerts+=await notify(supabase,key,"Créances en retard élevées",`${m.currency} · ${m.overdueRatio.toFixed(1)}% du solde à recevoir est en retard.`,"warning")}catch(e){errors.push(e instanceof Error?e.message:String(e))}}
 }
 return{available:true,snapshot,alerts,errors,enabled:true};
}
