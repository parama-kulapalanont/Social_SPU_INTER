
const cfg = window.SPU_SOCIAL_CONFIG || {};
const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY);

const fmt = n => new Intl.NumberFormat("en-US").format(Number(n || 0));
const esc = s => String(s ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const instName = code => ({
  SPU:"มหาวิทยาลัยศรีปทุม", BU:"มหาวิทยาลัยกรุงเทพ", DPU:"มหาวิทยาลัยธุรกิจบัณฑิตย์",
  RSU:"มหาวิทยาลัยรังสิต", UTCC:"มหาวิทยาลัยหอการค้าไทย", ABAC:"Assumption University",
  STIU:"Stamford International University", SU:"Siam University"
}[code] || code);
const platformLabel = p => p === "instagram" ? "Instagram" : p === "facebook" ? "Facebook" : p || "-";

let rows = [];
let likesChart = null;
let commentsChart = null;

function thDate(value, withTime=false){
  if(!value) return "-";
  const opts = withTime
    ? {timeZone:"Asia/Bangkok",dateStyle:"medium",timeStyle:"short"}
    : {timeZone:"Asia/Bangkok",dateStyle:"medium"};
  return new Date(value).toLocaleString("th-TH",opts);
}

function socialEmbedUrl(r){
  const url = r?.post_url;
  if(!url) return null;
  try{
    if(r.platform === "instagram"){
      const u = new URL(url);
      const path = u.pathname.replace(/\/+$/, "");
      if(/^\/(p|reel|tv)\//i.test(path)) return `https://www.instagram.com${path}/embed/`;
    }
    if(r.platform === "facebook"){
      return `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(url)}&show_text=true&width=500`;
    }
  }catch{}
  return null;
}

function mediaMarkup(r){
  const imageUrl = r.media_url || r.thumbnail_url || null;
  const embed = socialEmbedUrl(r);
  if(imageUrl){
    return `<img id="historyDetailImage" src="${esc(imageUrl)}" alt="ภาพประกอบ Post" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-embed="${esc(embed||"")}">`;
  }
  if(embed){
    return `<div class="history-embed"><iframe src="${esc(embed)}" title="Post ต้นฉบับ" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share" allowfullscreen></iframe></div>`;
  }
  return `<div class="thumb-fallback">ไม่มี URL รูปภาพ แต่ยังสามารถเปิด Post ต้นฉบับได้</div>`;
}

async function loadRows(){
  const status = document.querySelector("#historyStatus");
  status.textContent = "กำลังโหลด...";
  const {data,error} = await sb.rpc("get_social_post_history_list");
  if(error) throw error;
  rows = Array.isArray(data) ? data : [];
  buildInstitutionFilter();
  render();
  status.textContent = rows.length ? `ข้อมูล ${fmt(rows.length)} Posts` : "ยังไม่มีข้อมูล";
}

function buildInstitutionFilter(){
  const select = document.querySelector("#historyInstitution");
  const codes = [...new Set(rows.map(r=>r.institution_code).filter(Boolean))].sort();
  select.innerHTML = `<option value="all">ทุกมหาวิทยาลัย</option>` + codes.map(code=>`<option value="${esc(code)}">${esc(code)} · ${esc(instName(code))}</option>`).join("");
}

function filteredRows(){
  const inst = document.querySelector("#historyInstitution").value;
  const platform = document.querySelector("#historyPlatform").value;
  const q = document.querySelector("#historySearch").value.trim().toLowerCase();
  const sort = document.querySelector("#historySort").value;

  const result = rows.filter(r=>{
    if(inst !== "all" && r.institution_code !== inst) return false;
    if(platform !== "all" && r.platform !== platform) return false;
    if(q){
      const hay = `${r.caption||""} ${r.post_url||""} ${r.author_name||""} ${r.author_handle||""}`.toLowerCase();
      if(!hay.includes(q)) return false;
    }
    return true;
  });

  result.sort((a,b)=>{
    if(sort === "likes_desc") return Number(b.likes||0)-Number(a.likes||0);
    if(sort === "collected_desc") return new Date(b.last_collected_at||0)-new Date(a.last_collected_at||0);
    return new Date(b.published_at||b.last_collected_at||0)-new Date(a.published_at||a.last_collected_at||0);
  });
  return result;
}

function card(r){
  const imageUrl = r.thumbnail_url || r.media_url || null;
  return `<article class="history-card" data-post-id="${esc(r.id)}" tabindex="0" role="button">
    <div class="history-thumb">
      ${imageUrl
        ? `<img src="${esc(imageUrl)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove();this.parentElement.innerHTML='<div class=&quot;thumb-fallback&quot;>กดเพื่อดูจาก Post ต้นฉบับ</div>'">`
        : `<div class="thumb-fallback">กดเพื่อดูจาก Post ต้นฉบับ</div>`}
    </div>
    <div class="history-card-body">
      <div class="history-card-top"><b>${esc(r.institution_code||"-")}</b><span class="badge ${r.platform==='instagram'?'ig':'fb'}">${esc(platformLabel(r.platform))}</span></div>
      <div class="history-card-caption">${esc(r.caption||"ไม่มี Caption")}</div>
      <div class="history-card-metrics">
        <div><span>Likes</span><b>${fmt(r.likes)}</b></div>
        <div><span>Comments</span><b>${fmt(r.comments)}</b></div>
      </div>
      <div class="history-card-meta">
        <span>เผยแพร่ ${esc(thDate(r.published_at))}</span>
        <span>ดึงล่าสุด ${esc(thDate(r.last_collected_at,true))}</span>
        <span>${fmt(r.history_points)} จุดประวัติ</span>
      </div>
    </div>
  </article>`;
}

function render(){
  const data = filteredRows();
  const grid = document.querySelector("#historyGrid");
  const empty = document.querySelector("#historyEmpty");
  const inst = document.querySelector("#historyInstitution").value;
  document.querySelector("#historySummary").textContent = `${inst==='all'?'ทุกมหาวิทยาลัย':inst} · ${fmt(data.length)} Posts`;
  grid.innerHTML = data.map(card).join("");
  empty.hidden = data.length > 0;

  grid.querySelectorAll(".history-card").forEach(el=>{
    const open = ()=>openDetail(el.dataset.postId);
    el.addEventListener("click",open);
    el.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();open();}});
  });
}

async function openDetail(postId){
  const r = rows.find(x=>x.id===postId);
  if(!r) return;

  const modal = document.querySelector("#historyModal");
  const detail = document.querySelector("#historyDetail");
  modal.classList.add("open");
  modal.setAttribute("aria-hidden","false");
  document.body.style.overflow="hidden";

  detail.innerHTML = `<div class="history-detail"><div class="history-summary">กำลังโหลดประวัติ Metrics...</div></div>`;

  const {data: history,error} = await sb.rpc("get_social_post_metric_history",{p_post_id:postId});
  const points = error ? [] : (Array.isArray(history)?history:[]);

  detail.innerHTML = `<div class="history-detail">
    <div class="history-detail-head">
      <div class="history-detail-media" id="historyDetailMedia">${mediaMarkup(r)}</div>
      <div class="history-detail-copy">
        <div class="history-badges">
          <span class="history-badge">${esc(r.institution_code||"-")} · ${esc(instName(r.institution_code||""))}</span>
          <span class="history-badge">${esc(platformLabel(r.platform))}</span>
          ${r.media_type?`<span class="history-badge">${esc(r.media_type)}</span>`:""}
        </div>
        <h2>${esc(r.author_name || r.author_handle || "Post")}</h2>
        <p>${esc(r.caption || "ไม่มี Caption")}</p>
        <div class="history-kpis">
          <div class="history-kpi"><span>Views</span><b>${fmt(r.views)}</b></div>
          <div class="history-kpi"><span>Likes</span><b>${fmt(r.likes)}</b></div>
          <div class="history-kpi"><span>Comments</span><b>${fmt(r.comments)}</b></div>
          <div class="history-kpi"><span>Shares</span><b>${fmt(r.shares)}</b></div>
        </div>
        <div class="history-info">
          วันที่เผยแพร่: <b>${esc(thDate(r.published_at,true))}</b><br>
          ดึงเข้าระบบครั้งแรก: <b>${esc(thDate(r.first_collected_at,true))}</b><br>
          ดึงล่าสุด: <b>${esc(thDate(r.last_collected_at,true))}</b><br>
          จำนวนจุดประวัติ: <b>${fmt(points.length)}</b>
        </div>
        <div class="history-actions">
          ${r.post_url?`<a href="${esc(r.post_url)}" target="_blank" rel="noopener noreferrer">เปิด Post ต้นฉบับ ↗</a>`:""}
        </div>
      </div>
    </div>

    <section class="history-chart-section">
      <h3>ประวัติผลตอบรับของ Post</h3>
      <p>แกนนอนคือวันที่ระบบดึงข้อมูล Post แต่ละครั้ง</p>
      <div class="history-chart-grid">
        <div class="history-chart-card"><h4>Likes</h4><div class="history-chart-wrap"><canvas id="likesHistoryChart"></canvas></div></div>
        <div class="history-chart-card"><h4>Comments</h4><div class="history-chart-wrap"><canvas id="commentsHistoryChart"></canvas></div></div>
      </div>
      <div class="history-history-note">${points.length>1 ? `มีข้อมูลประวัติ ${fmt(points.length)} จุด` : `Post นี้มีข้อมูลประวัติ ${fmt(points.length)} จุด จึงยังเห็นแนวโน้มได้จำกัด`}</div>
    </section>
  </div>`;

  const img = detail.querySelector("#historyDetailImage");
  if(img){
    img.addEventListener("error",()=>{
      const src = img.dataset.embed;
      const host = detail.querySelector("#historyDetailMedia");
      if(src && host){
        host.innerHTML = `<div class="history-embed"><iframe src="${esc(src)}" title="Post ต้นฉบับ" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share" allowfullscreen></iframe></div>`;
      }else if(host){
        host.innerHTML = `<div class="thumb-fallback">URL รูปภาพโหลดไม่ได้ กรุณาเปิด Post ต้นฉบับ</div>`;
      }
    },{once:true});
  }

  drawCharts(points);
}

function drawCharts(points){
  if(likesChart){likesChart.destroy();likesChart=null;}
  if(commentsChart){commentsChart.destroy();commentsChart=null;}
  const labels = points.map(p=>thDate(p.observed_at,true));
  const baseOptions = {
    responsive:true,
    maintainAspectRatio:false,
    interaction:{mode:"index",intersect:false},
    plugins:{legend:{display:false}},
    scales:{x:{ticks:{maxRotation:0,autoSkip:true,maxTicksLimit:8}},y:{beginAtZero:true}}
  };

  likesChart = new Chart(document.querySelector("#likesHistoryChart"),{
    type:"line",
    data:{labels,datasets:[{label:"Likes",data:points.map(p=>p.likes)}]},
    options:baseOptions
  });

  commentsChart = new Chart(document.querySelector("#commentsHistoryChart"),{
    type:"line",
    data:{labels,datasets:[{label:"Comments",data:points.map(p=>p.comments)}]},
    options:baseOptions
  });
}

function closeDetail(){
  document.querySelector("#historyModal").classList.remove("open");
  document.querySelector("#historyModal").setAttribute("aria-hidden","true");
  document.body.style.overflow="";
  if(likesChart){likesChart.destroy();likesChart=null;}
  if(commentsChart){commentsChart.destroy();commentsChart=null;}
}

document.querySelector("#historyClose").addEventListener("click",closeDetail);
document.querySelector("#historyModal").addEventListener("click",e=>{if(e.target.id==="historyModal") closeDetail();});
document.addEventListener("keydown",e=>{if(e.key==="Escape") closeDetail();});
["historyInstitution","historyPlatform","historySort"].forEach(id=>document.querySelector(`#${id}`).addEventListener("change",render));
document.querySelector("#historySearch").addEventListener("input",render);

loadRows().catch(err=>{
  console.error(err);
  document.querySelector("#historyStatus").textContent = "โหลดข้อมูลไม่สำเร็จ";
  document.querySelector("#historySummary").textContent = err?.message || String(err);
});
