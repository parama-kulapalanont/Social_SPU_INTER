
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

document.querySelector("#generateMock")?.addEventListener("click",()=>{
  const goal = document.querySelector(".goal.active")?.dataset.goal || "Custom";
  const topic = document.querySelector("#topic")?.value.trim() || "";
  const objective = document.querySelector("#objective")?.value.trim() || "";
  const facts = document.querySelector("#facts")?.value.trim() || "";
  const locked = document.querySelector("#lockedFacts")?.value.trim() || "";
  const audience = document.querySelector("#audience")?.value || "";
  const market = document.querySelector("#market")?.value || "";
  const platform = document.querySelector("#platform")?.value || "";
  const language = document.querySelector("#language")?.value || "";
  const tone = document.querySelector("#tone")?.value || "";
  const cta = document.querySelector("#cta")?.value.trim() || "";
  const visualMode = document.querySelector(".visual-mode.active")?.dataset.mode || "verified";
  const visualDirection = document.querySelector("#visualDirection")?.value.trim() || "";

  const summary = [
    `ประเภท: ${goal}`,
    `หัวข้อ: ${topic || "ยังไม่ระบุ"}`,
    `กลุ่มเป้าหมาย: ${audience}`,
    `ตลาด: ${market}`,
    `ช่องทาง: ${platform}`,
    `ภาษาผลลัพธ์: ${language}`,
    `โทน: ${tone}`,
    `โหมดภาพ: ${visualMode}`
  ].join(" · ");
  document.querySelector("#briefSummary").textContent = summary;
  document.querySelector("#previewPlatform").textContent = platform;

  if(goal === "Academic Calendar"){
    document.querySelector("#mockHook").textContent = "Save these important academic dates.";
    document.querySelector("#mockCaption").textContent =
      `${topic || "Academic Calendar"} — Please check the important dates below and plan your semester in advance. ${facts || "Add verified dates before publishing."} ${cta || "Save this post for later."}`;
    document.querySelector("#mockHashtags").textContent = "#SPUInternational #AcademicCalendar #StudentUpdate";
    document.querySelector("#visualLabel").innerHTML = "ACADEMIC CALENDAR<br><strong>IMPORTANT DATES</strong>";
    document.querySelector("#whyText").textContent =
      "ใช้โครงสร้างที่ชัดและตรงประเด็น เพราะเป็นข้อมูลกำหนดการที่ต้องอ่านง่ายและลดความคลาดเคลื่อน ไม่เน้นภาษาการตลาดมากเกินไป";
    document.querySelector("#visualBrief").textContent =
      `${visualDirection || "Infographic 4:5 พร้อม Timeline แยกวันสำคัญ"} · ใช้เฉพาะวันที่ที่ได้รับการยืนยันแล้ว · ห้ามเปลี่ยนตัวเลขหรือวัน`;
  } else {
    document.querySelector("#mockHook").textContent = topic ? topic : "Build your future beyond borders.";
    document.querySelector("#mockCaption").textContent =
      `${objective || "Create a clear international-facing message."} ${facts || ""} ${cta || ""}`.trim();
    document.querySelector("#mockHashtags").textContent = "#SPUInternational #StudyInBangkok #GlobalEducation";
    document.querySelector("#visualLabel").innerHTML = "SPU INTERNATIONAL<br><strong>GLOBAL EXPERIENCE</strong>";
    document.querySelector("#whyText").textContent =
      "ระบบจะใช้ข้อมูลจริงของ SPU, Pattern จากคู่เทียบ และเงื่อนไขของ Brief เพื่อเลือกโครงสร้างข้อความที่เหมาะกับกลุ่มเป้าหมาย";
    document.querySelector("#visualBrief").textContent =
      visualDirection || "ใช้ภาพจริงของ SPU International หรือสร้าง Concept Visual ตามวัตถุประสงค์ โดยไม่สร้างข้อมูลสถานที่หรือสิ่งอำนวยความสะดวกที่ไม่มีจริง";
  }
});

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
