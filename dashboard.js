const cfg = window.SPU_SOCIAL_CONFIG || {};
const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

const fmt = n => new Intl.NumberFormat("en-US").format(Number(n || 0));
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({
  "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"
}[c]));

function render(rows) {
  const sum = key => rows.reduce((a, r) => a + Number(r[key] || 0), 0);

  document.querySelector("#kpiPosts").textContent = fmt(rows.length);
  document.querySelector("#kpiViews").textContent = fmt(sum("view_count"));
  document.querySelector("#kpiLikes").textContent = fmt(sum("like_count"));
  document.querySelector("#kpiComments").textContent = fmt(sum("comment_count"));

  const grouped = {};
  for (const r of rows) {
    if (!grouped[r.platform]) grouped[r.platform] = [];
    grouped[r.platform].push(r);
  }

  document.querySelector("#platformCards").innerHTML =
    Object.entries(grouped).map(([platform, items]) => `
      <article class="platform-card">
        <span>${esc(platform.toUpperCase())}</span>
        <strong>${fmt(items.length)} posts</strong>
        <div>${fmt(items.reduce((a,x)=>a+Number(x.view_count||0),0))} views</div>
        <div>${fmt(items.reduce((a,x)=>a+Number(x.like_count||0),0))} likes</div>
      </article>
    `).join("") || `<div class="empty">ยังไม่มีข้อมูล</div>`;

  document.querySelector("#postRows").innerHTML = rows.slice(0,100).map(r => `
    <tr>
      <td>${esc(r.platform)}</td>
      <td>${esc(r.social_sources?.label || r.account_name || "-")}</td>
      <td class="caption">${esc(r.caption || "-")}</td>
      <td class="num">${fmt(r.view_count)}</td>
      <td class="num">${fmt(r.like_count)}</td>
      <td class="num">${fmt(r.comment_count)}</td>
      <td class="num">${fmt(r.share_count)}</td>
    </tr>
  `).join("");
}

async function loadDashboard() {
  const { data, error } = await db
    .from("social_posts")
    .select("platform,account_name,caption,view_count,like_count,comment_count,share_count,published_at,collected_at,social_sources(label,enabled)")
    .eq("social_sources.enabled", true)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(500);

  if (error) {
    document.querySelector("#lastUpdate").textContent = "โหลดข้อมูลไม่สำเร็จ";
    return;
  }

  const rows = (data || []).filter(r => r.social_sources?.enabled !== false);
  render(rows);

  const latest = rows
    .map(r => r.collected_at)
    .filter(Boolean)
    .sort()
    .at(-1);

  document.querySelector("#lastUpdate").textContent =
    latest ? `Updated ${new Date(latest).toLocaleString("th-TH")}` : "ยังไม่มีข้อมูล";
}

loadDashboard();
