
(() => {
  const IDLE_MS = 20 * 60 * 1000;
  const STORAGE_KEY = "spu_social_ai_session_v2";

  const PAGE = document.body.dataset.aiPage || "overview";
  const PAGE_LABEL = {
    overview: "ภาพรวม",
    benchmark: "SPU Benchmark",
    institutions: "Insight รายสถาบัน"
  }[PAGE] || "Dashboard";

  const PAGE_SUGGESTIONS = {
    overview: [
      "ตอนนี้มีมหาวิทยาลัยไหนที่น่าจับตามองบ้าง?",
      "SPU แตกต่างจาก DPU อย่างไรใน Instagram?",
      "Post ของคู่แข่งใดที่ SPU ควรศึกษา?",
      "สรุปประเด็นสำคัญสำหรับผู้บริหาร"
    ],
    benchmark: [
      "สรุปจุดที่ SPU แตกต่างจากสถาบันที่เลือก",
      "มีโพสต์ใดที่ทำให้ค่าเฉลี่ยสูงผิดจากภาพรวมไหม?",
      "ถ้าไม่นับโพสต์ที่โดดเด่นผิดปกติ ผลจะเปลี่ยนอย่างไร?",
      "ควรเปิดดู Post ใดของคู่แข่งเป็นตัวอย่าง?"
    ],
    institutions: [
      "สรุปจุดเด่นของสถาบันที่เลือก",
      "ผลตอบรับของแต่ละสถาบันสม่ำเสมอแค่ไหน?",
      "มีโพสต์ใดที่ยอดสูงผิดจากกลุ่มอย่างชัดเจน?",
      "สรุปความต่างของสถาบันที่เลือกแบบผู้บริหารอ่านง่าย"
    ]
  };

  let messages = [];
  let suggestions = PAGE_SUGGESTIONS[PAGE] || PAGE_SUGGESTIONS.overview;
  let lastQuestionAt = null;
  let lastRate = null;
  let sending = false;
  let idleTimer = null;

  let chatMode = "closed"; // open | minimized | closed
  let activeFocus = null;
  let focusRelevantUrls = [];
  let focusSnapshots = {};

  const cfg = window.SPU_SOCIAL_CONFIG || {};
  const functionUrl = `${cfg.SUPABASE_URL}/functions/v1/social-ai-chat`;

  // Some browsers / embedded previews can block sessionStorage.
  // All chat controls must keep working even when storage is unavailable.
  let memoryStorage = {};

  function storageGet(key){
    try{
      return sessionStorage.getItem(key);
    }catch{
      return Object.prototype.hasOwnProperty.call(memoryStorage,key)
        ? memoryStorage[key]
        : null;
    }
  }

  function storageSet(key,value){
    try{
      sessionStorage.setItem(key,value);
      return;
    }catch{
      memoryStorage[key]=value;
    }
  }

  function storageRemove(key){
    try{
      sessionStorage.removeItem(key);
    }catch{}
    delete memoryStorage[key];
  }

  function esc(s){
    return String(s ?? "").replace(/[&<>"']/g,c=>({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    }[c]));
  }

  function safeJsonParse(value){
    try { return JSON.parse(value); } catch { return null; }
  }

  // Backend already localizes the response. These replacements are only a UI fallback
  // so internal field names are never shown raw if a model response leaks them.
  function localizeTechnicalTerms(text){
    return String(text ?? "")
      .replace(/coverage\.comparable_source_coverage/gi, "ความครบถ้วนของข้อมูลระหว่างช่องทาง")
      .replace(/comparable_source_coverage/gi, "ความครบถ้วนของข้อมูลระหว่างช่องทาง")
      .replace(/interactions_per_post/gi, "ปฏิสัมพันธ์เฉลี่ยต่อ Post")
      .replace(/top_3_posts_share_percent/gi, "สัดส่วนผลตอบรับจาก 3 Posts ที่โดดเด่นที่สุด")
      .replace(/top_post_share_percent/gi, "สัดส่วนผลตอบรับจาก Post ที่โดดเด่นที่สุด")
      .replace(/available_posts/gi, "จำนวน Posts ที่มีข้อมูล")
      .replace(/what_if\.active/gi, "การวิเคราะห์กรณีสมมติ")
      .replace(/\bwhat_if\b/gi, "กรณีสมมติ")
      .replace(/\bdistribution\b/gi, "รูปแบบการกระจายของผลตอบรับ")
      .replace(/\bcoverage\b/gi, "ความครบถ้วนของข้อมูล")
      .replace(/\bmedian\b/gi, "ค่ากลาง")
      .replace(/\bmean\b/gi, "ค่าเฉลี่ย")
      .replace(/\bp25\b/gi, "ค่าช่วงล่าง")
      .replace(/\bp75\b/gi, "ค่าช่วงบน")
      .replace(/\boutlier\b/gi, "Post ที่มียอดสูงผิดจากกลุ่ม")
      .replace(/\bmetric(s)?\b/gi, "ตัวชี้วัด");
  }

  function normalizeAnswer(raw){
    let text = raw;

    // Handle accidental nested/stringified JSON.
    if(typeof text === "object" && text){
      text = text.answer ?? JSON.stringify(text);
    }

    text = String(text ?? "").trim();

    for(let i=0;i<2;i++){
      const parsed = text.startsWith("{") ? safeJsonParse(text) : null;
      if(parsed && typeof parsed.answer === "string"){
        text = parsed.answer.trim();
      }else{
        break;
      }
    }

    text = text
      .replace(/^```(?:json)?\s*/i,"")
      .replace(/\s*```$/,"")
      .replace(/\\n/g,"\n");

    return localizeTechnicalTerms(text);
  }

  function linkifyInline(text){
    const safe = esc(text);
    return safe.replace(
      /(https?:\/\/[^\s<]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
    );
  }

  function formatAnswer(raw){
    const text = normalizeAnswer(raw);
    const lines = text.split(/\n/);
    const parts = [];

    let paragraph = [];
    function flushParagraph(){
      const value = paragraph.join(" ").trim();
      if(value){
        parts.push(`<p>${linkifyInline(value)}</p>`);
      }
      paragraph = [];
    }

    for(const original of lines){
      const line = original.trim();

      if(!line){
        flushParagraph();
        continue;
      }

      if(/^[-•]\s+/.test(line)){
        flushParagraph();
        parts.push(
          `<div class="ai-answer-bullet"><div>${linkifyInline(line.replace(/^[-•]\s+/,""))}</div></div>`
        );
        continue;
      }

      if(/^\d+[.)]\s+/.test(line)){
        flushParagraph();
        parts.push(
          `<div class="ai-answer-section">${linkifyInline(line)}</div>`
        );
        continue;
      }

      if(
        /^(สรุป|ข้อควรระวัง|สิ่งที่เห็น|ประเด็นสำคัญ|ภาพรวม|ข้อสังเกต|สิ่งที่ควรรู้)\s*[:：]?$/i.test(line)
      ){
        flushParagraph();
        parts.push(`<div class="ai-answer-section">${esc(line.replace(/[:：]$/,""))}</div>`);
        continue;
      }

      paragraph.push(line);
    }

    flushParagraph();

    return `<div class="ai-answer">${parts.join("")}</div>`;
  }

  function loadSession(){
    try{
      const raw = storageGet(STORAGE_KEY);
      if(!raw) return;

      const saved = JSON.parse(raw);
      const last = Number(saved.lastQuestionAt || 0);

      if(last && Date.now() - last >= IDLE_MS){
        storageRemove(STORAGE_KEY);
        return;
      }

      messages = Array.isArray(saved.messages) ? saved.messages.slice(-12) : [];
      suggestions = Array.isArray(saved.suggestions) && saved.suggestions.length
        ? saved.suggestions.slice(0,4)
        : suggestions;
      lastQuestionAt = last || null;
      lastRate = saved.lastRate || null;

      chatMode = ["open","minimized","closed"].includes(saved.chatMode)
        ? saved.chatMode
        : "closed";

      activeFocus = saved.activeFocus || null;
      focusRelevantUrls = Array.isArray(saved.focusRelevantUrls)
        ? saved.focusRelevantUrls.slice(0,6)
        : [];
      focusSnapshots = saved.focusSnapshots && typeof saved.focusSnapshots === "object"
        ? saved.focusSnapshots
        : {};
    }catch{
      storageRemove(STORAGE_KEY);
    }
  }

  function saveSession(){
    // If there is neither conversation nor focus, no need to persist anything.
    if(!messages.length && !activeFocus && chatMode==="closed"){
      storageRemove(STORAGE_KEY);
      return;
    }

    storageSet(STORAGE_KEY, JSON.stringify({
      messages: messages.slice(-12),
      suggestions: suggestions.slice(0,4),
      lastQuestionAt,
      lastRate,
      chatMode,
      activeFocus,
      focusRelevantUrls,
      focusSnapshots
    }));
  }

  function clearConversationOnly(){
    messages = [];
    suggestions = PAGE_SUGGESTIONS[PAGE] || PAGE_SUGGESTIONS.overview;
    lastQuestionAt = null;
    lastRate = null;
    clearTimeout(idleTimer);
  }

  function mount(){
    loadSession();

    document.body.insertAdjacentHTML("beforeend", `
      <button class="ai-fab" id="socialAiFab" type="button" aria-label="เปิด SPU Social AI">AI</button>

      <aside class="ai-chat" id="socialAiChat" aria-label="SPU Social AI">
        <div class="ai-chat-head">
          <div class="ai-chat-title">
            <div class="ai-chat-dot">AI</div>
            <div><b>SPU Social AI</b></div>
          </div>

          <div class="ai-chat-head-actions">
            <button class="ai-chat-minimize" id="socialAiMinimize" type="button" aria-label="ซ่อน Chat">−</button>
            <button class="ai-chat-close" id="socialAiClose" type="button" aria-label="ปิด Chat">×</button>
          </div>
        </div>

        <div class="ai-chat-body" id="socialAiBody"></div>

        <div class="ai-chat-input-wrap">
          <div class="ai-chat-input-row">
            <input class="ai-chat-input" id="socialAiInput" placeholder="ถามเกี่ยวกับข้อมูล..." autocomplete="off">
            <button class="ai-chat-send" id="socialAiSend" type="button">➤</button>
          </div>
          <div class="ai-chat-foot">
            <span>ใช้ Filter ปัจจุบัน</span>
            <span>ไม่มีคำถามใหม่ 20 นาที → เริ่มใหม่</span>
          </div>
          <div class="ai-rate-note" id="socialAiRate"></div>
        </div>
      </aside>
    `);

    document.querySelector("#socialAiFab").addEventListener("click", openChat);
    document.querySelector("#socialAiMinimize").addEventListener("click", minimizeChat);
    document.querySelector("#socialAiClose").addEventListener("click", closeChat);
    document.querySelector("#socialAiSend").addEventListener("click", submitInput);

    document.querySelector("#socialAiInput").addEventListener("keydown", e=>{
      if(e.key==="Enter" && !e.shiftKey){
        e.preventDefault();
        submitInput();
      }
    });

    document.querySelector("#aiFocusClose")?.addEventListener("click", ()=>{
      clearFocusAndRestore(true);
    });

    renderConversation();
    applyChatMode();

    // Dashboard filters initialize asynchronously. Restore AI Focus after they exist.
    setTimeout(()=>{
      if(activeFocus){
        restoreFocusOnCurrentPage();
      }
    }, 650);

    scheduleExpiry();
  }

  function applyChatMode(){
    const chat = document.querySelector("#socialAiChat");
    const fab = document.querySelector("#socialAiFab");

    if(chatMode==="open"){
      chat.classList.add("open");
      fab.style.display="none";
    }else{
      chat.classList.remove("open");
      fab.style.display="";
      fab.classList.toggle("has-session", chatMode==="minimized" && (messages.length>0 || !!activeFocus));
    }
  }

  function openChat(){
    chatMode = "open";
    applyChatMode();
    saveSession();
    scheduleExpiry();
    setTimeout(()=>document.querySelector("#socialAiInput")?.focus(),50);
  }

  function minimizeChat(){
    chatMode = "minimized";
    applyChatMode();
    saveSession();
    // Intentionally keep AI Focus and conversation.
  }

  function closeChat(){
    // X means end the AI session: conversation + highlight disappear.
    clearFocusAndRestore(true);
    clearConversationOnly();
    chatMode = "closed";
    focusRelevantUrls = [];
    focusSnapshots = {};
    storageRemove(STORAGE_KEY);
    applyChatMode();
    renderConversation();
  }

  function scheduleExpiry(){
    clearTimeout(idleTimer);
    if(!lastQuestionAt) return;

    const remaining = IDLE_MS - (Date.now() - lastQuestionAt);

    if(remaining<=0){
      expireSession();
      return;
    }

    idleTimer = setTimeout(expireSession, remaining);
  }

  function expireSession(){
    clearFocusAndRestore(true);
    clearConversationOnly();
    focusRelevantUrls = [];
    focusSnapshots = {};
    chatMode = "closed";
    storageRemove(STORAGE_KEY);
    applyChatMode();
    renderConversation();
  }

  function renderConversation(){
    const body = document.querySelector("#socialAiBody");
    if(!body) return;

    body.innerHTML = "";

    if(!messages.length){
      body.innerHTML = `<div class="ai-empty"><div id="socialAiSuggestions"></div></div>`;
      renderSuggestions(suggestions);
    }else{
      messages.forEach(m=>renderMessageNode(m.role,m.content,false));
      body.insertAdjacentHTML("beforeend", `<div id="socialAiSuggestions"></div>`);
      renderSuggestions(suggestions);

      if(focusRelevantUrls.length){
        renderPostLinks(focusRelevantUrls);
      }
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

    node.innerHTML = `<div class="ai-bubble">${
      role==="assistant" ? formatAnswer(text) : esc(text)
    }</div>`;

    const suggestionHost = document.querySelector("#socialAiSuggestions");

    if(suggestionHost){
      // On the empty-chat view the suggestion host is nested inside .ai-empty,
      // so it is not a direct child of the chat body. insertBefore() only accepts
      // a direct child as the reference node.
      const directAnchor =
        suggestionHost.parentElement === body
          ? suggestionHost
          : (
              suggestionHost.parentElement?.parentElement === body
                ? suggestionHost.parentElement
                : null
            );

      if(directAnchor){
        body.insertBefore(node,directAnchor);
      }else{
        body.appendChild(node);
      }
    }else{
      body.appendChild(node);
    }

    if(scroll) body.scrollTop = body.scrollHeight;
  }

  function addMessage(role,text){
    messages.push({role,content:String(text ?? "")});
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
    div.textContent = "กำลังวิเคราะห์...";

    if(host){
      const directAnchor =
        host.parentElement === body
          ? host
          : (
              host.parentElement?.parentElement === body
                ? host.parentElement
                : null
            );

      if(directAnchor){
        body.insertBefore(div,directAnchor);
      }else{
        body.appendChild(div);
      }
    }else{
      body.appendChild(div);
    }

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

    // New question = old Focus must not contaminate the next analysis.
    clearFocusAndRestore(true);

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

      const answer = normalizeAnswer(data.answer || "ไม่พบคำตอบจากระบบ");
      addMessage("assistant",answer);

      suggestions = Array.isArray(data.suggested_questions) && data.suggested_questions.length
        ? data.suggested_questions.map(normalizeAnswer).slice(0,4)
        : PAGE_SUGGESTIONS[PAGE];

      lastRate = data.rate_limit || null;
      focusRelevantUrls = Array.isArray(data.relevant_post_urls)
        ? data.relevant_post_urls.slice(0,6)
        : [];

      renderSuggestions(suggestions);
      updateRateNote();

      if(focusRelevantUrls.length){
        renderPostLinks(focusRelevantUrls);
      }

      if(
        data.proposed_focus?.requires_confirmation &&
        Array.isArray(data.proposed_focus.highlights) &&
        data.proposed_focus.highlights.length
      ){
        renderFocusConfirmation(data.proposed_focus,focusRelevantUrls);
      }

      saveSession();
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

    el.textContent=`เหลือ ${Number(lastRate.remaining??0)}/${Number(lastRate.limit??20)} คำถามในช่วง ${Number(lastRate.window_minutes??10)} นาที`;
  }

  function renderPostLinks(urls){
    const body=document.querySelector("#socialAiBody");
    document.querySelector("#socialAiPostLinks")?.remove();

    const box=document.createElement("div");
    box.id="socialAiPostLinks";
    box.className="ai-post-links";

    box.innerHTML=`<b>Posts ที่เกี่ยวข้อง</b>`+
      urls.slice(0,6).map((u,i)=>`<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">เปิด Post ${i+1}</a>`).join("");

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
      : "ข้อมูลที่เลือก";

    const platform=Array.isArray(focus.platforms)&&focus.platforms.length
      ? focus.platforms.map(platformLabel).join(" + ")
      : "ทุกช่องทาง";

    const period=focus.period==="all"
      ? "ข้อมูลทั้งหมด"
      : (focus.period?`${focus.period} วัน`:"ช่วงเวลาปัจจุบัน");

    box.innerHTML=`
      <b>ให้ AI Focus จุดสำคัญบน Dashboard หรือไม่?</b>
      <p>${esc(inst)} · ${esc(platform)} · ${esc(period)}</p>
      <div class="ai-confirm-actions">
        <button type="button" class="analysis-only">ไม่ต้อง Highlight</button>
        <button type="button" class="primary apply-focus">ยืนยันและ Highlight</button>
      </div>
    `;

    body.appendChild(box);
    body.scrollTop=body.scrollHeight;

    box.querySelector(".analysis-only").addEventListener("click",()=>box.remove());

    box.querySelector(".apply-focus").addEventListener("click",()=>{
      setActiveFocus(focus,urls);
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

  function setActiveFocus(focus,urls=[]){
    if(!focusSnapshots[PAGE]){
      focusSnapshots[PAGE]=snapshotFilters();
    }

    activeFocus=focus;
    focusRelevantUrls=Array.isArray(urls)?urls.slice(0,6):[];
    applyFocusToCurrentPage(false);
    saveSession();
  }

  function restoreFocusOnCurrentPage(){
    if(!activeFocus) return;

    if(!focusSnapshots[PAGE]){
      focusSnapshots[PAGE]=snapshotFilters();
    }

    applyFocusToCurrentPage(true);
    saveSession();
  }

  function applyFocusToCurrentPage(isRestore){
    if(!activeFocus) return;

    clearFocusVisualOnly();

    const exactInstitutions=Array.isArray(activeFocus.institutions)
      ? activeFocus.institutions
      : [];

    window.SPU_SOCIAL_AI_FILTER_OVERRIDE = exactInstitutions.length
      ? {institutions:[...exactInstitutions]}
      : null;

    const period=document.querySelector("#periodFilter");
    if(
      period &&
      [...period.options].some(o=>o.value===String(activeFocus.period))
    ){
      period.value=String(activeFocus.period);
      period.dispatchEvent(new Event("change",{bubbles:true}));
    }

    const platform=document.querySelector("#platformFilter");
    const p=Array.isArray(activeFocus.platforms)&&activeFocus.platforms.length===1
      ? activeFocus.platforms[0]
      : "all";

    if(platform && [...platform.options].some(o=>o.value===p)){
      platform.value=p;
      platform.dispatchEvent(new Event("change",{bubbles:true}));
    }

    const selectedPeers=new Set(exactInstitutions.filter(x=>x!=="SPU"));

    document.querySelectorAll('#institutionMultiMenu input[type="checkbox"]').forEach(cb=>{
      cb.checked = window.SPU_SOCIAL_FILTER_MODE==="comparison"
        ? selectedPeers.has(cb.value)
        : exactInstitutions.includes(cb.value);
    });

    const anyCb=document.querySelector('#institutionMultiMenu input[type="checkbox"]');
    if(anyCb){
      anyCb.dispatchEvent(new Event("change",{bubbles:true}));
    }

    setTimeout(()=>{
      let n=1;

      const targets=[...new Set(activeFocus.highlights||[])];

      targets.forEach(target=>{
        const els=[...document.querySelectorAll(`[data-ai-target="${CSS.escape(target)}"]`)];

        els.forEach(el=>{
          el.classList.add("ai-highlight");
          el.setAttribute("data-ai-number",String(n));
        });

        if(els.length) n++;
      });

      focusRelevantUrls.forEach(url=>{
        const el=[...document.querySelectorAll('.post-card[data-post-url]')]
          .find(x=>x.dataset.postUrl===url);

        if(el && !el.classList.contains("ai-highlight")){
          el.classList.add("ai-highlight");
          el.setAttribute("data-ai-number",String(n++));
        }
      });

      const bar=document.querySelector("#aiFocusBar");
      const text=document.querySelector("#aiFocusText");

      if(text){
        text.innerHTML = `${esc(exactInstitutions.join(" + ") || "ข้อมูลที่เลือก")} · ${esc((activeFocus.platforms||[]).map(platformLabel).join(" + ") || "ทุกช่องทาง")}
          <div class="ai-focus-persistent-note">กด − ที่ Chat เพื่อซ่อนและดู Dashboard ได้เต็มพื้นที่</div>`;
      }

      if(bar) bar.hidden=false;

      // Do not auto-scroll when restoring across pages.
      if(!isRestore){
        const first=document.querySelector(".ai-highlight");
        if(first) first.scrollIntoView({behavior:"smooth",block:"center"});
      }
    },180);
  }

  function clearFocusVisualOnly(){
    document.querySelectorAll(".ai-highlight").forEach(el=>{
      el.classList.remove("ai-highlight");
      el.removeAttribute("data-ai-number");
    });

    const bar=document.querySelector("#aiFocusBar");
    if(bar) bar.hidden=true;
  }

  function restoreCurrentPageSnapshot(){
    const snap=focusSnapshots[PAGE];
    if(!snap) return;

    window.SPU_SOCIAL_AI_FILTER_OVERRIDE=snap.override || null;

    const period=document.querySelector("#periodFilter");
    const platform=document.querySelector("#platformFilter");

    if(period){
      period.value=snap.period;
      period.dispatchEvent(new Event("change",{bubbles:true}));
    }

    if(platform){
      platform.value=snap.platform;
      platform.dispatchEvent(new Event("change",{bubbles:true}));
    }

    const selected=new Set(snap.checkedInstitutions||[]);

    document.querySelectorAll('#institutionMultiMenu input[type="checkbox"]').forEach(cb=>{
      cb.checked=selected.has(cb.value);
    });

    const anyCb=document.querySelector('#institutionMultiMenu input[type="checkbox"]');
    if(anyCb){
      anyCb.dispatchEvent(new Event("change",{bubbles:true}));
    }

    delete focusSnapshots[PAGE];
  }

  function clearFocusAndRestore(clearGlobally){
    clearFocusVisualOnly();
    restoreCurrentPageSnapshot();

    if(clearGlobally){
      activeFocus=null;
      focusRelevantUrls=[];
      window.SPU_SOCIAL_AI_FILTER_OVERRIDE=null;
      // Other pages reload from their normal dashboard state when visited again.
      focusSnapshots={};
    }

    saveSession();
  }

  function platformLabel(p){
    return p==="instagram"?"Instagram":p==="facebook"?"Facebook":(p||"ทุกช่องทาง");
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",()=>setTimeout(mount,300));
  }else{
    setTimeout(mount,300);
  }
})();
