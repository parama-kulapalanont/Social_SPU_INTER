const cfg = window.SPU_SOCIAL_CONFIG || {};
const statusEl = document.querySelector("#lastUpdate");

if (!cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY) {
  statusEl.textContent = "ตั้งค่า Supabase ไม่ครบ";
  throw new Error("Missing Supabase configuration");
}

const db = window.supabase.createClient(
  cfg.SUPABASE_URL,
  cfg.SUPABASE_PUBLISHABLE_KEY
);

const fmt = n => new Intl.NumberFormat("en-US").format(Number(n || 0));
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({
  "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"
}[c]));

function render(rows) {
  const sum = key => rows.reduce((a, r) => a + Number(r[key] || 0), 0);

  document.querySelector("#kpiPosts").textContent = fmt(rows.length);
  document.querySelector("#kpiViews").textContent = fmt(sum("views"));
  document.querySelector("#kpiLikes").textContent = fmt(sum("likes"));
  document.querySelector("#kpiComments").textContent = fmt(sum("comments"));

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
        <div>${fmt(items.reduce((a,x)=>a+Number(x.views||0),0))} views</div>
        <div>${fmt(items.reduce((a,x)=>a+Number(x.likes||0),0))} likes</div>
      </article>
    `).join("") || `<div class="empty">ยังไม่มีข้อมูลที่เปิดให้ Dashboard อ่าน</div>`;

  document.querySelector("#postRows").innerHTML = rows.slice(0,100).map(r => `
    <tr>
      <td>${esc(r.platform)}</td>
      <td>${esc(r.author_name || r.author_handle || "-")}</td>
      <td class="caption">${esc(r.caption || "-")}</td>
      <td class="num">${fmt(r.views)}</td>
      <td class="num">${fmt(r.likes)}</td>
      <td class="num">${fmt(r.comments)}</td>
      <td class="num">${fmt(r.shares)}</td>
    </tr>
  `).join("");
}

async function loadDashboard() {
  statusEl.textContent = "กำลังโหลด...";

  const { data, error } = await db
    .from("social_posts")
    .select("platform,author_name,author_handle,caption,views,likes,comments,shares,published_at,last_collected_at")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(500);

  if (error) {
    console.error(error);
    statusEl.textContent = "Dashboard ยังไม่ได้รับสิทธิ์อ่านข้อมูล";
    document.querySelector("#platformCards").innerHTML =
      `<div class="empty">Collector ทำงานได้ แต่ Public Dashboard ยังถูก RLS ป้องกันอยู่</div>`;
    return;
  }

  const rows = data || [];
  render(rows);

  const latest = rows
    .map(r => r.last_collected_at)
    .filter(Boolean)
    .sort()
    .at(-1);

  statusEl.textContent =
    latest ? `Updated ${new Date(latest).toLocaleString("th-TH")}` : "ยังไม่มีข้อมูล";
}

loadDashboard();
