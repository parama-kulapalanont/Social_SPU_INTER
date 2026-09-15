
const cfg = window.SPU_SOCIAL_CONFIG || {};
const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY);

const fmt = n => new Intl.NumberFormat("en-US").format(Number(n || 0));
const esc = s => String(s ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const interactions = r => Number(r.likes||0)+Number(r.comments||0)+Number(r.shares||0);
const instName = code => ({
  SPU:"Sripatum University", BU:"Bangkok University", DPU:"Dhurakij Pundit University",
  RSU:"Rangsit University", UTCC:"University of the Thai Chamber of Commerce",
  ABAC:"Assumption University", STIU:"Stamford International University", SU:"Siam University"
}[code] || code);

async function fetchRows(){
  const {data,error} = await sb.rpc("get_social_dashboard_posts");
  if(error) throw error;
  return Array.isArray(data)?data:[];
}

function aggregate(rows){
  const byInst={};
  for(const r of rows){
    const code=r.institution_code || "UNKNOWN";
    if(!byInst[code]) byInst[code]={code,posts:0,views:0,likes:0,comments:0,shares:0,fb:0,ig:0,rows:[]};
    const x=byInst[code];
    x.posts++; x.views+=Number(r.views||0); x.likes+=Number(r.likes||0); x.comments+=Number(r.comments||0); x.shares+=Number(r.shares||0);
    if(r.platform==="facebook") x.fb++; if(r.platform==="instagram") x.ig++;
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

function postCard(r, rank){
  const p = r.platform==="instagram" ? "Instagram":"Facebook";
  const cls = r.platform==="instagram" ? "ig":"fb";
  return `<article class="post-card">
    <div class="post-thumb">${esc(r.institution_code||"")} · ${esc(p)}</div>
    <div class="post-body">
      <div class="post-meta"><span>#${rank} <span class="badge ${cls}">${esc(p)}</span></span><span>${r.published_at?new Date(r.published_at).toLocaleDateString("th-TH"):""}</span></div>
      <div class="post-caption">${esc(r.caption||"-")}</div>
      <div class="post-metrics"><span>♥ ${fmt(r.likes)}</span><span>💬 ${fmt(r.comments)}</span><span>↗ ${fmt(r.shares)}</span></div>
    </div>
  </article>`;
}

function updateTimestamp(rows){
  const latest=rows.map(r=>r.last_collected_at).filter(Boolean).sort().at(-1);
  const el=document.querySelector("#lastUpdated");
  if(el) el.textContent=latest?`Updated ${new Date(latest).toLocaleString("th-TH",{timeZone:"Asia/Bangkok"})}`:"Updated —";
}
