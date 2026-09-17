
const cfg = window.SPU_SOCIAL_CONFIG || {};
const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY);

const fmt = n => new Intl.NumberFormat("en-US").format(Number(n || 0));
const esc = s => String(s ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const interactions = r => Number(r.likes||0)+Number(r.comments||0)+Number(r.shares||0);

const instName = code => ({
  SPU:"มหาวิทยาลัยศรีปทุม",
  BU:"มหาวิทยาลัยกรุงเทพ",
  DPU:"มหาวิทยาลัยธุรกิจบัณฑิตย์",
  RSU:"มหาวิทยาลัยรังสิต",
  UTCC:"มหาวิทยาลัยหอการค้าไทย",
  ABAC:"Assumption University",
  STIU:"Stamford International University",
  SU:"Siam University"
}[code] || code);

let __allRows = [];
let __postRegistry = {};
let __postCounter = 0;
let __filterState = {period:"all", platform:"all", institutions:[]};
let __filterOptions = {mode:"comparison"};

async function fetchRows(){
  const {data,error} = await sb.rpc("get_social_dashboard_posts_v2");
  if(error) throw error;
  __allRows = Array.isArray(data)?data:[];
  return __allRows;
}

function aggregate(rows){
  const byInst={};
  for(const r of rows){
    const code=r.institution_code || "UNKNOWN";
    if(!byInst[code]) byInst[code]={code,posts:0,views:0,likes:0,comments:0,shares:0,fb:0,ig:0,rows:[]};
    const x=byInst[code];
    x.posts++;
    x.views+=Number(r.views||0);
    x.likes+=Number(r.likes||0);
    x.comments+=Number(r.comments||0);
    x.shares+=Number(r.shares||0);
    if(r.platform==="facebook") x.fb++;
    if(r.platform==="instagram") x.ig++;
    x.rows.push(r);
  }
  for(const x of Object.values(byInst)){
    x.interactions=x.likes+x.comments+x.shares;
    x.interactionsPerPost=x.posts?x.interactions/x.posts:0;
    x.strongestPlatform=x.fb>=x.ig?"Facebook":"Instagram";
  }
  return byInst;
}

function topPosts(rows, limit=4){
  return [...rows].sort((a,b)=>interactions(b)-interactions(a)).slice(0,limit);
}

function registerPost(r){
  const key = `post_${++__postCounter}`;
  __postRegistry[key] = r;
  return key;
}

function platformLabel(platform){
  return platform==="instagram" ? "Instagram" : platform==="facebook" ? "Facebook" : (platform||"-");
}

function postCard(r, rank){
  const p = platformLabel(r.platform);
  const cls = r.platform==="instagram" ? "ig":"fb";
  const key = registerPost(r);

  const imageUrl = r.thumbnail_url || r.media_url || r.image_url || null;

  return `<article class="post-card" data-post-key="${key}" data-post-url="${esc(r.post_url||"")}" tabindex="0" role="button" aria-label="ดูรายละเอียด Post">
    <div class="post-thumb ${imageUrl ? "has-image" : ""}">
      ${imageUrl ? `<img src="${esc(imageUrl)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove();this.parentElement.classList.remove('has-image')">` : ""}
      <span>${esc(r.institution_code||"")} · ${esc(p)}</span>
    </div>
    <div class="post-body">
      <div class="post-meta">
        <span>#${rank} <span class="badge ${cls}">${esc(p)}</span></span>
        <span>${r.published_at?new Date(r.published_at).toLocaleDateString("th-TH"):"ไม่พบวันที่"}</span>
      </div>
      <div class="post-caption">${esc(r.caption||"-")}</div>
      <div class="post-metrics">
        <span>👁 ${fmt(r.views)}</span>
        <span>♥ ${fmt(r.likes)}</span>
        <span>💬 ${fmt(r.comments)}</span>
        <span>↗ ${fmt(r.shares)}</span>
      </div>
      <div class="post-hint">กดเพื่อดูรายละเอียด Post</div>
    </div>
  </article>`;
}

function updateTimestamp(rows){
  const latest=rows.map(r=>r.last_collected_at).filter(Boolean).sort().at(-1);
  const el=document.querySelector("#lastUpdated");
  if(el) el.textContent=latest
    ? `อัปเดตล่าสุด ${new Date(latest).toLocaleString("th-TH",{timeZone:"Asia/Bangkok"})}`
    : "ยังไม่มีข้อมูลการอัปเดต";
}

function countVisibleSources(rows){
  return new Set(rows.map(r=>`${r.institution_code||"UNKNOWN"}|${r.platform||"UNKNOWN"}`)).size;
}

function ensurePostModal(){
  if(document.querySelector("#postDetailModal")) return;

  document.body.insertAdjacentHTML("beforeend", `
    <div id="postDetailModal" class="modal-backdrop" aria-hidden="true">
      <div class="post-modal" role="dialog" aria-modal="true" aria-labelledby="postModalTitle">
        <div class="post-modal-head">
          <div>
            <div class="eyebrow">POST DETAIL</div>
            <h2 id="postModalTitle">รายละเอียด Post</h2>
          </div>
          <button class="modal-close" id="postModalClose" aria-label="ปิด">×</button>
        </div>
        <div class="post-modal-body" id="postModalBody"></div>
      </div>
    </div>`);

  const modal = document.querySelector("#postDetailModal");
  const close = ()=> {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden","true");
    document.body.style.overflow="";
  };
  document.querySelector("#postModalClose").addEventListener("click", close);
  modal.addEventListener("click", e=>{ if(e.target===modal) close(); });
  document.addEventListener("keydown", e=>{ if(e.key==="Escape") close(); });
}

function openPostDetail(key){
  ensurePostModal();
  const r = __postRegistry[key];
  if(!r) return;

  const modal = document.querySelector("#postDetailModal");
  const body = document.querySelector("#postModalBody");
  const imageUrl = r.media_url || r.thumbnail_url || r.image_url || null;
  const platform = platformLabel(r.platform);
  const cls = r.platform==="instagram" ? "ig":"fb";
  const published = r.published_at
    ? new Date(r.published_at).toLocaleString("th-TH",{timeZone:"Asia/Bangkok"})
    : "ไม่พบวันที่เผยแพร่";
  const author = r.author_name || r.author_handle || "-";

  body.innerHTML = `
    <div class="post-detail-grid">
      <div class="post-media">
        ${imageUrl
          ? `<img src="${esc(imageUrl)}" alt="ภาพประกอบ Post" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.parentElement.innerHTML='<div class=&quot;media-placeholder&quot;>URL รูปภาพนี้ไม่สามารถโหลดได้แล้ว กรุณาเปิด Post ต้นฉบับ</div>'">`
          : `<div class="media-placeholder"><b>Post นี้ไม่มี URL รูปภาพ</b><br>สามารถเปิด Post ต้นฉบับจากปุ่มด้านขวาได้</div>`
        }
      </div>
      <div>
        <div class="detail-meta">
          <span class="badge">${esc(r.institution_code||"-")} · ${esc(instName(r.institution_code||""))}</span>
          <span class="badge ${cls}">${esc(platform)}</span>
          ${r.media_type ? `<span class="badge">${esc(r.media_type)}</span>` : ""}
        </div>

        <div style="font-size:12px;color:#64748b;margin-bottom:10px">
          <b>ผู้เผยแพร่:</b> ${esc(author)}<br>
          <b>วันที่เผยแพร่:</b> ${esc(published)}
        </div>

        <div class="detail-caption">${esc(r.caption||"ไม่มีข้อความ Caption")}</div>

        <div class="detail-metrics">
          <div class="detail-metric"><span>Views</span><b>${fmt(r.views)}</b></div>
          <div class="detail-metric"><span>Likes</span><b>${fmt(r.likes)}</b></div>
          <div class="detail-metric"><span>Comments</span><b>${fmt(r.comments)}</b></div>
          <div class="detail-metric"><span>Shares</span><b>${fmt(r.shares)}</b></div>
        </div>

        <div class="detail-actions">
          <button class="secondary-link" type="button" onclick="document.querySelector('#postModalClose').click()">ปิด</button>
          ${r.post_url
            ? `<a class="primary-link" href="${esc(r.post_url)}" target="_blank" rel="noopener noreferrer">ดู Post ต้นฉบับ ↗</a>`
            : `<span class="secondary-link" style="opacity:.55">ไม่มี URL ต้นฉบับ</span>`
          }
        </div>
      </div>
    </div>`;

  modal.classList.add("open");
  modal.setAttribute("aria-hidden","false");
  document.body.style.overflow="hidden";
}

function bindPostCards(){
  document.querySelectorAll(".post-card[data-post-key]").forEach(el=>{
    if(el.dataset.bound==="1") return;
    el.dataset.bound="1";
    el.addEventListener("click", ()=>openPostDetail(el.dataset.postKey));
    el.addEventListener("keydown", e=>{
      if(e.key==="Enter" || e.key===" "){
        e.preventDefault();
        openPostDetail(el.dataset.postKey);
      }
    });
  });
}

function filterRows(rows, state=__filterState, options=__filterOptions){
  const now = Date.now();
  const days = state.period==="all" ? null : Number(state.period);
  const selected = Array.isArray(state.institutions) ? state.institutions : [];

  return rows.filter(r=>{
    if(state.platform!=="all" && r.platform!==state.platform) return false;

    if(days){
      if(!r.published_at) return false;
      const t = new Date(r.published_at).getTime();
      if(Number.isNaN(t) || t < now - days*86400000) return false;
    }

    const aiOverride = window.SPU_SOCIAL_AI_FILTER_OVERRIDE;
    if(aiOverride && Array.isArray(aiOverride.institutions) && aiOverride.institutions.length){
      if(!aiOverride.institutions.includes(r.institution_code)) return false;
    } else if(selected.length){
      if(options.mode==="comparison"){
        if(r.institution_code!=="SPU" && !selected.includes(r.institution_code)) return false;
      } else {
        if(!selected.includes(r.institution_code)) return false;
      }
    }

    return true;
  });
}

function filterSummaryText(rows){
  const selected = Array.isArray(__filterState.institutions) ? __filterState.institutions : [];

  let instText;
  if(!selected.length){
    instText = __filterOptions.mode==="comparison" ? "SPU เทียบทุกสถาบัน" : "ทุกสถาบัน";
  } else if(__filterOptions.mode==="comparison"){
    instText = `SPU เทียบ ${selected.join(", ")}`;
  } else {
    instText = selected.join(", ");
  }

  const platform = __filterState.platform==="all" ? "ทุก Platform" : platformLabel(__filterState.platform);
  const period = __filterState.period==="all" ? "ข้อมูลทั้งหมด" : `${__filterState.period} วันล่าสุด`;

  return `${instText} · ${platform} · ${period} · ${fmt(rows.length)} Posts`;
}

function initFilters(rows, onChange, options={mode:"comparison"}){
  __filterOptions = options;

  const p = document.querySelector("#periodFilter");
  const pf = document.querySelector("#platformFilter");
  const institutionHost = document.querySelector("#institutionFilterHost");
  if(!p || !pf || !institutionHost) return;

  p.innerHTML = `
    <option value="all">ข้อมูลทั้งหมด</option>
    <option value="7">7 วันล่าสุด</option>
    <option value="30">30 วันล่าสุด</option>
    <option value="90">90 วันล่าสุด</option>`;

  pf.innerHTML = `
    <option value="all">ทุก Platform</option>
    <option value="facebook">Facebook</option>
    <option value="instagram">Instagram</option>`;

  const codes = [...new Set(rows.map(r=>r.institution_code).filter(Boolean))].sort((a,b)=>{
    if(a==="SPU") return -1;
    if(b==="SPU") return 1;
    return a.localeCompare(b);
  });

  const availableCodes = options.mode==="comparison"
    ? codes.filter(x=>x!=="SPU")
    : codes;

  institutionHost.innerHTML = `
    <div class="multi-select" id="institutionMulti">
      <button type="button" class="multi-select-btn" id="institutionMultiBtn" aria-expanded="false">
        <span class="label">${options.mode==="comparison" ? "ทุกสถาบันเปรียบเทียบ" : "ทุกสถาบัน"}</span>
        <span class="multi-select-count" id="institutionMultiCount">0</span>
      </button>
      <div class="multi-select-menu" id="institutionMultiMenu">
        <div class="multi-select-tools">
          <button type="button" id="selectAllInstitutions">เลือกทั้งหมด</button>
          <button type="button" id="clearInstitutions">ล้างที่เลือก</button>
        </div>
        ${availableCodes.map(code=>`
          <label class="multi-select-option">
            <input type="checkbox" value="${esc(code)}">
            <span><b>${esc(code)}</b><small>${esc(instName(code))}</small></span>
          </label>`).join("")}
      </div>
    </div>`;

  const multi = document.querySelector("#institutionMulti");
  const btn = document.querySelector("#institutionMultiBtn");
  const menu = document.querySelector("#institutionMultiMenu");
  const count = document.querySelector("#institutionMultiCount");
  const label = btn.querySelector(".label");

  const selectedCodes = () =>
    [...menu.querySelectorAll('input[type="checkbox"]:checked')].map(x=>x.value);

  const updateLabel = () => {
    const selected = selectedCodes();
    count.textContent = selected.length;

    if(!selected.length){
      label.textContent = options.mode==="comparison" ? "ทุกสถาบันเปรียบเทียบ" : "ทุกสถาบัน";
    } else if(selected.length <= 3){
      label.textContent = selected.join(", ");
    } else {
      label.textContent = `เลือกแล้ว ${selected.length} สถาบัน`;
    }
  };

  const fire = ()=>{
    __filterState = {
      period:p.value,
      platform:pf.value,
      institutions:selectedCodes()
    };

    // Expose the real dashboard filter state to the AI overlay.
    window.SPU_SOCIAL_FILTER_STATE = {
      period: __filterState.period,
      platform: __filterState.platform,
      institutions: [...__filterState.institutions]
    };
    window.SPU_SOCIAL_FILTER_MODE = options.mode;

    updateLabel();

    const filtered = filterRows(rows,__filterState,options);
    const summary = document.querySelector("#filterSummary");
    if(summary) summary.textContent = filterSummaryText(filtered);
    onChange(filtered,__filterState);
  };

  btn.addEventListener("click",()=>{
    const isOpen = multi.classList.toggle("open");
    btn.setAttribute("aria-expanded", String(isOpen));
  });

  menu.querySelectorAll('input[type="checkbox"]').forEach(cb=>{
    cb.addEventListener("change",fire);
  });

  document.querySelector("#selectAllInstitutions").addEventListener("click",()=>{
    menu.querySelectorAll('input[type="checkbox"]').forEach(cb=>cb.checked=true);
    fire();
  });

  document.querySelector("#clearInstitutions").addEventListener("click",()=>{
    menu.querySelectorAll('input[type="checkbox"]').forEach(cb=>cb.checked=false);
    fire();
  });

  document.addEventListener("click",e=>{
    if(!multi.contains(e.target)){
      multi.classList.remove("open");
      btn.setAttribute("aria-expanded","false");
    }
  });

  p.addEventListener("change",fire);
  pf.addEventListener("change",fire);

  fire();
}
