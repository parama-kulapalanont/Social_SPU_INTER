
const tabs = document.querySelectorAll(".studio-tab");
const panels = document.querySelectorAll(".studio-panel");

tabs.forEach(btn=>{
  btn.addEventListener("click",()=>{
    tabs.forEach(x=>x.classList.remove("active"));
    panels.forEach(x=>x.classList.remove("active"));
    btn.classList.add("active");
    document.querySelector(`#tab-${btn.dataset.tab}`).classList.add("active");
  });
});

document.querySelectorAll(".goal").forEach(btn=>{
  btn.addEventListener("click",()=>{
    document.querySelectorAll(".goal").forEach(x=>x.classList.remove("active"));
    btn.classList.add("active");
  });
});

document.querySelectorAll(".source-tab").forEach(btn=>{
  btn.addEventListener("click",()=>{
    document.querySelectorAll(".source-tab").forEach(x=>x.classList.remove("active"));
    document.querySelectorAll(".source-panel").forEach(x=>x.classList.remove("active"));
    btn.classList.add("active");
    document.querySelector(`#source-${btn.dataset.source}`).classList.add("active");
  });
});

document.querySelectorAll(".visual-mode").forEach(btn=>{
  btn.addEventListener("click",()=>{
    document.querySelectorAll(".visual-mode").forEach(x=>x.classList.remove("active"));
    btn.classList.add("active");
  });
});


function selectedContentBrief(){
  return {
    content_type:
      document.querySelector(".goal.active")?.dataset.goal || "",

    topic:
      document.querySelector("#topic")?.value.trim() || "",

    objective:
      document.querySelector("#objective")?.value.trim() || "",

    key_message:
      document.querySelector("#keyMessage")?.value.trim() || "",

    verified_facts:
      document.querySelector("#facts")?.value.trim() || "",

    pasted_data:
      document.querySelector("#pastedData")?.value.trim() || "",

    locked_facts:
      document.querySelector("#lockedFacts")?.value.trim() || "",

    audience:
      document.querySelector("#audience")?.value || "",

    market:
      document.querySelector("#market")?.value || "",

    platform:
      document.querySelector("#platform")?.value || "",

    language:
      document.querySelector("#language")?.value || "",

    tone:
      document.querySelector("#tone")?.value || "",

    cta:
      document.querySelector("#cta")?.value.trim() || "",

    creative_direction:
      document.querySelector("#creativeDirection")?.value.trim() || "",

    visual_mode:
      document.querySelector(".visual-mode.active")?.dataset.mode || "verified",

    visual_direction:
      document.querySelector("#visualDirection")?.value.trim() || ""
  };
}

function renderFactCheckNotes(items){
  const el = document.querySelector("#factCheckNotes");
  if(!el) return;

  const arr = Array.isArray(items) ? items : [];

  el.innerHTML = arr.length
    ? arr.map(x=>{
        const status = x?.status === "ok" ? "✓" : "!";
        return `<div>${status} ${liveEsc(x?.note || "")}</div>`;
      }).join("")
    : "AI ไม่พบประเด็น Fact ที่ต้องเตือนเพิ่มเติม";
}

function renderGeneratedDraft(data){
  const g = data?.generation || {};
  const brief = data?.brief || selectedContentBrief();

  document.querySelector("#mockHook").textContent =
    g.hook || "ยังไม่มี Hook";

  document.querySelector("#mockCaption").textContent =
    g.caption || "ยังไม่มี Caption";

  document.querySelector("#mockHashtags").textContent =
    Array.isArray(g.hashtags)
      ? g.hashtags.join(" ")
      : "";

  document.querySelector("#whyText").textContent =
    g.why_this_direction_th || "ไม่มีคำอธิบาย";

  document.querySelector("#visualBrief").textContent =
    g.visual_brief_th || "ไม่มี Visual Brief";

  document.querySelector("#previewPlatform").textContent =
    brief.platform || "Social";

  renderFactCheckNotes(g.fact_check_notes);

  const summary = [
    `ประเภท: ${brief.content_type || "—"}`,
    `หัวข้อ: ${brief.topic || "—"}`,
    `กลุ่มเป้าหมาย: ${brief.audience || "—"}`,
    `ตลาด: ${brief.market || "—"}`,
    `ช่องทาง: ${brief.platform || "—"}`,
    `ภาษา: ${brief.language || "—"}`,
    `โทน: ${brief.tone || "—"}`
  ].join(" · ");

  document.querySelector("#briefSummary").textContent = summary;
}


function updateAIBriefPreview(){
  const el = document.querySelector("#aiBriefPreview");
  if(!el) return;

  const brief = selectedContentBrief();

  el.textContent = JSON.stringify({
    content_type: brief.content_type,
    topic: brief.topic,
    objective: brief.objective,
    key_message: brief.key_message,
    audience: brief.audience,
    market: brief.market,
    platform: brief.platform,
    output_language: brief.language,
    tone: brief.tone,
    verified_facts: brief.verified_facts,
    locked_facts: brief.locked_facts,
    cta: brief.cta,
    creative_direction: brief.creative_direction,
    visual: {
      mode: brief.visual_mode,
      direction: brief.visual_direction
    }
  }, null, 2);
}

[
  "#topic",
  "#objective",
  "#keyMessage",
  "#facts",
  "#pastedData",
  "#lockedFacts",
  "#audience",
  "#market",
  "#platform",
  "#language",
  "#tone",
  "#cta",
  "#creativeDirection",
  "#visualDirection"
].forEach(selector=>{
  document.querySelector(selector)?.addEventListener(
    "input",
    updateAIBriefPreview
  );

  document.querySelector(selector)?.addEventListener(
    "change",
    updateAIBriefPreview
  );
});

document.querySelectorAll(".goal,.visual-mode").forEach(el=>{
  el.addEventListener("click",()=>{
    setTimeout(updateAIBriefPreview,0);
  });
});

updateAIBriefPreview();

async function generateContentDraft(){
  const btn = document.querySelector("#generateMock");
  const brief = selectedContentBrief();

  if(!brief.topic){
    alert("กรุณาระบุหัวข้อที่ต้องการสื่อสาร");
    return;
  }

  const factualTypes = [
    "Academic Calendar",
    "Scholarships & Affordability",
    "Events & Community"
  ];

  if(
    factualTypes.includes(brief.content_type) &&
    !brief.verified_facts &&
    !brief.pasted_data
  ){
    alert("คอนเทนต์ประเภทนี้ควรมีข้อมูลสำคัญหรือข้อมูลต้นทางก่อน Generate");
    return;
  }

  btn.disabled = true;
  const originalText = btn.textContent;
  btn.textContent = "กำลังวิเคราะห์และสร้าง Draft…";

  try{
    const response = await fetch(studioAIEndpoint(),{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        action:"generate_content",
        brief
      })
    });

    const data = await response.json().catch(()=>({}));

    if(!response.ok || data?.ok !== true){
      const detail = Array.isArray(data?.details)
        ? `: ${data.details.join(", ")}`
        : "";
      throw new Error(
        (data?.error || `HTTP ${response.status}`) + detail
      );
    }

    renderGeneratedDraft(data);
  }catch(err){
    console.error("Content generation error:",err);
    alert(`สร้าง Draft ไม่สำเร็จ: ${err?.message || String(err)}`);
  }finally{
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

document.querySelector("#generateMock")
  ?.addEventListener("click",generateContentDraft);


document.querySelector("#mockCompareBtn")?.addEventListener("click",()=>{
  alert("Mockup: เวอร์ชันจริงจะให้เลือกสถาบันและดึง social_posts มาเปรียบเทียบรูปแบบการสื่อสาร");
});



// ---------- LIVE ANALYZE DATA ----------
const liveCfg = window.SPU_SOCIAL_CONFIG || {};
let liveRows = [];
let liveSb = null;

const liveFmt = n => new Intl.NumberFormat("en-US").format(Number(n || 0));
const livePct = n => `${Math.round(Number(n || 0) * 100)}%`;
const liveEsc = s => String(s ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));

function liveInteractions(r){
  return Number(r.likes||0) + Number(r.comments||0) + Number(r.shares||0);
}

function liveRowsByFilters(){
  const platform = document.querySelector("#analysisPlatform")?.value || "all";
  const period = document.querySelector("#analysisPeriod")?.value || "all";
  const peer = document.querySelector("#peerFilter")?.value || "ALL";
  const cutoff = period === "all" ? null : Date.now() - Number(period)*86400000;

  return liveRows.filter(r=>{
    if(platform !== "all" && r.platform !== platform) return false;
    if(cutoff){
      const t = r.published_at ? new Date(r.published_at).getTime() : NaN;
      if(!Number.isFinite(t) || t < cutoff) return false;
    }
    if(peer !== "ALL" && r.institution_code !== "SPU" && r.institution_code !== peer) return false;
    return true;
  });
}

function captionStats(rows){
  const captions = rows.map(r=>String(r.caption||"").trim()).filter(Boolean);
  const ctaRegex = /\b(apply|register|join|learn more|click|visit|explore|discover|save|dm|inbox|contact|book|scan)\b|สมัคร|ลงทะเบียน|ดูรายละเอียด|ติดต่อ|คลิก|สแกน|บันทึกโพสต์|เข้าร่วม/iu;
  const englishRegex = /[A-Za-z]/g;
  const thaiRegex = /[\u0E00-\u0E7F]/g;

  let cta = 0, hashtags = 0, englishMain = 0, totalLen = 0;
  for(const cap of captions){
    totalLen += cap.length;
    hashtags += (cap.match(/#[^\s#]+/g)||[]).length;
    if(ctaRegex.test(cap)) cta++;
    const en = (cap.match(englishRegex)||[]).length;
    const th = (cap.match(thaiRegex)||[]).length;
    if(en > th) englishMain++;
  }
  const posts = rows.length || 1;
  const captionCount = captions.length || 1;
  const interactions = rows.reduce((s,r)=>s+liveInteractions(r),0);
  const fb = rows.filter(r=>r.platform==="facebook").length;
  const ig = rows.filter(r=>r.platform==="instagram").length;

  return {
    posts: rows.length,
    interactionsPerPost: interactions/posts,
    captionAvg: totalLen/captionCount,
    ctaRate: cta/captionCount,
    hashtagAvg: hashtags/captionCount,
    englishRate: englishMain/captionCount,
    fb, ig,
    strongPlatform: fb===ig ? "ใกล้เคียงกัน" : (fb>ig ? "Facebook" : "Instagram")
  };
}

function renderComparison(spuRows, peerRows){
  const s = captionStats(spuRows);
  const p = captionStats(peerRows);
  const peerLabel = document.querySelector("#peerFilter")?.value === "ALL" ? "คู่เทียบทั้งหมด" : document.querySelector("#peerFilter")?.value;

  document.querySelector("#comparisonBody").innerHTML = `
    <tr>
      <td><b>SPU</b></td>
      <td>${liveFmt(s.posts)}</td>
      <td>${liveFmt(Math.round(s.interactionsPerPost))}</td>
      <td>${liveFmt(Math.round(s.captionAvg))}</td>
      <td>${livePct(s.ctaRate)}</td>
    </tr>
    <tr>
      <td><b>${liveEsc(peerLabel)}</b></td>
      <td>${liveFmt(p.posts)}</td>
      <td>${liveFmt(Math.round(p.interactionsPerPost))}</td>
      <td>${liveFmt(Math.round(p.captionAvg))}</td>
      <td>${livePct(p.ctaRate)}</td>
    </tr>`;
}

function livePostCard(r){
  const img = r.thumbnail_url || r.media_url || "";
  const date = r.published_at ? new Date(r.published_at).toLocaleDateString("th-TH") : "ไม่พบวันที่";
  const cap = String(r.caption||"").trim();
  return `<article class="real-post-card">
    <div class="real-post-media">
      ${img ? `<img src="${liveEsc(img)}" alt="" loading="lazy" referrerpolicy="no-referrer"
        onerror="this.style.display='none';this.nextElementSibling.style.display='grid'">` : ""}
      <div class="real-post-fallback" style="${img?'display:none':'display:grid'}">${liveEsc(r.institution_code||"")} · ${liveEsc(r.platform||"")}</div>
    </div>
    <div class="real-post-body">
      <div class="real-post-meta">
        <b>${liveEsc(r.institution_code||"")} · ${liveEsc(r.platform==="instagram"?"Instagram":"Facebook")}</b>
        <span>${liveEsc(date)}</span>
      </div>
      <p>${liveEsc(cap || "ไม่มี Caption")}</p>
      <div class="real-post-metrics">
        <span>♥ ${liveFmt(r.likes)}</span>
        <span>💬 ${liveFmt(r.comments)}</span>
        <span>↗ ${liveFmt(r.shares)}</span>
        ${r.views!=null ? `<span>👁 ${liveFmt(r.views)}</span>` : ""}
      </div>
      ${r.post_url ? `<a href="${liveEsc(r.post_url)}" target="_blank" rel="noopener noreferrer">ดูโพสต์ต้นฉบับ ↗</a>` : ""}
    </div>
  </article>`;
}

function renderLiveAnalyze(){
  const rows = liveRowsByFilters();
  const spuRows = rows.filter(r=>r.institution_code==="SPU");
  const peerRows = rows.filter(r=>r.institution_code!=="SPU");
  const s = captionStats(spuRows);

  document.querySelector("#spuPostCount").textContent = liveFmt(s.posts);
  document.querySelector("#spuPlatformMix").textContent = `FB ${s.fb} · IG ${s.ig}`;
  document.querySelector("#spuInteractionAvg").textContent = liveFmt(Math.round(s.interactionsPerPost));
  document.querySelector("#spuCaptionAvg").textContent = liveFmt(Math.round(s.captionAvg));
  document.querySelector("#spuCtaRate").textContent = livePct(s.ctaRate);
  document.querySelector("#spuHashtagAvg").textContent = s.hashtagAvg.toFixed(1);
  document.querySelector("#spuEnglishRate").textContent = livePct(s.englishRate);
  document.querySelector("#spuCtaRate2").textContent = livePct(s.ctaRate);
  document.querySelector("#spuStrongPlatform").textContent = s.strongPlatform;

  renderComparison(spuRows, peerRows);

  const topSpu = [...spuRows].sort((a,b)=>liveInteractions(b)-liveInteractions(a)).slice(0,6);
  const topPeer = [...peerRows].sort((a,b)=>liveInteractions(b)-liveInteractions(a)).slice(0,6);

  document.querySelector("#spuTopCount").textContent = `${topSpu.length} โพสต์`;
  document.querySelector("#peerTopCount").textContent = `${topPeer.length} โพสต์`;
  document.querySelector("#spuTopPosts").innerHTML = topSpu.length ? topSpu.map(livePostCard).join("") : `<div class="loading-card">ไม่พบโพสต์ SPU ตามตัวกรองนี้</div>`;
  document.querySelector("#peerTopPosts").innerHTML = topPeer.length ? topPeer.map(livePostCard).join("") : `<div class="loading-card">ไม่พบโพสต์คู่เทียบตามตัวกรองนี้</div>`;

  const status = document.querySelector("#liveStatus");
  if(status) status.textContent = `พร้อมใช้งาน · ${liveFmt(rows.length)} โพสต์`;
}

async function initLiveAnalyze(){
  const status = document.querySelector("#liveStatus");

  try{
    if(!window.supabase) throw new Error("ไม่พบ Supabase library");
    if(!liveCfg.SUPABASE_URL || !liveCfg.SUPABASE_PUBLISHABLE_KEY) throw new Error("ไม่พบ config Supabase");

    liveSb = window.supabase.createClient(liveCfg.SUPABASE_URL, liveCfg.SUPABASE_PUBLISHABLE_KEY);
    const {data,error} = await liveSb.rpc("get_social_dashboard_posts_v2");
    if(error) throw error;

    liveRows = Array.isArray(data) ? data : [];

    const peers = [...new Set(liveRows.map(r=>r.institution_code).filter(x=>x && x!=="SPU"))].sort();
    const peerSelect = document.querySelector("#peerFilter");
    if(peerSelect){
      peerSelect.insertAdjacentHTML("beforeend", peers.map(code=>`<option value="${liveEsc(code)}">${liveEsc(code)}</option>`).join(""));
    }

    document.querySelector("#peerFilter")?.addEventListener("change",renderLiveAnalyze);
    document.querySelector("#analysisPlatform")?.addEventListener("change",renderLiveAnalyze);
    document.querySelector("#analysisPeriod")?.addEventListener("change",renderLiveAnalyze);

    renderLiveAnalyze();
  }catch(err){
    console.error(err);
    if(status){
      status.textContent = "โหลดข้อมูลไม่สำเร็จ";
      status.classList.add("error");
    }
    const msg = liveEsc(err?.message || String(err));
    document.querySelector("#spuTopPosts").innerHTML = `<div class="loading-card error-card">โหลดข้อมูลไม่สำเร็จ: ${msg}</div>`;
    document.querySelector("#peerTopPosts").innerHTML = `<div class="loading-card error-card">ตรวจสอบ config.js และ RPC get_social_dashboard_posts_v2</div>`;
  }
}

initLiveAnalyze();


// ---------- GPT COMMUNICATION ANALYSIS ----------
const studioAIEndpoint = () =>
  `${String(liveCfg.SUPABASE_URL || "").replace(/\/+$/,"")}/functions/v1/social-content-studio`;

function studioAIArray(elId, items){
  const el = document.querySelector(`#${elId}`);
  if(!el) return;
  const arr = Array.isArray(items) ? items.filter(Boolean) : [];
  el.innerHTML = arr.length
    ? arr.map(x=>`<li>${liveEsc(x)}</li>`).join("")
    : "<li>ไม่พบข้อมูลเพียงพอ</li>";
}

function studioAIChips(elId, items){
  const el = document.querySelector(`#${elId}`);
  if(!el) return;
  const arr = Array.isArray(items) ? items.filter(Boolean) : [];
  el.innerHTML = arr.length
    ? arr.map(x=>`<span class="ai-chip">${liveEsc(x)}</span>`).join("")
    : `<span class="ai-chip">ข้อมูลไม่เพียงพอ</span>`;
}

function renderCommunicationAI(result){
  const a = result?.analysis || {};
  const profile = a?.spu_profile || {};
  const intl = profile?.international_fit || {};

  document.querySelector("#aiSummary").textContent =
    a.summary_th || "ไม่มีบทสรุป";

  studioAIChips("aiThemes", profile.themes);
  studioAIChips("aiTone", profile.tone);
  studioAIArray("aiStructure", profile.message_structure);
  studioAIArray("aiCTA", profile.cta_patterns);

  document.querySelector("#aiInternationalAssessment").textContent =
    intl.assessment || "ข้อมูลไม่เพียงพอ";
  studioAIArray("aiInternationalReasons", intl.reasons);
  studioAIArray("aiKeep", a.what_to_keep);
  studioAIArray("aiChange", a.what_to_change);
  studioAIArray("aiLimitations", a.limitations);

  const peerEl = document.querySelector("#aiPeerComparison");
  const peers = Array.isArray(a.peer_comparison) ? a.peer_comparison : [];
  peerEl.innerHTML = peers.length
    ? peers.map(x=>`
      <div class="ai-peer-item">
        <b>${liveEsc(x.institution_code || "Peer")}</b>
        ${(x.observed_patterns||[]).map(v=>`<span>• ${liveEsc(v)}</span>`).join("")}
        ${(x.differences_from_spu||[]).map(v=>`<span><strong>ต่างจาก SPU:</strong> ${liveEsc(v)}</span>`).join("")}
      </div>`).join("")
    : `<div class="loading-card">ไม่พบข้อมูลคู่เทียบเพียงพอ</div>`;

  const oppEl = document.querySelector("#aiOpportunities");
  const opps = Array.isArray(a.opportunities) ? a.opportunities : [];
  oppEl.innerHTML = opps.length
    ? opps.map(x=>`
      <div class="ai-opportunity">
        <b>${liveEsc(x.title || "Opportunity")}</b>
        <p>${liveEsc(x.rationale || "")}</p>
        <em>แนวทาง: ${liveEsc(x.action || "")}</em>
      </div>`).join("")
    : `<div class="loading-card">ยังไม่มีข้อเสนอแนะ</div>`;

  const evidenceEl = document.querySelector("#aiEvidence");
  const evidence = Array.isArray(a.evidence) ? a.evidence : [];
  evidenceEl.innerHTML = evidence.length
    ? evidence.map(x=>`
      <div class="ai-evidence-item">
        <b>${liveEsc(x.institution_code || "")}</b>
        <span>${liveEsc(x.note || "")}</span>
        ${x.post_url ? `<a href="${liveEsc(x.post_url)}" target="_blank" rel="noopener noreferrer">ดูโพสต์ ↗</a>` : ""}
      </div>`).join("")
    : `<div class="loading-card">AI ไม่ได้อ้างอิง Post URL เพิ่มเติม</div>`;

  document.querySelector("#communicationAIOutput").hidden = false;
}

async function runCommunicationAI(){
  const btn = document.querySelector("#runCommunicationAI");
  const status = document.querySelector("#communicationAIStatus");

  if(!liveCfg.SUPABASE_URL){
    status.className = "ai-analysis-status error";
    status.textContent = "ไม่พบ SUPABASE_URL ใน config.js";
    return;
  }

  const payload = {
    action: "analyze_communication",
    filters: {
      peer: document.querySelector("#peerFilter")?.value || "ALL",
      platform: document.querySelector("#analysisPlatform")?.value || "all",
      period: document.querySelector("#analysisPeriod")?.value || "all"
    }
  };

  btn.disabled = true;
  btn.textContent = "กำลังวิเคราะห์…";
  status.className = "ai-analysis-status loading";
  status.textContent = "GPT กำลังอ่านตัวอย่าง Caption และ Pattern การสื่อสารจากข้อมูลจริง…";

  try{
    const response = await fetch(studioAIEndpoint(),{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(payload)
    });

    const data = await response.json().catch(()=>({}));

    if(!response.ok || data?.ok !== true){
      throw new Error(data?.error || `HTTP ${response.status}`);
    }

    renderCommunicationAI(data);
    const scope = data?.data_scope || {};
    status.className = "ai-analysis-status success";
    status.textContent =
      `วิเคราะห์สำเร็จ · SPU ${liveFmt(scope.spu_posts || 0)} โพสต์ · คู่เทียบ ${liveFmt(scope.peer_posts || 0)} โพสต์`;
  }catch(err){
    console.error("Communication AI error:",err);
    status.className = "ai-analysis-status error";
    status.textContent = `วิเคราะห์ไม่สำเร็จ: ${err?.message || String(err)}`;
  }finally{
    btn.disabled = false;
    btn.textContent = "✦ วิเคราะห์ด้วย GPT";
  }
}

document.querySelector("#runCommunicationAI")
  ?.addEventListener("click",runCommunicationAI);
