
const tabs = document.querySelectorAll(".studio-tab");
const panels = document.querySelectorAll(".studio-panel");

tabs.forEach(btn=>{
  btn.addEventListener("click",()=>{
    tabs.forEach(x=>x.classList.remove("active"));
    panels.forEach(x=>x.classList.remove("active"));
    btn.classList.add("active");
    document.querySelector(`#tab-${btn.dataset.tab}`)?.classList.add("active");
  });
});

document.querySelectorAll(".source-tab").forEach(btn=>{
  btn.addEventListener("click",()=>{
    document.querySelectorAll(".source-tab").forEach(x=>x.classList.remove("active"));
    document.querySelectorAll(".source-panel").forEach(x=>x.classList.remove("active"));
    btn.classList.add("active");
    document.querySelector(`#source-${btn.dataset.source}`)?.classList.add("active");
  });
});

const cfg = window.SPU_SOCIAL_CONFIG || {};
let sb = null;
let rows = [];
let lastGeneration = null;

const fmt = n => new Intl.NumberFormat("en-US").format(Number(n||0));
const esc = s => String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const interactions = r => Number(r.likes||0)+Number(r.comments||0)+Number(r.shares||0);

function filteredRows(){
  const platform = document.querySelector("#analysisPlatform")?.value || "all";
  const period = document.querySelector("#analysisPeriod")?.value || "all";
  const peer = document.querySelector("#peerFilter")?.value || "ALL";
  const cutoff = period==="all" ? null : Date.now()-Number(period)*86400000;

  return rows.filter(r=>{
    if(platform!=="all" && r.platform!==platform) return false;
    if(cutoff){
      const t = r.published_at ? new Date(r.published_at).getTime() : NaN;
      if(!Number.isFinite(t) || t<cutoff) return false;
    }
    if(peer!=="ALL" && r.institution_code!=="SPU" && r.institution_code!==peer) return false;
    return true;
  });
}

function captionStats(list){
  const caps=list.map(r=>String(r.caption||"").trim()).filter(Boolean);
  const cta=/\b(apply|register|join|learn more|click|visit|explore|discover|save|contact)\b|สมัคร|ลงทะเบียน|ติดต่อ|คลิก|สแกน|เข้าร่วม/iu;
  let len=0, ctaCount=0, englishMain=0;
  caps.forEach(cap=>{
    len += cap.length;
    if(cta.test(cap)) ctaCount++;
    const en=(cap.match(/[A-Za-z]/g)||[]).length;
    const th=(cap.match(/[\u0E00-\u0E7F]/g)||[]).length;
    if(en>th) englishMain++;
  });
  const d=Math.max(list.length,1), c=Math.max(caps.length,1);
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

function card(r){
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
  document.querySelector("#spuTopPosts").innerHTML=top.length?top.map(card).join(""):`<div class="loading-card">ไม่พบข้อมูล</div>`;
}

async function initData(){
  try{
    if(!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY) return;
    sb=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY);
    const {data,error}=await sb.rpc("get_social_dashboard_posts_v2");
    if(error) throw error;
    rows=Array.isArray(data)?data:[];
    const peers=[...new Set(rows.map(r=>r.institution_code).filter(x=>x&&x!=="SPU"))].sort();
    document.querySelector("#peerFilter")?.insertAdjacentHTML("beforeend",peers.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join(""));
    ["#peerFilter","#analysisPlatform","#analysisPeriod"].forEach(sel=>document.querySelector(sel)?.addEventListener("change",renderAnalyze));
    renderAnalyze();
  }catch(err){
    console.error(err);
  }
}
initData();

const endpoint=()=>`${String(cfg.SUPABASE_URL||"").replace(/\/+$/,"")}/functions/v1/social-content-studio`;

function shortList(elId,items,max=3){
  const el=document.querySelector(elId);
  if(!el) return;
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
    const res=await fetch(endpoint(),{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        action:"analyze_communication",
        filters:{
          peer:document.querySelector("#peerFilter").value,
          platform:document.querySelector("#analysisPlatform").value,
          period:document.querySelector("#analysisPeriod").value
        }
      })
    });
    const data=await res.json();
    if(!res.ok||data?.ok!==true) throw new Error(data?.error||`HTTP ${res.status}`);
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
  }finally{
    btn.disabled=false;
  }
}
document.querySelector("#runCommunicationAI")?.addEventListener("click",runAnalyzeAI);

function brief(){
  const facts=document.querySelector("#facts")?.value.trim()||"";
  const pasted=document.querySelector("#pastedData")?.value.trim()||"";
  return {
    content_type:"Custom",
    topic:document.querySelector("#topic")?.value.trim()||"",
    objective:"",
    key_message:"",
    verified_facts:facts,
    pasted_data:pasted,
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
  const qs=(data?.precheck?.questions||[]).slice(0,3);
  const advice=(data?.precheck?.advice||[]).slice(0,3);
  document.querySelector("#precheckQuestions").innerHTML=qs.map((x,i)=>`<div class="precheck-item question"><b>${i+1}.</b> ${esc(x)}</div>`).join("");
  document.querySelector("#precheckAdvice").innerHTML=advice.map(x=>`<div class="precheck-item advice">✓ ${esc(x)}</div>`).join("");
  document.querySelector("#precheckCard").hidden=false;
}

async function precheck(){
  const b=brief();
  if(!b.topic){alert("กรุณาระบุเรื่องที่ต้องการสื่อสาร");return;}
  const btn=document.querySelector("#precheckContent");
  btn.disabled=true; const old=btn.textContent; btn.textContent="AI กำลังตรวจข้อมูล…";
  try{
    const res=await fetch(endpoint(),{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({action:"precheck_content",brief:b})
    });
    const data=await res.json();
    if(!res.ok||data?.ok!==true) throw new Error(data?.error||`HTTP ${res.status}`);
    renderPrecheck(data);
    if((data?.precheck?.questions||[]).length===0){
      await generate();
    } else {
      document.querySelector("#precheckCard").scrollIntoView({behavior:"smooth",block:"center"});
    }
  }catch(err){
    alert(`AI ตรวจข้อมูลไม่สำเร็จ: ${err.message||err}`);
  }finally{
    btn.disabled=false; btn.textContent=old;
  }
}
document.querySelector("#precheckContent")?.addEventListener("click",precheck);

function renderDraft(data){
  const g=data?.generation||{};
  lastGeneration=g;
  document.querySelector("#mockHook").textContent=g.hook||"—";
  document.querySelector("#mockCaption").textContent=g.caption||"—";
  document.querySelector("#mockHashtags").textContent=Array.isArray(g.hashtags)?g.hashtags.join(" "):"—";
  document.querySelector("#whyText").textContent=g.why_this_direction_th||"—";
  document.querySelector("#visualBrief").textContent=g.visual_brief_th||"—";
  document.querySelector("#postPreviewVisual").innerHTML=`<div class="preview-placeholder"><div>SPUIC</div><strong>${esc(g.hook||"AI Visual Direction")}</strong><span>${esc((g.visual_brief_th||"").slice(0,120))}</span></div>`;
}

async function generate(){
  const btn=document.querySelector("#generateMock");
  if(btn){btn.disabled=true;btn.textContent="กำลังสร้าง…";}
  try{
    const res=await fetch(endpoint(),{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({action:"generate_content",brief:brief()})
    });
    const data=await res.json();
    if(!res.ok||data?.ok!==true) throw new Error(data?.error||`HTTP ${res.status}`);
    renderDraft(data);
    document.querySelector("#postPreviewVisual").scrollIntoView({behavior:"smooth",block:"center"});
  }catch(err){
    alert(`สร้างโพสต์ไม่สำเร็จ: ${err.message||err}`);
  }finally{
    if(btn){btn.disabled=false;btn.textContent="สร้างตามคำแนะนำ";}
  }
}
document.querySelector("#generateMock")?.addEventListener("click",generate);
document.querySelector("#regenerateBtn")?.addEventListener("click",generate);
document.querySelector("#editInputBtn")?.addEventListener("click",()=>document.querySelector("#topic")?.focus());
