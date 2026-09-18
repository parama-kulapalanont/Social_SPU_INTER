
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

const fmt = n => new Intl.NumberFormat("en-US").format(Number(n||0));
const esc = s => String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const interactions = r => Number(r.likes||0)+Number(r.comments||0)+Number(r.shares||0);

function switchTab(name){
  tabs.forEach(x=>x.classList.toggle("active",x.dataset.tab===name));
  panels.forEach(x=>x.classList.toggle("active",x.id===`tab-${name}`));
  if(name==="history") loadHistory();
}

tabs.forEach(btn=>btn.addEventListener("click",()=>switchTab(btn.dataset.tab)));

document.querySelectorAll(".source-tab").forEach(btn=>{
  btn.addEventListener("click",()=>{
    document.querySelectorAll(".source-tab").forEach(x=>x.classList.remove("active"));
    document.querySelectorAll(".source-panel").forEach(x=>x.classList.remove("active"));
    btn.classList.add("active");
    document.querySelector(`#source-${btn.dataset.source}`)?.classList.add("active");
  });
});

async function api(payload){
  const response = await fetch(endpoint(),{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(payload)
  });
  const data = await response.json().catch(()=>({}));
  if(!response.ok || data?.ok!==true){
    throw new Error(data?.error || `HTTP ${response.status}`);
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
    if(!window.XLSX) throw new Error("XLSX parser not loaded");
    const wb=window.XLSX.read(arrayBuffer,{type:"array"});
    return wb.SheetNames.map(name=>{
      const ws=wb.Sheets[name];
      return `### ${name}\n${window.XLSX.utils.sheet_to_csv(ws)}`;
    }).join("\n\n");
  }

  if(ext==="docx"){
    if(!window.mammoth) throw new Error("Word parser not loaded");
    const result=await window.mammoth.extractRawText({arrayBuffer});
    return result.value||"";
  }

  if(ext==="pdf"){
    if(!window.pdfjsLib) throw new Error("PDF parser not loaded");
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

/* ---------- Create / precheck ---------- */

function baseBrief(){
  const facts=document.querySelector("#facts")?.value.trim()||"";
  const pasted=document.querySelector("#pastedData")?.value.trim()||"";

  const answers=[...document.querySelectorAll(".precheck-answer")]
    .map((input,i)=>input.value.trim()?`คำตอบเพิ่มเติม ${i+1}: ${input.value.trim()}`:"")
    .filter(Boolean)
    .join("\n");

  const mergedPasted=[pasted,answers].filter(Boolean).join("\n\n");

  return {
    content_type:"Custom",
    topic:document.querySelector("#topic")?.value.trim()||"",
    objective:"",
    key_message:"",
    verified_facts:facts,
    pasted_data:mergedPasted,
    locked_facts:"",
    audience:document.querySelector("#audience")?.value||"",
    market:"Global / General",
    platform:document.querySelector("#platform")?.value||"",
    language:document.querySelector("#language")?.value||"English",
    tone:document.querySelector("#tone")?.value||"ให้ AI แนะนำ",
    cta:"",
    creative_direction:"",
    visual_mode:"verified",
    visual_direction:""
  };
}

function renderPrecheck(data){
  lastPrecheck=data?.precheck||{};
  const qs=(lastPrecheck.questions||[]).slice(0,3);
  const advice=(lastPrecheck.advice||[]).slice(0,3);

  document.querySelector("#precheckQuestions").innerHTML=qs.map((x,i)=>`
    <div class="precheck-item question">
      <b>${i+1}. ${esc(x)}</b>
      <input class="precheck-answer" placeholder="ตอบสั้น ๆ (ถ้ามี)">
    </div>`).join("");

  document.querySelector("#precheckAdvice").innerHTML=advice.map(x=>`<div class="precheck-item advice">✓ ${esc(x)}</div>`).join("");
  document.querySelector("#precheckCard").hidden=false;
}

async function precheck(){
  const b=baseBrief();
  if(!b.topic){alert("กรุณาระบุเรื่องที่ต้องการสื่อสาร");return;}
  const btn=document.querySelector("#precheckContent");
  btn.disabled=true;const old=btn.textContent;btn.textContent="AI กำลังตรวจข้อมูล…";
  try{
    const data=await api({action:"precheck_content",brief:b});
    renderPrecheck(data);
    if((data?.precheck?.questions||[]).length===0){
      await generatePost(false);
    }else{
      document.querySelector("#precheckCard").scrollIntoView({behavior:"smooth",block:"center"});
    }
  }catch(err){alert(`AI ตรวจข้อมูลไม่สำเร็จ: ${err.message||err}`);}
  finally{btn.disabled=false;btn.textContent=old;}
}
document.querySelector("#precheckContent")?.addEventListener("click",precheck);

document.querySelector("#editInputBtn")?.addEventListener("click",()=>document.querySelector("#topic")?.focus());

/* ---------- Generation / image ---------- */

function setPreviewLoading(text){
  document.querySelector("#previewStatus").textContent=text;
}

function renderDraft(data){
  const g=data?.generation||{};
  currentDraftId=data?.draft_id||currentDraftId;
  currentDraft={
    ...(currentDraft||{}),
    id:currentDraftId,
    input_payload:data?.brief||baseBrief(),
    generation:g
  };

  document.querySelector("#mockHook").textContent=g.hook||"—";
  document.querySelector("#mockCaption").textContent=g.caption||"—";
  document.querySelector("#mockHashtags").textContent=Array.isArray(g.hashtags)?g.hashtags.join(" "):"—";
  document.querySelector("#whyText").textContent=g.why_this_direction_th||"—";
  setPreviewLoading("กำลังสร้างภาพ…");
}

function verifiedFactLines(){
  const b=currentDraft?.input_payload||baseBrief();
  const text=[b.verified_facts,b.pasted_data].filter(Boolean).join("\n");
  return text.split(/\n+/).map(x=>x.replace(/^[•\-\s]+/,"").trim()).filter(Boolean).slice(0,6);
}

function renderImage(url,mode){
  currentImageUrl=url||null;
  currentImageMode=mode||"concept";
  const visual=document.querySelector("#postPreviewVisual");

  if(!url){
    visual.innerHTML=`<div class="preview-placeholder"><div>SPUIC</div><strong>ยังไม่มีภาพ</strong><span>สามารถกด “เปลี่ยนภาพ” เพื่อลองใหม่</span></div>`;
    setPreviewLoading("ข้อความพร้อมใช้");
    return;
  }

  const hook=currentDraft?.generation?.hook||"";
  const facts=verifiedFactLines();

  if(mode==="verified"){
    visual.innerHTML=`
      <img src="${esc(url)}" alt="Generated visual">
      <div class="verified-overlay">
        <h3>${esc(hook||currentDraft?.topic||"SPUIC")}</h3>
        <div class="verified-facts">
          ${facts.map(x=>`<div class="verified-fact">${esc(x)}</div>`).join("")}
        </div>
      </div>`;
  }else{
    visual.innerHTML=`<img src="${esc(url)}" alt="Generated visual">`;
  }

  setPreviewLoading("พร้อมใช้งาน");
}

async function generateImage(){
  if(!currentDraftId) return;
  setPreviewLoading("กำลังสร้างภาพ…");
  try{
    const data=await api({action:"generate_image",draft_id:currentDraftId});
    renderImage(data?.image?.signed_url,data?.image?.generation_mode);
  }catch(err){
    renderImage(null,null);
    alert(`สร้างภาพไม่สำเร็จ: ${err.message||err}`);
  }
}

async function generatePost(isRegenerate=false){
  const btn=document.querySelector("#generateMock");
  if(btn){btn.disabled=true;btn.textContent="กำลังสร้าง…";}
  setPreviewLoading("กำลังสร้างข้อความ…");

  try{
    const data=await api({
      action:"generate_content",
      brief:baseBrief(),
      precheck:lastPrecheck||{}
    });
    renderDraft(data);
    await generateImage();
  }catch(err){
    setPreviewLoading("สร้างไม่สำเร็จ");
    alert(`สร้างโพสต์ไม่สำเร็จ: ${err.message||err}`);
  }finally{
    if(btn){btn.disabled=false;btn.textContent="สร้างตามคำแนะนำ";}
  }
}
document.querySelector("#generateMock")?.addEventListener("click",()=>generatePost(false));
document.querySelector("#regenerateBtn")?.addEventListener("click",()=>generatePost(true));
document.querySelector("#changeImageBtn")?.addEventListener("click",generateImage);

/* ---------- Edit / save / copy ---------- */

document.querySelector("#editTextBtn")?.addEventListener("click",()=>{
  const g=currentDraft?.generation||{};
  document.querySelector("#editHeadline").value=g.hook||"";
  document.querySelector("#editCaption").value=g.caption||"";
  document.querySelector("#editHashtags").value=Array.isArray(g.hashtags)?g.hashtags.join(" "):"";
  document.querySelector("#editPanel").hidden=false;
});

document.querySelector("#cancelEditBtn")?.addEventListener("click",()=>{
  document.querySelector("#editPanel").hidden=true;
});

document.querySelector("#saveEditBtn")?.addEventListener("click",async()=>{
  if(!currentDraftId){alert("ยังไม่มี Draft ที่แก้ไขได้");return;}
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
  if(!currentDraftId){alert("ยังไม่มีโพสต์ให้บันทึก");return;}
  try{
    await api({action:"save_draft",draft_id:currentDraftId});
    setPreviewLoading("บันทึก Draft แล้ว");
    await loadHistory();
  }catch(err){alert(`บันทึก Draft ไม่สำเร็จ: ${err.message||err}`);}
});

document.querySelector("#copyCaptionBtn")?.addEventListener("click",async()=>{
  const g=currentDraft?.generation||{};
  const text=[g.caption,(g.hashtags||[]).join(" ")].filter(Boolean).join("\n\n");
  if(!text){alert("ยังไม่มี Caption");return;}
  await navigator.clipboard.writeText(text);
  setPreviewLoading("คัดลอก Caption แล้ว");
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
  if(!currentImageUrl){alert("ยังไม่มีภาพให้ดาวน์โหลด");return;}

  try{
    const res=await fetch(currentImageUrl);
    const blob=await res.blob();
    const bitmap=await createImageBitmap(blob);
    const canvas=document.createElement("canvas");
    canvas.width=1080;canvas.height=1350;
    const ctx=canvas.getContext("2d");

    const scale=Math.max(canvas.width/bitmap.width,canvas.height/bitmap.height);
    const w=bitmap.width*scale,h=bitmap.height*scale;
    ctx.drawImage(bitmap,(canvas.width-w)/2,(canvas.height-h)/2,w,h);

    if(currentImageMode==="verified"){
      ctx.fillStyle="rgba(255,255,255,.93)";
      ctx.fillRect(55,620,970,675);

      ctx.fillStyle="#c20d6b";
      ctx.font="700 48px Arial";
      let y=700;
      const headline=currentDraft?.generation?.hook||currentDraft?.topic||"SPUIC";
      for(const line of wrapText(ctx,headline,880).slice(0,3)){
        ctx.fillText(line,95,y);y+=58;
      }

      ctx.font="600 28px Arial";
      ctx.fillStyle="#1f2937";
      y+=12;
      for(const fact of verifiedFactLines()){
        const lines=wrapText(ctx,fact,860).slice(0,2);
        ctx.fillStyle="rgba(248,250,252,.98)";
        ctx.fillRect(85,y-32,900,lines.length*38+28);
        ctx.fillStyle="#1f2937";
        let ly=y;
        for(const line of lines){ctx.fillText(line,105,ly);ly+=38;}
        y=ly+18;
        if(y>1260)break;
      }
    }

    canvas.toBlob(blob=>{
      const url=URL.createObjectURL(blob);
      const a=document.createElement("a");
      a.href=url;
      a.download=`SPUIC-${(currentDraft?.topic||"post").replace(/[^\w\-]+/g,"-").slice(0,50)}.png`;
      a.click();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    },"image/png");
  }catch(err){
    alert(`ดาวน์โหลดภาพไม่สำเร็จ: ${err.message||err}`);
  }
}
document.querySelector("#downloadImageBtn")?.addEventListener("click",downloadCompositeImage);

/* ---------- History ---------- */

function bytesLabel(bytes){
  const n=Number(bytes||0);
  if(n<1024*1024)return `${(n/1024).toFixed(1)} KB`;
  return `${(n/1024/1024).toFixed(1)} MB`;
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
      <span class="status-chip">${esc(item.status||"generated")}</span>
      <h3>${esc(item.topic||"Untitled")}</h3>
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
      renderImage(currentDraft.latest_image?.signed_url,currentDraft.latest_image?.generation_mode||inferLocalMode(currentDraft.input_payload));
      switchTab("create");
    }catch(err){alert(`เปิด Draft ไม่สำเร็จ: ${err.message||err}`);}
  }
});

function inferLocalMode(b){
  const text=[b?.topic,b?.verified_facts,b?.pasted_data].join(" ").toLowerCase();
  return /(calendar|deadline|tuition|fee|scholarship|schedule|exam|registration|orientation|ปฏิทิน|กำหนด|ค่าเทอม|ทุน|สอบ|ลงทะเบียน)/i.test(text)?"verified":"concept";
}

loadHistory();
