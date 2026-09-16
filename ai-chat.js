
(() => {
  const IDLE_MS = 20 * 60 * 1000;
  const STORAGE_KEY = "spu_social_ai_session_v1";

  const PAGE = document.body.dataset.aiPage || "overview";
  const PAGE_LABEL = {
    overview: "ภาพรวม",
    benchmark: "SPU Benchmark",
    institutions: "Insight รายสถาบัน"
  }[PAGE] || "Dashboard";

  const PAGE_SUGGESTIONS = {
    overview: [
      "SPU แตกต่างจาก DPU อย่างไรใน Instagram?",
      "SPU มีจุดเด่นอะไรเมื่อเทียบกับทุกสถาบัน?",
      "Post ของคู่แข่งใดที่ SPU ควรศึกษา?",
      "สรุป Key Insight สำหรับนำเสนอผู้บริหาร"
    ],
    benchmark: [
      "สรุปจุดที่ SPU แตกต่างจากคู่เทียบที่เลือก",
      "สถาบันใดมี Interactions ต่อ Post สูงกว่า SPU และควรระวัง outlier หรือไม่?",
      "เปรียบเทียบ SPU กับ DPU ใน Instagram โดยใช้ median ด้วย",
      "มี Post ของคู่แข่งใดที่ควรเปิดดูเป็นตัวอย่าง?"
    ],
    institutions: [
      "สรุป Insight ของสถาบันที่เลือก",
      "สถาบันที่เลือกมี Content รูปแบบใดปรากฏใน Top Posts?",
      "เปรียบเทียบ median Likes ต่อ Post ของสถาบันที่เลือก",
      "มี outlier ใดที่อาจทำให้ค่าเฉลี่ยคลาดเคลื่อน?"
    ]
  };

  let messages = [];
  let suggestions = PAGE_SUGGESTIONS[PAGE] || PAGE_SUGGESTIONS.overview;
  let lastQuestionAt = null;
  let idleTimer = null;
  let sending = false;
  let filterSnapshot = null;
  let lastRate = null;
  let currentRelevantUrls = [];

  const cfg = window.SPU_SOCIAL_CONFIG || {};
  const functionUrl = `${cfg.SUPABASE_URL}/functions/v1/social-ai-chat`;

  function esc(s){
    return String(s ?? "").replace(/[&<>"']/g,c=>({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    }[c]));
  }

  function linkify(text){
    const safe = esc(text);
    return safe.replace(
      /(https?:\/\/[^\s<]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
    );
  }

  function loadSession(){
    try{
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if(!raw) return;
      const saved = JSON.parse(raw);
      const last = Number(saved.lastQuestionAt || 0);
      if(!last || Date.now() - last >= IDLE_MS){
        sessionStorage.removeItem(STORAGE_KEY);
        return;
      }
      messages = Array.isArray(saved.messages) ? saved.messages.slice(-12) : [];
      lastQuestionAt = last;
      suggestions = Array.isArray(saved.suggestions) && saved.suggestions.length
        ? saved.suggestions.slice(0,4)
        : suggestions;
      lastRate = saved.lastRate || null;
    }catch{
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }

  function saveSession(){
    if(!lastQuestionAt){
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      messages: messages.slice(-12),
      lastQuestionAt,
      suggestions: suggestions.slice(0,4),
      lastRate
    }));
  }

  function deleteSession(){
    messages = [];
    suggestions = PAGE_SUGGESTIONS[PAGE] || PAGE_SUGGESTIONS.overview;
    lastQuestionAt = null;
    lastRate = null;
    sessionStorage.removeItem(STORAGE_KEY);
  }

  function mount(){
    loadSession();

    document.body.insertAdjacentHTML("beforeend", `
      <button class="ai-fab" id="socialAiFab" type="button" aria-label="เปิด SPU Social AI">AI</button>

      <aside class="ai-chat" id="socialAiChat" aria-label="SPU Social AI">
        <div class="ai-chat-head">
          <div class="ai-chat-title">
            <div class="ai-chat-dot">AI</div>
            <div>
              <b>SPU Social AI Assistant</b>
              <small>${esc(PAGE_LABEL)} · วิเคราะห์ · Focus Dashboard</small>
            </div>
          </div>
          <button class="ai-chat-close" id="socialAiClose" type="button" aria-label="ปิด">×</button>
        </div>

        <div class="ai-chat-body" id="socialAiBody"></div>

        <div class="ai-chat-input-wrap">
          <div class="ai-chat-input-row">
            <input class="ai-chat-input" id="socialAiInput" placeholder="ถามเกี่ยวกับข้อมูล Social Intelligence..." autocomplete="off">
            <button class="ai-chat-send" id="socialAiSend" type="button">➤</button>
          </div>
          <div class="ai-chat-foot">
            <span>ใช้ Filter ปัจจุบันเป็น Context</span>
            <span>ไม่มีคำถามใหม่ 20 นาที → ล้างบทสนทนา</span>
          </div>
          <div class="ai-rate-note" id="socialAiRate"></div>
        </div>
      </aside>
    `);

    document.querySelector("#socialAiFab").addEventListener("click", openChat);
    document.querySelector("#socialAiClose").addEventListener("click", closeChat);
    document.querySelector("#socialAiSend").addEventListener("click", submitInput);
    document.querySelector("#socialAiInput").addEventListener("keydown", e=>{
      if(e.key==="Enter" && !e.shiftKey){
        e.preventDefault();
        submitInput();
      }
    });
    document.querySelector("#aiFocusClose")?.addEventListener("click", clearFocusAndRestore);

    renderConversation();
    scheduleExpiry();
  }

  function openChat(){
    document.querySelector("#socialAiChat").classList.add("open");
    document.querySelector("#socialAiFab").style.display="none";
    scheduleExpiry();
    setTimeout(()=>document.querySelector("#socialAiInput")?.focus(),50);
  }

  function closeChat(){
    document.querySelector("#socialAiChat").classList.remove("open");
    document.querySelector("#socialAiFab").style.display="";
    deleteSession();
    clearFocusAndRestore();
    clearTimeout(idleTimer);
    renderConversation();
  }

  function expireSession(){
    deleteSession();
    clearFocusAndRestore();
    renderConversation();
  }

  function scheduleExpiry(){
    clearTimeout(idleTimer);
    if(!lastQuestionAt) return;
    const remaining = IDLE_MS - (Date.now() - lastQuestionAt);
    if(remaining <= 0){
      expireSession();
      return;
    }
    idleTimer = setTimeout(expireSession, remaining);
  }

  function renderConversation(){
    const body = document.querySelector("#socialAiBody");
    if(!body) return;

    if(!messages.length){
      body.innerHTML = `
        <div class="ai-welcome">
          ถามเกี่ยวกับข้อมูล Facebook และ Instagram ที่ระบบเก็บได้ ระบบสามารถเปรียบเทียบ หา Outlier วิเคราะห์ What-if และเสนอจุดที่ควร Focus บน Dashboard ได้ โดยจะขอให้ยืนยันก่อนเปลี่ยน Filter หรือ Highlight ทุกครั้ง
        </div>
        <div id="socialAiSuggestions"></div>
        <div class="ai-session-note">Chat นี้ไม่บันทึกลงฐานข้อมูล · กด × หรือไม่มีคำถามใหม่ 20 นาทีเพื่อเริ่มใหม่</div>
      `;
      renderSuggestions(suggestions);
    }else{
      body.innerHTML = "";
      messages.forEach(m=>renderMessageNode(m.role,m.content,false));
      body.insertAdjacentHTML("beforeend", `<div id="socialAiSuggestions"></div>`);
      renderSuggestions(suggestions);
    }

    body.scrollTop = body.scrollHeight;
    updateRateNote();
  }

  function renderSuggestions(items){
    const host = document.querySelector("#socialAiSuggestions");
    if(!host) return;
    const qs = (Array.isArray(items) && items.length ? items : PAGE_SUGGESTIONS[PAGE]).slice(0,4);
    host.innerHTML = `
      <div class="ai-suggest-title">คำถามแนะนำ</div>
      ${qs.map(q=>`<button type="button" class="ai-suggestion">${esc(q)}</button>`).join("")}
    `;
    host.querySelectorAll(".ai-suggestion").forEach(btn=>{
      btn.addEventListener("click", ()=>ask(btn.textContent.trim()));
    });
  }

  function renderMessageNode(role,text,scroll=true){
    const body = document.querySelector("#socialAiBody");
    const node = document.createElement("div");
    node.className = `ai-message ${role}`;
    node.innerHTML = `<div class="ai-bubble">${role==="assistant" ? linkify(text) : esc(text)}</div>`;
    const suggestionHost = document.querySelector("#socialAiSuggestions");
    if(suggestionHost) body.insertBefore(node,suggestionHost);
    else body.appendChild(node);
    if(scroll) body.scrollTop = body.scrollHeight;
  }

  function addMessage(role,text){
    messages.push({role,content:text});
    messages = messages.slice(-12);
    renderMessageNode(role,text);
    saveSession();
  }

  function setLoading(show){
    document.querySelector("#socialAiLoading")?.remove();
    if(!show) return;
    const body = document.querySelector("#socialAiBody");
    const host = document.querySelector("#socialAiSuggestions");
    const div = document.createElement("div");
    div.className = "ai-loading";
    div.id = "socialAiLoading";
    div.textContent = "กำลังวิเคราะห์ข้อมูล...";
    if(host) body.insertBefore(div,host);
    else body.appendChild(div);
    body.scrollTop = body.scrollHeight;
  }

  function getFilters(){
    const state = window.SPU_SOCIAL_FILTER_STATE || {};
    return {
      period: state.period || "all",
      platform: state.platform || "all",
      institutions: Array.isArray(state.institutions) ? state.institutions : []
    };
  }

  function getHistoryForApi(){
    return messages
      .filter(x=>x.role==="user" || x.role==="assistant")
      .slice(-8)
      .map(x=>({role:x.role,content:x.content}));
  }

  async function submitInput(){
    const input = document.querySelector("#socialAiInput");
    const q = input.value.trim();
    if(!q || sending) return;
    input.value="";
    await ask(q);
  }

  async function ask(question){
    if(!question || sending) return;

    // A new user question must never inherit the previous visual focus.
    clearFocusAndRestore();

    sending = true;
    lastQuestionAt = Date.now();
    scheduleExpiry();

    addMessage("user",question);
    setLoading(true);
    setSendEnabled(false);

    try{
      const previousHistory = getHistoryForApi().slice(0,-1);

      const res = await fetch(functionUrl,{
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "apikey":cfg.SUPABASE_PUBLISHABLE_KEY
        },
        body:JSON.stringify({
          question,
          filters:getFilters(),
          history:previousHistory,
          page:PAGE_LABEL
        })
      });

      const data = await res.json().catch(()=>({}));

      if(res.status===429 || data?.stage==="rate-limited"){
        const mins = Math.max(1,Math.ceil(Number(data.retry_after_seconds||60)/60));
        addMessage("assistant",`ใช้งาน AI ครบตามจำนวนที่กำหนดแล้ว กรุณารอประมาณ ${mins} นาทีแล้วลองใหม่`);
        return;
      }

      if(!res.ok || !data?.ok){
        throw new Error(data?.error || `HTTP ${res.status}`);
      }

      addMessage("assistant",data.answer || "ไม่พบคำตอบจากระบบ");

      suggestions = Array.isArray(data.suggested_questions) && data.suggested_questions.length
        ? data.suggested_questions.slice(0,4)
        : PAGE_SUGGESTIONS[PAGE];
      lastRate = data.rate_limit || null;
      currentRelevantUrls = Array.isArray(data.relevant_post_urls) ? data.relevant_post_urls.slice(0,6) : [];
      saveSession();

      renderSuggestions(suggestions);
      updateRateNote();

      if(currentRelevantUrls.length){
        renderPostLinks(currentRelevantUrls);
      }

      if(data.proposed_focus?.requires_confirmation &&
         Array.isArray(data.proposed_focus.highlights) &&
         data.proposed_focus.highlights.length){
        renderFocusConfirmation(data.proposed_focus,currentRelevantUrls);
      }
    }catch(err){
      addMessage("assistant",`ไม่สามารถเรียก AI ได้: ${err?.message || String(err)}`);
    }finally{
      setLoading(false);
      setSendEnabled(true);
      sending=false;
    }
  }

  function setSendEnabled(enabled){
    const btn=document.querySelector("#socialAiSend");
    const input=document.querySelector("#socialAiInput");
    if(btn) btn.disabled=!enabled;
    if(input) input.disabled=!enabled;
  }

  function updateRateNote(){
    const el=document.querySelector("#socialAiRate");
    if(!el) return;
    if(!lastRate){
      el.textContent="";
      return;
    }
    el.textContent=`AI usage: เหลือ ${Number(lastRate.remaining??0)}/${Number(lastRate.limit??20)} ครั้งใน ${Number(lastRate.window_minutes??10)} นาที`;
  }

  function renderPostLinks(urls){
    const body=document.querySelector("#socialAiBody");
    document.querySelector("#socialAiPostLinks")?.remove();
    const box=document.createElement("div");
    box.id="socialAiPostLinks";
    box.className="ai-post-links";
    box.innerHTML=`<b>Posts ที่ AI ใช้อ้างอิง</b>`+
      urls.slice(0,6).map((u,i)=>`<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">Post ${i+1} · ${esc(u)}</a>`).join("");
    body.appendChild(box);
    body.scrollTop=body.scrollHeight;
  }

  function renderFocusConfirmation(focus,urls){
    const body=document.querySelector("#socialAiBody");
    document.querySelector("#socialAiConfirm")?.remove();
    const box=document.createElement("div");
    box.id="socialAiConfirm";
    box.className="ai-confirm";

    const inst=Array.isArray(focus.institutions)&&focus.institutions.length
      ? focus.institutions.join(" + ")
      : "ตาม Filter ปัจจุบัน";
    const platform=Array.isArray(focus.platforms)&&focus.platforms.length
      ? focus.platforms.map(platformLabel).join(" + ")
      : "ทุก Platform";
    const period=focus.period==="all"?"ข้อมูลทั้งหมด":(focus.period?`${focus.period} วัน`:"ตาม Filter ปัจจุบัน");

    box.innerHTML=`
      <b>AI ต้องการ Focus Dashboard ชั่วคราว</b>
      <p>${esc(inst)} · ${esc(platform)} · ${esc(period)}<br>ระบบจะเปลี่ยน Filter/Highlight เฉพาะเมื่อคุณยืนยัน</p>
      <div class="ai-confirm-actions">
        <button type="button" class="analysis-only">วิเคราะห์อย่างเดียว</button>
        <button type="button" class="primary apply-focus">ยืนยันและ Highlight</button>
      </div>
    `;
    body.appendChild(box);
    body.scrollTop=body.scrollHeight;

    box.querySelector(".analysis-only").addEventListener("click",()=>box.remove());
    box.querySelector(".apply-focus").addEventListener("click",()=>{
      applyFocus(focus,urls);
      box.remove();
    });
  }

  function snapshotFilters(){
    return {
      period:document.querySelector("#periodFilter")?.value??"all",
      platform:document.querySelector("#platformFilter")?.value??"all",
      checkedInstitutions:[...document.querySelectorAll('#institutionMultiMenu input[type="checkbox"]:checked')].map(x=>x.value),
      override:window.SPU_SOCIAL_AI_FILTER_OVERRIDE || null
    };
  }

  function applyFocus(focus,urls=[]){
    clearFocusVisualOnly();
    filterSnapshot=snapshotFilters();

    const exactInstitutions=Array.isArray(focus.institutions)?focus.institutions:[];
    window.SPU_SOCIAL_AI_FILTER_OVERRIDE = exactInstitutions.length
      ? {institutions:[...exactInstitutions]}
      : null;

    const period=document.querySelector("#periodFilter");
    if(period && [...period.options].some(o=>o.value===String(focus.period))){
      period.value=String(focus.period);
      period.dispatchEvent(new Event("change",{bubbles:true}));
    }

    const platform=document.querySelector("#platformFilter");
    const p=Array.isArray(focus.platforms)&&focus.platforms.length===1?focus.platforms[0]:"all";
    if(platform && [...platform.options].some(o=>o.value===p)){
      platform.value=p;
      platform.dispatchEvent(new Event("change",{bubbles:true}));
    }

    const selectedPeers=new Set(exactInstitutions.filter(x=>x!=="SPU"));
    document.querySelectorAll('#institutionMultiMenu input[type="checkbox"]').forEach(cb=>{
      cb.checked=selectedPeers.has(cb.value) || (window.SPU_SOCIAL_FILTER_MODE!=="comparison" && exactInstitutions.includes(cb.value));
    });
    const anyCb=document.querySelector('#institutionMultiMenu input[type="checkbox"]');
    if(anyCb) anyCb.dispatchEvent(new Event("change",{bubbles:true}));

    setTimeout(()=>{
      let n=1;
      const targets=[...new Set(focus.highlights||[])];

      targets.forEach(target=>{
        const els=[...document.querySelectorAll(`[data-ai-target="${CSS.escape(target)}"]`)];
        els.forEach(el=>{
          el.classList.add("ai-highlight");
          el.setAttribute("data-ai-number",String(n));
        });
        if(els.length) n++;
      });

      // Prefer exact Post evidence when those cards are visible.
      (urls||[]).forEach(url=>{
        const el=[...document.querySelectorAll('.post-card[data-post-url]')].find(x=>x.dataset.postUrl===url);
        if(el && !el.classList.contains("ai-highlight")){
          el.classList.add("ai-highlight");
          el.setAttribute("data-ai-number",String(n++));
        }
      });

      const bar=document.querySelector("#aiFocusBar");
      const text=document.querySelector("#aiFocusText");
      if(text){
        text.textContent=`${exactInstitutions.join(" + ") || "ข้อมูลที่เลือก"} · ${(focus.platforms||[]).map(platformLabel).join(" + ") || "ทุก Platform"}`;
      }
      if(bar) bar.hidden=false;

      const first=document.querySelector(".ai-highlight");
      if(first) first.scrollIntoView({behavior:"smooth",block:"center"});
    },150);
  }

  function clearFocusVisualOnly(){
    document.querySelectorAll(".ai-highlight").forEach(el=>{
      el.classList.remove("ai-highlight");
      el.removeAttribute("data-ai-number");
    });
    const bar=document.querySelector("#aiFocusBar");
    if(bar) bar.hidden=true;
  }

  function clearFocusAndRestore(){
    clearFocusVisualOnly();

    if(!filterSnapshot){
      window.SPU_SOCIAL_AI_FILTER_OVERRIDE=null;
      return;
    }

    window.SPU_SOCIAL_AI_FILTER_OVERRIDE=filterSnapshot.override;

    const period=document.querySelector("#periodFilter");
    const platform=document.querySelector("#platformFilter");

    if(period){
      period.value=filterSnapshot.period;
      period.dispatchEvent(new Event("change",{bubbles:true}));
    }
    if(platform){
      platform.value=filterSnapshot.platform;
      platform.dispatchEvent(new Event("change",{bubbles:true}));
    }

    const selected=new Set(filterSnapshot.checkedInstitutions||[]);
    document.querySelectorAll('#institutionMultiMenu input[type="checkbox"]').forEach(cb=>{
      cb.checked=selected.has(cb.value);
    });
    const anyCb=document.querySelector('#institutionMultiMenu input[type="checkbox"]');
    if(anyCb) anyCb.dispatchEvent(new Event("change",{bubbles:true}));

    filterSnapshot=null;
  }

  function platformLabel(p){
    return p==="instagram"?"Instagram":p==="facebook"?"Facebook":(p||"ทุก Platform");
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",()=>setTimeout(mount,300));
  }else{
    setTimeout(mount,300);
  }
})();
