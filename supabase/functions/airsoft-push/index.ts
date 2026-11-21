// Airsoft Geo V4 — Web Push worker. No client secrets or location data.
import {createClient} from "npm:@supabase/supabase-js@2.57.0";
import webpush from "npm:web-push@3.6.7";

const json=(status:number,body:unknown)=>new Response(JSON.stringify(body),{
 status,headers:{"content-type":"application/json","cache-control":"no-store"}
});
const textEncoder=new TextEncoder();
const isId=(v:unknown)=>typeof v==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
function equalHex(a:string,b:string){if(a.length!==b.length)return false;let mismatch=0;for(let i=0;i<a.length;i++)mismatch|=a.charCodeAt(i)^b.charCodeAt(i);return mismatch===0;}
async function signature(id:string,secret:string){
 const key=await crypto.subtle.importKey("raw",textEncoder.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const out=new Uint8Array(await crypto.subtle.sign("HMAC",key,textEncoder.encode(id)));
 return Array.from(out,b=>b.toString(16).padStart(2,"0")).join("");
}
Deno.serve(async(req:Request)=>{
 if(req.method!=="POST")return json(405,{error:"Method not allowed"});
 const url=Deno.env.get("SUPABASE_URL"),secretKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!secretKey)return json(503,{error:"Worker credentials are unavailable"});
 let payload:Record<string,unknown>;
 try{payload=await req.json()}catch{return json(400,{error:"Invalid JSON"})}
 const id=payload?.notification_id;
 if(!isId(id))return json(400,{error:"Invalid notification ID"});
 const provided=(req.headers.get("x-airsoft-signature")||"").toLowerCase();
 if(!/^[a-f0-9]{64}$/.test(provided))return json(401,{error:"Signature required"});
 const db=createClient(url,secretKey,{auth:{autoRefreshToken:false,persistSession:false}});
 try{
  const {data:settings,error:settingsError}=await db.rpc("f4_push_server_config").single();
  if(settingsError||!settings?.enabled||!settings.vapid_public_key||!settings.vapid_private_key||!settings.signing_secret)
   return json(503,{error:"Web Push not configured"});
  const expected=await signature(id as string,settings.signing_secret);
  if(!equalHex(provided,expected))return json(401,{error:"Signature mismatch"});
  const {data:notification,error:notificationError}=await db.from("app_notifications")
   .select("id,user_id,title,detail,category").eq("id",id).single();
  if(notificationError||!notification)return json(404,{error:"Notification not found"});
  const {data:subscriptions,error:subscriptionError}=await db.from("push_subscriptions")
   .select("endpoint,p256dh,auth_key").eq("user_id",notification.user_id).limit(20);
  if(subscriptionError)return json(500,{error:"Subscriptions unavailable"});
  webpush.setVapidDetails("https://airsoft-geo.onrender.com",settings.vapid_public_key,settings.vapid_private_key);
  let delivered=0,failed=0,removed=0;
  for(const row of subscriptions||[]){
   try{
    await webpush.sendNotification({
     endpoint:row.endpoint,keys:{p256dh:row.p256dh,auth:row.auth_key}
    },JSON.stringify({
     title:String(notification.title||"Airsoft Geo").slice(0,100),
     body:String(notification.detail||"Nuevo aviso disponible").slice(0,180),
     tag:"airsoft-"+id,url:"/",category:notification.category
    }),{TTL:300,urgency:notification.category==="team_alert"?"high":"normal"});
    delivered++;
   }catch(e){
    const code=Number((e as {statusCode?:number})?.statusCode||0);
    failed++;
    if(code===404||code===410){
     await db.from("push_subscriptions").delete().eq("endpoint",row.endpoint);
     removed++;
    }
   }
  }
  return json(200,{ok:true,delivered,failed,removed});
 }catch(e){console.error("Push dispatch failed",String(e).slice(0,180));return json(500,{error:"Internal push error"})}
});
