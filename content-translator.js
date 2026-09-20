/* Tiny Tiffin v2.5 — full-page dynamic translation layer */
(function () {
  "use strict";

  const CACHE_KEY = "tt_dynamic_translations_v2";
  const cache = (() => { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}"); } catch (_) { return {}; } })();
  const targetMap = { hi:"hi", gu:"gu", mr:"mr", fr:"fr", es:"es", de:"de", yue:"zh-TW", ta:"ta", ja:"ja" };

  function save(){ try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch (_) {} }
  function ck(text,target){ return `${target}|${String(text||"").trim()}`; }
  function targetFor(lang){ return targetMap[lang] || lang; }

  async function serverTranslate(texts, target){
    const response = await fetch("/api/translate", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({texts, target, source:"auto"})
    });
    if(!response.ok) throw new Error("Translation service unavailable");
    const data=await response.json();
    return Array.isArray(data.translations) ? data.translations : [];
  }

  async function directTranslate(text,target){
    const url=`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(text)}`;
    const response=await fetch(url);
    if(!response.ok) throw new Error("Direct translation unavailable");
    const data=await response.json();
    const translated=Array.isArray(data)&&Array.isArray(data[0])?data[0].map(x=>x&&x[0]?x[0]:"").join(""):"";
    if(!translated.trim()) throw new Error("Empty translation");
    return translated.trim();
  }

  async function translateMany(items,lang){
    if(lang==="en") return items.slice();
    const target=targetFor(lang);
    const raw=items.map(x=>String(x||"").trim());
    const unique=[...new Set(raw.filter(Boolean))];
    const missing=unique.filter(x=>!cache[ck(x,target)]);
    for(let i=0;i<missing.length;i+=30){
      const batch=missing.slice(i,i+30);
      try{
        const out=await serverTranslate(batch,target);
        batch.forEach((x,j)=>{ if(out[j]) cache[ck(x,target)]=out[j]; });
        save();
      }catch(_){
        const settled=await Promise.all(batch.map(async x=>{ try{return await directTranslate(x,target);}catch(_){return x;} }));
        batch.forEach((x,j)=>{ cache[ck(x,target)]=settled[j]||x; });
        save();
      }
    }
    return raw.map(x=>cache[ck(x,target)]||x);
  }

  async function translateText(text,lang){ return (await translateMany([text],lang))[0] || text; }

  async function translateToEnglish(text){
    text=String(text||"").trim(); if(!text) return text;
    const key=ck(text,"en"); if(cache[key]) return cache[key];
    try{
      const out=await serverTranslate([text],"en");
      cache[key]=out[0]||text; save(); return cache[key];
    }catch(_){
      try{ cache[key]=await directTranslate(text,"en"); save(); return cache[key]; }catch(_){ return text; }
    }
  }

  async function localizeRecipe(r,modal,lang){
    if(!modal||lang==="en") return;
    const title=modal.querySelector("h2"), desc=modal.querySelector(".desc");
    const ingredientItems=[...modal.querySelectorAll("section:nth-of-type(1) li")];
    const stepItems=[...modal.querySelectorAll("section:nth-of-type(2) li")];
    const tips=[...modal.querySelectorAll(".tip-box")];
    const titleText=(r.name&&r.name[lang]) || (r.name&&r.name.en) || (title&&title.textContent) || "";
    const descText=(r.desc&&r.desc[lang]) || (r.desc&&r.desc.en) || (desc&&desc.textContent) || "";
    const [tt,dd]=await translateMany([titleText,descText],lang);
    if(title&&tt)title.textContent=tt; if(desc&&dd)desc.textContent=dd;
    const ingredients=await translateMany(r.ingredients||ingredientItems.map(x=>x.textContent),lang);
    const steps=await translateMany(r.instructions||stepItems.map(x=>x.textContent),lang);
    ingredientItems.forEach((el,i)=>{if(ingredients[i])el.textContent=ingredients[i];});
    stepItems.forEach((el,i)=>{if(steps[i])el.textContent=steps[i];});
    const packing=(r.packingTip&&((r.packingTip[lang])||r.packingTip.en))||"";
    const kid=(r.kidTip&&((r.kidTip[lang])||r.kidTip.en))||"";
    const translatedTips=await translateMany([packing,kid],lang);
    const labels=[(window.tinyTiffinT&&window.tinyTiffinT(lang,"packingTip"))||"Packing tip",(window.tinyTiffinT&&window.tinyTiffinT(lang,"kidTip"))||"Parent tip"];
    tips.slice(0,2).forEach((tip,i)=>{if(!tip||!translatedTips[i])return;tip.innerHTML=`<strong>${labels[i]}:</strong> ${translatedTips[i]}`;});
  }

  async function localizeRecipeCards(root,recipes,lang){
    if(!root||lang==="en")return;
    const cards=[...root.querySelectorAll(".recipe-card[data-id]")];
    await Promise.all(cards.map(async card=>{
      const r=recipes.find(x=>String(x.id)===String(card.dataset.id)); if(!r)return;
      const title=card.querySelector("h3"),desc=card.querySelector(".desc");
      const name=(r.name&&((r.name[lang])||r.name.en))||"";
      const description=(r.desc&&((r.desc[lang])||r.desc.en))||"";
      const [tt,dd]=await translateMany([name,description],lang);
      if(title&&tt)title.textContent=tt;if(desc&&dd)desc.textContent=dd;
    }));
  }

  async function localizeAIHub(root,lang){ if(root&&lang!=="en") await localizePage(root.querySelector(".ai-hub")||root,lang); }
  async function localizeDeveloper(root,config,lang){ if(root&&lang!=="en") await localizePage(root.querySelector(".simple-page")||root,lang); }

  function skipNode(node){
    const el=node.nodeType===1?node:node.parentElement;
    if(!el)return true;
    return !!el.closest("script,style,noscript,svg,select,option,[data-no-translate],.brand,.smart-store-name,.shopping-chip");
  }
  function isUsefulText(s){
    const x=String(s||"").trim();
    if(!x||x.length<2)return false;
    if(x==="Tiny Tiffin"||/^₹?[\d\s.,%+\-–—×/]+$/.test(x))return false;
    return /[A-Za-zÀ-ž\u0900-\u097F\u0A80-\u0AFF\u0B80-\u0BFF\u3040-\u30FF\u4E00-\u9FFF]/.test(x);
  }

  async function localizePage(root,lang){
    if(!root||lang==="en")return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    const nodes=[];let n;
    while((n=walker.nextNode())){if(!skipNode(n)&&isUsefulText(n.nodeValue))nodes.push(n);}
    const original=nodes.map(n=>n.nodeValue.trim());
    const translated=await translateMany(original,lang);
    nodes.forEach((node,i)=>{
      const raw=node.nodeValue; const lead=(raw.match(/^\s*/)||[""])[0],trail=(raw.match(/\s*$/)||[""])[0];
      node.nodeValue=lead+(translated[i]||original[i])+trail;
    });
    const attrs=[];
    root.querySelectorAll("input[placeholder],textarea[placeholder],[title],[aria-label]").forEach(el=>{
      if(skipNode(el))return;
      ["placeholder","title","aria-label"].forEach(attr=>{const v=el.getAttribute(attr);if(isUsefulText(v))attrs.push({el,attr,v});});
    });
    const attrTranslations=await translateMany(attrs.map(x=>x.v),lang);
    attrs.forEach((x,i)=>x.el.setAttribute(x.attr,attrTranslations[i]||x.v));
  }

  window.tinyTiffinTranslateText=translateText;
  window.tinyTiffinTranslateToEnglish=translateToEnglish;
  window.tinyTiffinLocalizeRecipe=localizeRecipe;
  window.tinyTiffinLocalizeRecipeCards=localizeRecipeCards;
  window.tinyTiffinLocalizeAIHub=localizeAIHub;
  window.tinyTiffinLocalizeDeveloper=localizeDeveloper;
  window.tinyTiffinLocalizePage=localizePage;
})();
