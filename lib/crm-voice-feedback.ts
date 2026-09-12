function missing(error:any){return ["42P01","42703"].includes(String(error?.code||""))}
function day(value:Date){return value.toISOString().slice(0,10)}

async function notify(supabase:any,item:any,title:string,subtitle:string,severity:"warning"|"urgent"){
 let count=0;
 for(const role of ["founder","admin"]){
  const result=await supabase.from("control_center_generated_notifications").insert({
   target_role:role,
   title,
   subtitle,
   href:`/admin/customer-success/voice?item=${item.id}`,
   severity,
   source_type:"crm_voice_feedback",
   source_id:item.id,
  });
  if(!result.error)count++;
 }
 return count;
}

async function beginRun(supabase:any,triggerKey:string,triggerType:"critical_feedback"|"close_loop_due",feedbackId:string,summary:string){
 const result=await supabase.from("website_crm_feedback_runs").insert({trigger_key:triggerKey,trigger_type:triggerType,feedback_id:feedbackId,status:"success",summary}).select("id").single();
 if(result.error){if(result.error.code==="23505")return false;if(missing(result.error))return false;throw new Error(result.error.message)}
 return true;
}

export async function syncVoiceFeedbackAlerts(supabase:any){
 const settingsRes=await supabase.from("website_crm_feedback_settings").select("*").eq("id","default").maybeSingle();
 if(settingsRes.error){if(missing(settingsRes.error))return{available:false,enabled:false,alerts:0,errors:[] as string[]};throw new Error(settingsRes.error.message)}
 const settings=settingsRes.data??{enabled:false,close_loop_warning_days:3};
 if(!settings.enabled)return{available:true,enabled:false,alerts:0,errors:[] as string[]};
 const itemsRes=await supabase.from("website_crm_feedback_items").select("id,title,priority,status,owner,close_loop_due,product_area,website_crm_client_accounts(account_name)").in("status",["new","reviewed","planned","in_progress"]).order("updated_at",{ascending:false}).limit(500);
 if(itemsRes.error){if(missing(itemsRes.error))return{available:false,enabled:true,alerts:0,errors:[] as string[]};throw new Error(itemsRes.error.message)}
 const today=new Date(),warningDays=Math.max(0,Number(settings.close_loop_warning_days||0)),warningLimit=day(new Date(today.getTime()+warningDays*86400000));let alerts=0;const errors:string[]=[];
 for(const item of itemsRes.data??[]){
  const account=Array.isArray(item.website_crm_client_accounts)?item.website_crm_client_accounts[0]:item.website_crm_client_accounts;
  const accountName=account?.account_name||"Retour non rattaché";
  if(item.priority==="critical"){
   const key=`critical:${item.id}`;
   try{if(await beginRun(supabase,key,"critical_feedback",item.id,`Feedback critique · ${item.title}`))alerts+=await notify(supabase,item,"Feedback critique à examiner",`${accountName} · ${item.product_area} · ${item.title}`,"urgent")}catch(error){errors.push(error instanceof Error?error.message:String(error))}
  }
  if(item.close_loop_due&&item.close_loop_due<=warningLimit){
   const key=`close-loop:${item.id}:${item.close_loop_due}`;
   const overdue=item.close_loop_due<day(today);
   try{if(await beginRun(supabase,key,"close_loop_due",item.id,`Close the loop ${item.close_loop_due} · ${item.title}`))alerts+=await notify(supabase,item,overdue?"Retour client à clôturer":"Retour client à recontacter",`${accountName} · échéance ${item.close_loop_due} · ${item.title}`,overdue?"urgent":"warning")}catch(error){errors.push(error instanceof Error?error.message:String(error))}
  }
 }
 return{available:true,enabled:true,alerts,errors};
}
