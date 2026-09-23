const ALLOWED=new Set(["en","hi","gu","mr","fr","es","de","zh-TW","ta","ja"]);
function send(res,status,body){res.statusCode=status;res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","public, max-age=3600");res.end(JSON.stringify(body));}
async function googleTranslate(text,target){
  const u=new URL("https://translate.googleapis.com/translate_a/single");
  u.searchParams.set("client","gtx");u.searchParams.set("sl","auto");u.searchParams.set("tl",target);u.searchParams.set("dt","t");u.searchParams.set("q",text);
  const c=new AbortController();const timer=setTimeout(()=>c.abort(),8000);
  try{const r=await fetch(u,{signal:c.signal});if(!r.ok)throw new Error("Google translate unavailable");const j=await r.json();
    const out=Array.isArray(j)&&Array.isArray(j[0])?j[0].map(x=>x&&x[0]?x[0]:"").join(""):"";return out.trim()||text;
  }finally{clearTimeout(timer);}
}
async function myMemory(text,target){
  if(target==="zh-TW")target="zh-TW";
  const u=`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${encodeURIComponent(target)}`;
  const r=await fetch(u);if(!r.ok)throw new Error("MyMemory unavailable");const j=await r.json();return j?.responseData?.translatedText||text;
}
module.exports=async function handler(req,res){
  if(req.method!=="POST"){res.setHeader("Allow","POST");return send(res,405,{error:"METHOD_NOT_ALLOWED"});}
  const body=req.body&&typeof req.body==="object"?req.body:{};
  const target=String(body.target||"");
  const texts=(Array.isArray(body.texts)?body.texts:[]).map(x=>String(x||"").trim()).filter(Boolean).slice(0,40);
  if(!ALLOWED.has(target)||!texts.length)return send(res,400,{error:"INVALID_TRANSLATION_REQUEST"});
  const translations=[];
  for(let i=0;i<texts.length;i+=6){
    const batch=texts.slice(i,i+6);
    const out=await Promise.all(batch.map(async text=>{try{return await googleTranslate(text,target);}catch(_){try{return await myMemory(text,target);}catch(_){return text;}}}));
    translations.push(...out);
  }
  return send(res,200,{target,translations});
};
