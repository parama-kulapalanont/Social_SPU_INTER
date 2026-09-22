
const tabs = document.querySelectorAll(".studio-tab");
const panels = document.querySelectorAll(".studio-panel");
const cfg = window.SPU_SOCIAL_CONFIG || {};
const endpoint = () => `${String(cfg.SUPABASE_URL || "").replace(/\/+$/,"")}/functions/v1/social-content-studio`;

let sb = null;
let socialRows = [];
let currentDraftId = null;
let currentDraft = null;
let currentImageUrl = null;
let currentImageMode = null;
let lastPrecheck = null;
let currentTemplateKey = "career";
let currentCreateMode = "quick";
let brandAssets = [];

const fmt = n => new Intl.NumberFormat("en-US").format(Number(n||0));
const esc = s => String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));

const interactions = r => Number(r.likes||0)+Number(r.comments||0)+Number(r.shares||0);

let toastTimer = null;
function notify(message,type="info"){
  const el=document.querySelector("#studioToast");
  if(!el)return;
  el.textContent=message;
  el.className=`studio-toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>{el.className="studio-toast";},2400);
}

function markButton(btn,state,label){
  if(!btn)return ()=>{};
  const oldText=btn.textContent;
  btn.classList.remove("is-done","is-error","is-busy");
  if(state==="busy"){btn.classList.add("is-busy");btn.disabled=true;}
  if(label)btn.textContent=label;
  return (result="done",message=null)=>{
    btn.disabled=false;
    btn.classList.remove("is-busy","is-done","is-error");
    if(result==="done")btn.classList.add("is-done");
    if(result==="error")btn.classList.add("is-error");
    btn.textContent=oldText;
    setTimeout(()=>btn.classList.remove("is-done","is-error"),900);
    if(message)notify(message,result==="error"?"error":"success");
  };
}


function switchTab(name){
  tabs.forEach(x=>x.classList.toggle("active",x.dataset.tab===name));
  panels.forEach(x=>x.classList.toggle("active",x.id===`tab-${name}`));
  if(name==="history") loadHistory();
}

tabs.forEach(btn=>btn.addEventListener("click",()=>switchTab(btn.dataset.tab)));

function bindSourceTabs(){
  document.querySelectorAll(".source-tab").forEach(btn=>{
    btn.onclick=()=>{
      document.querySelectorAll(".source-tab").forEach(x=>x.classList.remove("active"));
      document.querySelectorAll(".source-panel").forEach(x=>x.classList.remove("active"));
      btn.classList.add("active");
      document.querySelector(`#source-${btn.dataset.source}`)?.classList.add("active");
    };
  });
}
bindSourceTabs();

function uiErrorMessage(data,status){
  const stage=String(data?.stage||"");
  const map={
    "origin-blocked":"ไม่อนุญาตให้เรียกใช้งานจากหน้านี้",
    "rate-limited":"ใช้งาน AI ถี่เกินไป กรุณารอสักครู่แล้วลองใหม่",
    "rate-limit-check-error":"ระบบตรวจสอบโควตา AI ไม่สำเร็จ กรุณาลองใหม่",
    "config-error":"การตั้งค่าระบบ AI ยังไม่พร้อม กรุณาติดต่อผู้ดูแลระบบ",
    "brief-validation-error":"ข้อมูลสำหรับสร้างโพสต์ยังไม่ครบ กรุณาตรวจสอบข้อมูลที่กรอก",
    "openai-precheck-error":"AI ไม่สามารถตรวจข้อมูลก่อนสร้างได้ กรุณาลองใหม่",
    "openai-error":"AI ไม่สามารถสร้างข้อความได้ กรุณาลองใหม่",
    "ai-parse-error":"ระบบอ่านผลลัพธ์จาก AI ไม่สำเร็จ กรุณาลองใหม่",
    "image-generation-error":"ไม่สามารถสร้างภาพได้ กรุณาลองใหม่",
    "image-upload-error":"สร้างภาพแล้ว แต่บันทึกภาพไม่สำเร็จ กรุณาลองใหม่",
    "image-db-error":"บันทึกข้อมูลภาพไม่สำเร็จ กรุณาลองใหม่",
    "image-qa-error":"ระบบตรวจคุณภาพภาพไม่สำเร็จ กรุณาลองใหม่",
    "brand-assets-error":"โหลดคลังภาพอ้างอิงไม่สำเร็จ",
    "history-query-error":"ไม่สามารถโหลดประวัติการสร้างได้",
    "history-image-query-error":"ไม่สามารถโหลดรูปจากประวัติการสร้างได้",
    "draft-complete":"ไม่สามารถเปิดฉบับร่างนี้ได้",
    "save-draft-error":"บันทึกฉบับร่างไม่สำเร็จ กรุณาลองใหม่",
    "update-draft-error":"บันทึกการแก้ไขไม่สำเร็จ กรุณาลองใหม่",
    "delete-draft-error":"ลบรายการไม่สำเร็จ กรุณาลองใหม่"
  };
  if(map[stage]) return map[stage];
  if(status===404) return "ไม่พบข้อมูลที่ต้องการ";
  if(status===429) return "ใช้งานระบบถี่เกินไป กรุณารอสักครู่แล้วลองใหม่";
  if(status>=500) return "ระบบทำงานไม่สำเร็จชั่วคราว กรุณาลองใหม่";
  return "ไม่สามารถดำเนินการได้ กรุณาตรวจสอบข้อมูลแล้วลองใหม่";
}

async function api(payload){
  const response = await fetch(endpoint(),{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(payload)
  });
  const data = await response.json().catch(()=>({}));
  if(!response.ok || data?.ok!==true){
    console.error("Content Studio API error",data);
    throw new Error(uiErrorMessage(data,response.status));
  }
  return data;
}

/* ---------- Analyze ---------- */

function filteredRows(){
  const platform=document.querySelector("#analysisPlatform")?.value||"all";
  const period=document.querySelector("#analysisPeriod")?.value||"all";
  const peer=document.querySelector("#peerFilter")?.value||"ALL";
  const cutoff=period==="all"?null:Date.now()-Number(period)*86400000;

  return socialRows.filter(r=>{
    if(platform!=="all" && r.platform!==platform) return false;
    if(cutoff){
      const t=r.published_at?new Date(r.published_at).getTime():NaN;
      if(!Number.isFinite(t)||t<cutoff) return false;
    }
    if(peer!=="ALL" && r.institution_code!=="SPU" && r.institution_code!==peer) return false;
    return true;
  });
}

function captionStats(list){
  const caps=list.map(r=>String(r.caption||"").trim()).filter(Boolean);
  const cta=/\b(apply|register|join|learn more|click|visit|explore|discover|save|contact)\b|สมัคร|ลงทะเบียน|ติดต่อ|คลิก|สแกน|เข้าร่วม/iu;
  let len=0,ctaCount=0,englishMain=0;
  caps.forEach(cap=>{
    len+=cap.length;
    if(cta.test(cap)) ctaCount++;
    const en=(cap.match(/[A-Za-z]/g)||[]).length;
    const th=(cap.match(/[\u0E00-\u0E7F]/g)||[]).length;
    if(en>th) englishMain++;
  });
  const d=Math.max(list.length,1),c=Math.max(caps.length,1);
  const fb=list.filter(r=>r.platform==="facebook").length;
  const ig=list.filter(r=>r.platform==="instagram").length;
  return {
    posts:list.length,
    interactionAvg:list.reduce((s,r)=>s+interactions(r),0)/d,
    captionAvg:len/c,
    ctaRate:ctaCount/c,
    englishRate:englishMain/c,
    fb,ig,
    strong:fb===ig?"ใกล้เคียงกัน":fb>ig?"Facebook":"Instagram"
  };
}

function postCard(r){
  const img=r.thumbnail_url||r.media_url||"";
  const date=r.published_at?new Date(r.published_at).toLocaleDateString("th-TH"):"";
  return `<article class="real-post-card">
    <div class="real-post-media">
      ${img?`<img src="${esc(img)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display='none'">`:""}
      <div class="real-post-fallback">${esc(r.platform||"")}</div>
    </div>
    <div class="real-post-body">
      <div class="real-post-meta"><b>${esc(r.institution_code||"SPU")} · ${esc(r.platform||"")}</b><span>${esc(date)}</span></div>
      <p>${esc(r.caption||"ไม่มี Caption")}</p>
      <div class="real-post-metrics"><span>♥ ${fmt(r.likes)}</span><span>💬 ${fmt(r.comments)}</span><span>↗ ${fmt(r.shares)}</span></div>
      ${r.post_url?`<a href="${esc(r.post_url)}" target="_blank" rel="noopener">ดูโพสต์ต้นฉบับ ↗</a>`:""}
    </div>
  </article>`;
}

function renderAnalyze(){
  const list=filteredRows();
  const spu=list.filter(r=>r.institution_code==="SPU");
  const s=captionStats(spu);
  document.querySelector("#spuPostCount").textContent=fmt(s.posts);
  document.querySelector("#spuPlatformMix").textContent=`FB ${s.fb} · IG ${s.ig}`;
  document.querySelector("#spuInteractionAvg").textContent=fmt(Math.round(s.interactionAvg));
  document.querySelector("#spuCaptionAvg").textContent=fmt(Math.round(s.captionAvg));
  document.querySelector("#spuStrongPlatform").textContent=s.strong;
  document.querySelector("#spuCtaRate").textContent=`${Math.round(s.ctaRate*100)}%`;
  document.querySelector("#spuEnglishRate").textContent=`${Math.round(s.englishRate*100)}%`;

  const top=[...spu].sort((a,b)=>interactions(b)-interactions(a)).slice(0,3);
  document.querySelector("#spuTopCount").textContent=`${top.length} โพสต์`;
  document.querySelector("#spuTopPosts").innerHTML=top.length?top.map(postCard).join(""):`<div class="loading-card">ไม่พบข้อมูล</div>`;
}

async function initSocial(){
  try{
    if(!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY) return;
    sb=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY);
    const {data,error}=await sb.rpc("get_social_dashboard_posts_v2");
    if(error) throw error;
    socialRows=Array.isArray(data)?data:[];
    const peers=[...new Set(socialRows.map(r=>r.institution_code).filter(x=>x&&x!=="SPU"))].sort();
    document.querySelector("#peerFilter")?.insertAdjacentHTML("beforeend",peers.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join(""));
    ["#peerFilter","#analysisPlatform","#analysisPeriod"].forEach(sel=>document.querySelector(sel)?.addEventListener("change",renderAnalyze));
    renderAnalyze();
  }catch(err){console.error(err);}
}
initSocial();

function shortList(elId,items,max=3){
  const el=document.querySelector(elId);
  if(!el)return;
  const arr=(Array.isArray(items)?items:[]).filter(Boolean).slice(0,max);
  el.innerHTML=arr.length?arr.map(x=>`<li>${esc(typeof x==="string"?x:(x.title||x.action||""))}</li>`).join(""):`<li>ข้อมูลยังไม่เพียงพอ</li>`;
}

async function runAnalyzeAI(){
  const btn=document.querySelector("#runCommunicationAI");
  const status=document.querySelector("#communicationAIStatus");
  btn.disabled=true;
  status.className="ai-analysis-status loading";
  status.textContent="AI กำลังสรุปประเด็นสำคัญ…";
  try{
    const data=await api({
      action:"analyze_communication",
      filters:{
        peer:document.querySelector("#peerFilter").value,
        platform:document.querySelector("#analysisPlatform").value,
        period:document.querySelector("#analysisPeriod").value
      }
    });
    const a=data.analysis||{};
    document.querySelector("#aiSummary").textContent=a.summary_th||"ไม่มีบทสรุป";
    shortList("#aiKeep",a.what_to_keep,3);
    shortList("#aiChange",a.what_to_change,3);
    const opp=(a.opportunities||[]).slice(0,3);
    document.querySelector("#aiOpportunities").innerHTML=opp.length?opp.map(x=>`<div class="precheck-item advice"><b>${esc(x.title||"")}</b><br>${esc(x.action||x.rationale||"")}</div>`).join(""):`<div class="precheck-item">ยังไม่มีข้อเสนอแนะ</div>`;
    document.querySelector("#communicationAIOutput").hidden=false;
    status.className="ai-analysis-status success";
    status.textContent="วิเคราะห์เรียบร้อย";
  }catch(err){
    status.className="ai-analysis-status error";
    status.textContent=`วิเคราะห์ไม่สำเร็จ: ${err.message||err}`;
  }finally{btn.disabled=false;}
}
document.querySelector("#runCommunicationAI")?.addEventListener("click",runAnalyzeAI);

/* ---------- Local file extraction ---------- */

if(window.pdfjsLib){
  window.pdfjsLib.GlobalWorkerOptions.workerSrc=
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}

document.querySelector("#chooseFileBtn")?.addEventListener("click",()=>document.querySelector("#sourceFile")?.click());

async function extractFileText(file){
  const ext=file.name.split(".").pop().toLowerCase();
  const arrayBuffer=await file.arrayBuffer();

  if(["txt","csv","json"].includes(ext)){
    return await file.text();
  }

  if(["xlsx","xls"].includes(ext)){
    if(!window.XLSX) throw new Error("ไม่สามารถเปิดตัวอ่านไฟล์ Excel ได้");
    const wb=window.XLSX.read(arrayBuffer,{type:"array"});
    return wb.SheetNames.map(name=>{
      const ws=wb.Sheets[name];
      return `### ${name}\n${window.XLSX.utils.sheet_to_csv(ws)}`;
    }).join("\n\n");
  }

  if(ext==="docx"){
    if(!window.mammoth) throw new Error("ไม่สามารถเปิดตัวอ่านไฟล์ Word ได้");
    const result=await window.mammoth.extractRawText({arrayBuffer});
    return result.value||"";
  }

  if(ext==="pdf"){
    if(!window.pdfjsLib) throw new Error("ไม่สามารถเปิดตัวอ่านไฟล์ PDF ได้");
    const pdf=await window.pdfjsLib.getDocument({data:arrayBuffer}).promise;
    const pages=[];
    for(let i=1;i<=pdf.numPages;i++){
      const page=await pdf.getPage(i);
      const content=await page.getTextContent();
      pages.push(content.items.map(x=>x.str).join(" "));
    }
    return pages.join("\n\n");
  }

  throw new Error("รองรับ PDF, DOCX, XLSX, CSV, TXT และ JSON");
}

document.querySelector("#sourceFile")?.addEventListener("change",async e=>{
  const file=e.target.files?.[0];
  if(!file)return;
  const status=document.querySelector("#fileStatus");
  status.textContent=`กำลังอ่าน ${file.name}…`;
  try{
    let text=await extractFileText(file);
    if(text.length>45000){
      text=text.slice(0,45000);
      status.textContent=`อ่านสำเร็จ (ใช้ 45,000 ตัวอักษรแรกจาก ${file.name})`;
    }else{
      status.textContent=`อ่านสำเร็จ: ${file.name}`;
    }
    document.querySelector("#pastedData").value=text;
  }catch(err){
    status.textContent=`อ่านไฟล์ไม่สำเร็จ: ${err.message||err}`;
  }
});

/* ---------- Create v13 / templates / precheck ---------- */

const PRESETS = window.SPU_CONTENT_PRESET_MAP || {};
const BRAND = window.SPU_CONTENT_BRAND || {};
const VARIANT_LABELS = Object.fromEntries((BRAND.variants||[]).map(x=>[x.key,x.label]));

function selectedPreset(){
  return PRESETS[currentTemplateKey] || PRESETS.custom || {
    key:"custom",label:"กำหนดเอง",contentType:"Custom",fields:[],referenceCategory:"general"
  };
}

function renderTemplateGrid(){
  const grid=document.querySelector("#templateGrid");
  if(!grid)return;
  const list=(window.SPU_CONTENT_PRESETS||[]).filter(x=>x.key!=="custom");
  grid.innerHTML=list.map(p=>`
    <button type="button" class="template-option ${p.key===currentTemplateKey?"active":""}" data-template="${esc(p.key)}">
      <span class="check">✓</span>
      <span class="t-ico">${esc(p.icon||"✦")}</span>
      <b>${esc(p.label)}</b>
      <small>${esc(p.summary||"")}</small>
    </button>`).join("");
  grid.querySelectorAll("[data-template]").forEach(btn=>{
    btn.addEventListener("click",()=>selectTemplate(btn.dataset.template));
  });
}

function renderTemplateFields(){
  const p=selectedPreset();
  const host=document.querySelector("#templateFields");
  if(!host)return;
  host.innerHTML=(p.fields||[]).map(f=>`
    <label class="template-field">
      <span>${esc(f.label)} ${f.required?'<b style="color:#d20b71">*</b>':""}</span>
      ${f.type==="textarea"
        ? `<textarea data-template-field="${esc(f.id)}" placeholder="${esc(f.placeholder||"")}" rows="3"></textarea>`
        : `<input data-template-field="${esc(f.id)}" placeholder="${esc(f.placeholder||"")}">`}
    </label>`).join("");
  const summary=document.querySelector("#templateSummary");
  if(summary)summary.textContent=p.summary||"กรอกข้อมูลสำคัญเท่าที่มี";
  if(p.defaultAudience){
    const a=document.querySelector("#audience");
    if(a && [...a.options].some(x=>x.value===p.defaultAudience))a.value=p.defaultAudience;
  }
}

function selectTemplate(key){
  currentTemplateKey=PRESETS[key]?key:"custom";
  renderTemplateGrid();
  renderTemplateFields();
}

function setCreateMode(mode){
  currentCreateMode=mode==="custom"?"custom":"quick";
  document.querySelectorAll(".create-mode").forEach(x=>x.classList.toggle("active",x.dataset.createMode===currentCreateMode));
  const shell=document.querySelector("#templateShell");
  if(shell)shell.hidden=currentCreateMode==="custom";
  if(currentCreateMode==="custom"){
    currentTemplateKey="custom";
    renderTemplateFields();
  }else if(currentTemplateKey==="custom"){
    currentTemplateKey="career";
    renderTemplateGrid();
    renderTemplateFields();
  }
}

document.querySelectorAll(".create-mode").forEach(btn=>btn.addEventListener("click",()=>setCreateMode(btn.dataset.createMode)));

function templateFieldValues(){
  const p=selectedPreset();
  const out={};
  document.querySelectorAll("[data-template-field]").forEach(el=>{
    const v=el.value.trim();
    if(v)out[el.dataset.templateField]=v;
  });
  return {preset:p,values:out};
}

function composeTemplateFacts(preset,values){
  const lines=[];
  for(const f of preset.fields||[]){
    const v=values[f.id];
    if(v)lines.push(`${f.label}: ${v}`);
  }
  return lines.join("\n");
}

function clarificationPayload(){
  return [...document.querySelectorAll(".precheck-answer")]
    .map((input,i)=>({
      question:lastPrecheck?.questions?.[i]||"",
      answer:input.value.trim()
    }))
    .filter(x=>x.answer);
}

function baseBrief(){
  const facts=document.querySelector("#facts")?.value.trim()||"";
  const pasted=document.querySelector("#pastedData")?.value.trim()||"";
  const {preset,values}=templateFieldValues();
  const structured=composeTemplateFacts(preset,values);
  const verified=[structured,facts].filter(Boolean).join("\n\n");

  return {
    template_key:preset.key||"custom",
    template_fields:values,
    content_type:preset.contentType||"Custom",
    topic:document.querySelector("#topic")?.value.trim()||"",
    objective:"",
    key_message:"",
    verified_facts:verified,
    pasted_data:pasted,
    locked_facts:structured,
    clarifications:clarificationPayload(),
    audience:document.querySelector("#audience")?.value||"",
    market:"Global / General",
    platform:document.querySelector("#platform")?.value||"",
    language:document.querySelector("#language")?.value||"English",
    tone:document.querySelector("#tone")?.value||"ให้ AI แนะนำ",
    cta:document.querySelector("#ctaInput")?.value.trim()||values.cta||"",
    creative_direction:"",
    visual_mode:"auto",
    visual_direction:"",
    reference_category:preset.referenceCategory||"general",
    brand_asset_id:document.querySelector("#brandAssetSelect")?.value||""
  };
}

function validateRequiredTemplateFields(){
  const p=selectedPreset();
  const {values}=templateFieldValues();
  const missing=(p.fields||[]).filter(f=>f.required && !values[f.id]).map(f=>f.label);
  return missing;
}

function renderPrecheck(data){
  const questions=(data?.questions||data?.precheck?.questions||[]).slice(0,3);
  lastPrecheck={questions};

  document.querySelector("#precheckQuestions").innerHTML=questions.map((x,i)=>`
    <div class="precheck-item question">
      <b>${i+1}. ${esc(x)}</b>
      <input class="precheck-answer" placeholder="ตอบเฉพาะข้อมูลที่ยืนยันได้">
    </div>`).join("");

  document.querySelector("#precheckAdvice").innerHTML=
    `<div class="precheck-item advice">ระบบจะสร้างต่อเมื่อข้อมูลสำคัญครบ เพื่อไม่ให้ AI เดาข้อเท็จจริง</div>`;

  document.querySelector("#precheckCard").hidden=false;
}

async function precheck(){
  const missing=validateRequiredTemplateFields();
  const b=baseBrief();

  if(!b.topic){notify("กรุณาระบุหัวข้อโพสต์","error");return;}
  if(missing.length){
    notify(`กรุณากรอกข้อมูลสำคัญ: ${missing.slice(0,2).join(", ")}`,"error");
    return;
  }

  await generatePost(false);
}
document.querySelector("#precheckContent")?.addEventListener("click",precheck);
document.querySelector("#editInputBtn")?.addEventListener("click",()=>document.querySelector("#topic")?.focus());

/* ---------- Create v13 / generation / image variants ---------- */

function setPreviewLoading(text){
  document.querySelector("#previewStatus").textContent=text;
}



function renderDraft(data){
  const g=data?.generation||{};
  currentDraftId=data?.draft_id||currentDraftId;
  currentDraft={
    ...(currentDraft||{}),
    id:currentDraftId,
    topic:data?.brief?.topic||baseBrief().topic,
    input_payload:data?.brief||baseBrief(),
    pr_strategy:g.pr_strategy||{},
    poster_copy:g.poster_copy||{},
    art_direction:g.art_direction||{},
    generation:g
  };

  document.querySelector("#mockHook").textContent=g.hook||g.poster_copy?.title||"—";
  document.querySelector("#mockCaption").textContent=g.caption||"—";
  document.querySelector("#mockHashtags").textContent=Array.isArray(g.hashtags)?g.hashtags.join(" "):"—";
  document.querySelector("#whyText").textContent=g.why_this_direction_th||g.pr_strategy?.single_minded_message||"—";
  setPreviewLoading("กำลังสร้างภาพ 1 ภาพ…");
}

function renderImage(url,mode){
  currentImageUrl=url||null;
  currentImageMode=mode||"poster";
  const visual=document.querySelector("#postPreviewVisual");
  visual.classList.remove("poster-mode");

  if(!url){
    visual.innerHTML=`<div class="preview-placeholder"><div>SPUIC</div><strong>ยังไม่มีภาพ</strong><span>กด “สร้างภาพใหม่ 1 ภาพ” เมื่อต้องการลองใหม่</span></div>`;
    setPreviewLoading("ข้อความพร้อมใช้");
    return;
  }

  visual.innerHTML=`<img src="${esc(url)}" alt="AI generated SPUIC social poster">`;
  setPreviewLoading("พร้อมใช้งาน");
  notify("สร้างภาพ 1 ภาพเรียบร้อย","success");
}

async function generateOneImage(){
  if(!currentDraftId){notify("ยังไม่มีฉบับร่างสำหรับสร้างภาพ","error");return;}
  const btn=document.querySelector("#changeImageBtn");
  const done=markButton(btn,"busy","กำลังสร้างภาพ 1 ภาพ…");
  setPreviewLoading("กำลังสร้างภาพ 1 ภาพ…");

  try{
    const data=await api({
      action:"generate_image",
      draft_id:currentDraftId
    });
    renderImage(data?.image?.signed_url,data?.image?.generation_mode||"poster");
    done("done","สร้างภาพเรียบร้อย");
  }catch(err){
    setPreviewLoading("สร้างภาพไม่สำเร็จ");
    done("error",`สร้างภาพไม่สำเร็จ: ${err.message||err}`);
  }
}

/* ---------- Brand assets ---------- */

async function loadBrandAssets(){
  const sel=document.querySelector("#brandAssetSelect");
  if(!sel)return;
  try{
    const data=await api({action:"list_brand_assets"});
    brandAssets=data.items||[];
    sel.innerHTML=`<option value="">ให้ระบบเลือกอัตโนมัติ</option>`+
      brandAssets.map(x=>`<option value="${esc(x.id)}">${esc(x.title||x.asset_type||"Reference")}</option>`).join("");
  }catch(_){
    sel.innerHTML=`<option value="">ให้ระบบเลือกอัตโนมัติ</option>`;
  }
}

/* ---------- Quick edit ---------- */



/* ---------- Initialize Create v13 ---------- */

renderTemplateGrid();
renderTemplateFields();
setCreateMode("quick");
loadBrandAssets();


/* ---------- Edit / save / copy ---------- */

document.querySelector("#editTextBtn")?.addEventListener("click",()=>{
  const g=currentDraft?.generation||{};
  document.querySelector("#editHeadline").value=g.hook||"";
  document.querySelector("#editCaption").value=g.caption||"";
  document.querySelector("#editHashtags").value=Array.isArray(g.hashtags)?g.hashtags.join(" "):"";
  document.querySelector("#editPanel").hidden=false;
  notify("เปิดโหมดแก้ไขข้อความแล้ว","info");
});

document.querySelector("#cancelEditBtn")?.addEventListener("click",()=>{
  document.querySelector("#editPanel").hidden=true;
});

document.querySelector("#saveEditBtn")?.addEventListener("click",async()=>{
  if(!currentDraftId){alert("ยังไม่มีฉบับร่างที่แก้ไขได้");return;}
  const headline=document.querySelector("#editHeadline").value.trim();
  const caption=document.querySelector("#editCaption").value.trim();
  const hashtags=document.querySelector("#editHashtags").value.split(/\s+/).filter(Boolean);

  try{
    const data=await api({
      action:"update_draft",
      draft_id:currentDraftId,
      headline,caption,hashtags
    });
    currentDraft.generation=data.generation;
    document.querySelector("#mockHook").textContent=headline||"—";
    document.querySelector("#mockCaption").textContent=caption||"—";
    document.querySelector("#mockHashtags").textContent=hashtags.join(" ")||"—";
    document.querySelector("#editPanel").hidden=true;
  }catch(err){alert(`บันทึกข้อความไม่สำเร็จ: ${err.message||err}`);}
});

document.querySelector("#saveDraftBtn")?.addEventListener("click",async()=>{
  const btn=document.querySelector("#saveDraftBtn");
  if(!currentDraftId){notify("ยังไม่มีโพสต์ให้บันทึก","error");return;}
  const done=markButton(btn,"busy","กำลังบันทึก…");
  try{
    await api({action:"save_draft",draft_id:currentDraftId});
    setPreviewLoading("บันทึกฉบับร่างแล้ว");
    await loadHistory();
    done("done","บันทึกฉบับร่างแล้ว");
  }catch(err){done("error",`บันทึกฉบับร่างไม่สำเร็จ: ${err.message||err}`);}
});

document.querySelector("#copyCaptionBtn")?.addEventListener("click",async()=>{
  const btn=document.querySelector("#copyCaptionBtn");
  const g=currentDraft?.generation||{};
  const text=[g.caption,(g.hashtags||[]).join(" ")].filter(Boolean).join("\n\n");
  if(!text){notify("ยังไม่มีข้อความโพสต์","error");return;}
  const done=markButton(btn,"busy","กำลังคัดลอก…");
  try{
    await navigator.clipboard.writeText(text);
    setPreviewLoading("คัดลอกข้อความแล้ว");
    done("done","คัดลอกข้อความแล้ว");
  }catch(err){done("error","คัดลอกไม่สำเร็จ");}
});

/* ---------- Download composed image ---------- */

function wrapText(ctx,text,maxWidth){
  const words=String(text).split(/\s+/);
  const lines=[];
  let line="";
  for(const word of words){
    const test=line?`${line} ${word}`:word;
    if(ctx.measureText(test).width>maxWidth && line){
      lines.push(line);line=word;
    }else line=test;
  }
  if(line)lines.push(line);
  return lines;
}

async function downloadCompositeImage(){
  if(!currentImageUrl){notify("ยังไม่มีภาพให้ดาวน์โหลด","error");return;}
  try{
    const res=await fetch(currentImageUrl);
    if(!res.ok)throw new Error("โหลดไฟล์ภาพไม่สำเร็จ");
    const blob=await res.blob();
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;
    a.download=`SPUIC-${(currentDraft?.topic||"post").replace(/[^\w\-]+/g,"-").slice(0,50)}-poster.png`;
    a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    notify("ดาวน์โหลดภาพแล้ว","success");
  }catch(err){
    notify(`ดาวน์โหลดภาพไม่สำเร็จ: ${err.message||err}`,"error");
  }
}
document.querySelector("#downloadImageBtn")?.addEventListener("click",downloadCompositeImage);

/* ---------- History ---------- */

function bytesLabel(bytes){
  const n=Number(bytes||0);
  if(n<1024*1024)return `${(n/1024).toFixed(1)} KB`;
  return `${(n/1024/1024).toFixed(1)} MB`;
}

function historyStatusLabel(value){
  const map={
    generated:"สร้างแล้ว",
    draft:"ฉบับร่าง",
    final:"พร้อมเผยแพร่"
  };
  return map[value]||"สร้างแล้ว";
}

function historyCard(item){
  const g=item.generation||{};
  const img=item.latest_image?.signed_url||"";
  const date=item.created_at?new Date(item.created_at).toLocaleString("th-TH"):"";
  return `<article class="history-card" data-id="${esc(item.id)}">
    <div class="history-thumb">
      ${img?`<img src="${esc(img)}" alt="">`:`ไม่มีรูป`}
    </div>
    <div class="history-card-body">
      <span class="status-chip">${esc(historyStatusLabel(item.status))}</span>
      <h3>${esc(item.topic||"ไม่มีชื่อเรื่อง")}</h3>
      <div class="history-meta">${esc(date)} · ${esc(item.platform||"")} · ${esc(item.language||"")}</div>
      <div class="history-caption">${esc(g.caption||"")}</div>
      <div class="history-actions">
        <button data-action="open">เปิดดู</button>
        <button data-action="reuse">ใช้เป็นต้นแบบ</button>
        <button data-action="delete" class="danger">ลบ</button>
      </div>
    </div>
  </article>`;
}

let historyItems=[];

function renderHistory(){
  const q=(document.querySelector("#historySearch")?.value||"").trim().toLowerCase();
  const status=document.querySelector("#historyStatus")?.value||"";
  const filtered=historyItems.filter(x=>{
    if(status && x.status!==status)return false;
    if(q && !String(x.topic||"").toLowerCase().includes(q))return false;
    return true;
  });
  document.querySelector("#historyGrid").innerHTML=filtered.length?filtered.map(historyCard).join(""):`<div class="loading-card">ไม่พบรายการ</div>`;
}

async function loadHistory(){
  try{
    const data=await api({action:"list_history",limit:100});
    historyItems=data.items||[];
    document.querySelector("#historyDraftCount").textContent=fmt(data.usage?.drafts||0);
    document.querySelector("#historyImageCount").textContent=fmt(data.usage?.images||0);
    document.querySelector("#historyStorage").textContent=bytesLabel(data.usage?.bytes||0);
    renderHistory();
  }catch(err){
    document.querySelector("#historyGrid").innerHTML=`<div class="loading-card">โหลดประวัติไม่สำเร็จ: ${esc(err.message||err)}</div>`;
  }
}

document.querySelector("#refreshHistoryBtn")?.addEventListener("click",loadHistory);
document.querySelector("#historySearch")?.addEventListener("input",renderHistory);
document.querySelector("#historyStatus")?.addEventListener("change",renderHistory);

document.querySelector("#historyGrid")?.addEventListener("click",async e=>{
  const btn=e.target.closest("button[data-action]");
  if(!btn)return;
  const card=btn.closest(".history-card");
  const id=card?.dataset.id;
  if(!id)return;

  const item=historyItems.find(x=>x.id===id);
  const action=btn.dataset.action;

  if(action==="delete"){
    if(!confirm(`ลบ "${item?.topic||"รายการนี้"}" พร้อมรูปทั้งหมดหรือไม่?`))return;
    try{
      await api({action:"delete_draft",draft_id:id});
      await loadHistory();
    }catch(err){alert(`ลบไม่สำเร็จ: ${err.message||err}`);}
    return;
  }

  if(action==="reuse"){
    const b=item?.input_payload||{};
    document.querySelector("#topic").value=item?.topic||b.topic||"";
    document.querySelector("#facts").value=b.verified_facts||item?.source_text||"";
    document.querySelector("#pastedData").value=b.pasted_data||"";
    if(b.template_key && PRESETS[b.template_key]){currentTemplateKey=b.template_key;renderTemplateGrid();renderTemplateFields();}
    if(item?.audience)document.querySelector("#audience").value=item.audience;
    if(item?.language)document.querySelector("#language").value=item.language;
    if(item?.platform)document.querySelector("#platform").value=item.platform;
    if(item?.tone)document.querySelector("#tone").value=item.tone;
    switchTab("create");
    return;
  }

  if(action==="open"){
    try{
      const data=await api({action:"get_draft",draft_id:id});
      currentDraft=data.draft;
      currentDraftId=id;
      document.querySelector("#mockHook").textContent=currentDraft.generation?.hook||"—";
      document.querySelector("#mockCaption").textContent=currentDraft.generation?.caption||"—";
      document.querySelector("#mockHashtags").textContent=(currentDraft.generation?.hashtags||[]).join(" ")||"—";
      document.querySelector("#whyText").textContent=currentDraft.generation?.why_this_direction_th||"—";
      
      renderImage(
        currentDraft.latest_image?.signed_url,
        currentDraft.latest_image?.generation_mode||"poster"
      );
      switchTab("create");
    }catch(err){alert(`เปิดฉบับร่างไม่สำเร็จ: ${err.message||err}`);}
  }
});

function inferLocalMode(b){
  const text=[b?.topic,b?.verified_facts,b?.pasted_data].join(" ").toLowerCase();
  return /(calendar|deadline|tuition|fee|scholarship|schedule|exam|registration|orientation|ปฏิทิน|กำหนด|ค่าเทอม|ทุน|สอบ|ลงทะเบียน)/i.test(text)?"verified":"concept";
}

loadHistory();
