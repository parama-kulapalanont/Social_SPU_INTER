const cfg = window.SPU_SOCIAL_CONFIG || {};
const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({
  "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"
}[c]));

async function currentSession() {
  const { data } = await db.auth.getSession();
  return data.session;
}

async function isAdmin(session) {
  if (!session?.user?.email) return false;
  const { data, error } = await db
    .from("admins")
    .select("email")
    .eq("email", session.user.email)
    .maybeSingle();
  return !error && !!data;
}

async function refreshAuthUI() {
  const session = await currentSession();
  const admin = await isAdmin(session);

  $("#loginPanel").classList.toggle("hidden", admin);
  $("#adminApp").classList.toggle("hidden", !admin);
  $("#signOutBtn").classList.toggle("hidden", !session);

  if (admin) await loadSources();
}

$("#loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  const email = $("#email").value.trim();
  const { error } = await db.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: location.href }
  });
  $("#loginMessage").textContent = error
    ? error.message
    : "ส่งลิงก์เข้าสู่ระบบแล้ว กรุณาตรวจสอบอีเมล";
});

$("#signOutBtn").addEventListener("click", async () => {
  await db.auth.signOut();
  location.reload();
});

$("#addForm").addEventListener("submit", async e => {
  e.preventDefault();

  const payload = {
    platform: $("#platform").value,
    label: $("#label").value.trim(),
    source_url: $("#sourceUrl").value.trim(),
    post_limit: Number($("#postLimit").value || 20),
    enabled: true,
    collect_caption: true,
    collect_views: true,
    collect_likes: true,
    collect_comments: true,
    collect_shares: true
  };

  const { error } = await db.from("social_sources").insert(payload);
  if (error) return alert(error.message);

  e.target.reset();
  $("#postLimit").value = 20;
  await loadSources();
});

async function updateSource(id, patch) {
  const { error } = await db.from("social_sources").update(patch).eq("id", id);
  if (error) alert(error.message);
  else loadSources();
}

async function deleteSource(id, label) {
  if (!confirm(`ลบ ${label} และข้อมูลโพสต์ทั้งหมดของแหล่งนี้?`)) return;
  const { error } = await db.from("social_sources").delete().eq("id", id);
  if (error) alert(error.message);
  else loadSources();
}

async function runSource(id, button) {
  const session = await currentSession();
  button.disabled = true;
  button.textContent = "กำลังดึง...";

  try {
    const res = await fetch(cfg.EDGE_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
        "apikey": cfg.SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ source_id: id })
    });

    const out = await res.json();
    if (!res.ok) throw new Error(out.error || "Collect failed");
    alert(`ดึงข้อมูลสำเร็จ ${out.count} รายการ`);
  } catch (err) {
    alert(err.message);
  } finally {
    button.disabled = false;
    button.textContent = "Run now";
  }
}

async function loadSources() {
  const { data, error } = await db
    .from("social_sources")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    $("#sourceList").innerHTML = `<div class="empty">${esc(error.message)}</div>`;
    return;
  }

  $("#sourceList").innerHTML = (data || []).map(s => `
    <article class="source-card" data-id="${s.id}">
      <div class="source-main">
        <div>
          <div class="source-title">${esc(s.label)}</div>
          <div class="source-meta">${esc(s.platform.toUpperCase())} · ${esc(s.source_url)}</div>
        </div>
        <label class="switch-line">
          <input type="checkbox" ${s.enabled ? "checked" : ""} data-action="enabled">
          <span>Active</span>
        </label>
      </div>

      <div class="metric-controls">
        <label><input type="checkbox" ${s.collect_caption ? "checked" : ""} data-action="collect_caption"> Caption</label>
        <label><input type="checkbox" ${s.collect_views ? "checked" : ""} data-action="collect_views"> Views</label>
        <label><input type="checkbox" ${s.collect_likes ? "checked" : ""} data-action="collect_likes"> Likes</label>
        <label><input type="checkbox" ${s.collect_comments ? "checked" : ""} data-action="collect_comments"> Comments</label>
        <label><input type="checkbox" ${s.collect_shares ? "checked" : ""} data-action="collect_shares"> Shares</label>

        <label class="limit-label">
          Posts
          <input type="number" min="1" max="100" value="${s.post_limit}" data-action="post_limit">
        </label>
      </div>

      <div class="source-actions">
        <button data-run="${s.id}">Run now</button>
        <button class="danger" data-delete="${s.id}" data-label="${esc(s.label)}">Delete</button>
      </div>
    </article>
  `).join("") || `<div class="empty">ยังไม่มีแหล่งข้อมูล</div>`;

  document.querySelectorAll("[data-action]").forEach(el => {
    el.addEventListener("change", async () => {
      const card = el.closest(".source-card");
      const id = card.dataset.id;
      const field = el.dataset.action;
      const value = el.type === "checkbox" ? el.checked : Number(el.value);
      await updateSource(id, { [field]: value });
    });
  });

  document.querySelectorAll("[data-run]").forEach(btn => {
    btn.addEventListener("click", () => runSource(btn.dataset.run, btn));
  });

  document.querySelectorAll("[data-delete]").forEach(btn => {
    btn.addEventListener("click", () => deleteSource(btn.dataset.delete, btn.dataset.label));
  });
}

db.auth.onAuthStateChange(() => refreshAuthUI());
refreshAuthUI();
