const cfg = window.SPU_SOCIAL_CONFIG || {};

const supabaseClient = window.supabase.createClient(
  cfg.SUPABASE_URL,
  cfg.SUPABASE_PUBLISHABLE_KEY
);

const $ = selector => document.querySelector(selector);

let currentBatchId = null;
let pollTimer = null;
let isStarting = false;
let sources = [];
let logs = [];

/* -------------------------
   BASIC UI
------------------------- */

function showOnly(panel) {
  $("#loginPanel").classList.add("hidden");
  $("#forbiddenPanel").classList.add("hidden");
  $("#adminApp").classList.add("hidden");
  panel.classList.remove("hidden");
}

function showPage(name) {
  document.querySelectorAll(".page").forEach(el => el.classList.remove("active"));
  document.querySelectorAll(".nav button").forEach(el => {
    el.classList.toggle("active", el.dataset.page === name);
  });

  $(`#page-${name}`)?.classList.add("active");

  if (name === "sources") loadSources();
  if (name === "logs") loadLogs();
}

function setStatus(message = "", type = "") {
  const el = $("#statusMessage");
  el.textContent = message;
  el.className = `message ${type}`.trim();
}

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2200);
}

function openDrawer() {
  $("#drawer").classList.add("show");
}

function closeDrawer() {
  $("#drawer").classList.remove("show");
}

function formatDate(value, compact = false) {
  if (!value) return "—";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";

  return new Intl.DateTimeFormat("th-TH", compact
    ? {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Bangkok"
      }
    : {
        dateStyle: "medium",
        timeStyle: "medium",
        timeZone: "Asia/Bangkok"
      }
  ).format(d);
}

function statusLabel(status) {
  return {
    active: "กำลังทำงาน",
    completed: "เสร็จแล้ว",
    completed_with_errors: "เสร็จพร้อมข้อผิดพลาด"
  }[status] || status || "ยังไม่มี Batch";
}

function sourceStatusHtml(status) {
  if (status === "ok") return '<span class="status ok">● ปกติ</span>';
  if (status === "partial") return '<span class="status warn">● ไม่ครบ</span>';
  return '<span class="status err">● Error</span>';
}

function processStatusHtml(status) {
  if (status === "ok") return '<span class="status ok">สำเร็จ</span>';
  if (status === "partial") return '<span class="status warn">ไม่ครบ</span>';
  if (status === "error") return '<span class="status err">Error</span>';
  if (status === "running") return '<span class="status info">กำลังทำงาน</span>';
  return '<span class="status info">ยังไม่ทำ</span>';
}

function safeText(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* -------------------------
   AUTH
------------------------- */

async function checkAdmin(email) {
  const { data, error } = await supabaseClient
    .from("admins")
    .select("email")
    .eq("email", email.toLowerCase())
    .maybeSingle();

  if (error) {
    throw new Error("ไม่สามารถตรวจสอบสิทธิ์ Admin ได้: " + error.message);
  }

  return !!data;
}

async function boot() {
  stopPolling();

  const {
    data: { session }
  } = await supabaseClient.auth.getSession();

  if (!session) {
    showOnly($("#loginPanel"));
    return;
  }

  const email = (session.user.email || "").toLowerCase();

  try {
    const isAdmin = await checkAdmin(email);

    if (!isAdmin) {
      $("#forbiddenMessage").textContent = `บัญชี ${email} ไม่มีสิทธิ์ Admin`;
      showOnly($("#forbiddenPanel"));
      return;
    }

    $("#userBadge").textContent = email;
    $("#sideUserEmail").textContent = email;

    showOnly($("#adminApp"));

    await Promise.all([
      loadCollectionStatus(),
      loadSources()
    ]);

  } catch (error) {
    $("#forbiddenMessage").textContent = error.message;
    showOnly($("#forbiddenPanel"));
  }
}

$("#loginForm").addEventListener("submit", async event => {
  event.preventDefault();

  const email = $("#email").value.trim().toLowerCase();
  const password = $("#password").value;

  $("#loginMessage").textContent = "กำลังเข้าสู่ระบบ...";

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    $("#loginMessage").textContent = "เข้าสู่ระบบไม่สำเร็จ: " + error.message;
    return;
  }

  $("#loginMessage").textContent = "";
  await boot();
});

async function logout() {
  stopPolling();
  await supabaseClient.auth.signOut();
  location.reload();
}

$("#logoutBtn").addEventListener("click", logout);
$("#forbiddenLogoutBtn").addEventListener("click", logout);

/* -------------------------
   EDGE FUNCTIONS
------------------------- */

async function invokeFunction(name, body) {
  const { data, error } = await supabaseClient.functions.invoke(name, { body });

  if (error) {
    let message = error.message || `เรียก ${name} ไม่สำเร็จ`;

    try {
      if (error.context && typeof error.context.json === "function") {
        const payload = await error.context.json();
        message = payload?.message || payload?.error || message;
      }
    } catch {}

    throw new Error(message);
  }

  return data;
}

const invokeControl = body => invokeFunction("social-collection-control", body);
const invokeAdminConsole = body => invokeFunction("social-admin-console", body);

/* -------------------------
   BATCH STATUS
------------------------- */

function stopPolling() {
  if (pollTimer) clearTimeout(pollTimer);
  pollTimer = null;
}

function schedulePolling() {
  stopPolling();
  pollTimer = setTimeout(() => loadCollectionStatus(currentBatchId), 3000);
}

function renderBatch(payload) {
  const batch = payload?.batch || null;
  const progress = payload?.progress || {};

  const total = Number(progress.total || 0);
  const completed = Number(progress.completed || 0);
  const dispatched = Number(progress.dispatched || 0);
  const pending = Number(progress.pending || 0);
  const failed = Number(progress.failed || 0);
  const finished = completed + failed;
  const percent = total ? Math.round((finished / total) * 100) : 0;

  currentBatchId = batch?.batch_id || null;

  $("#batchId").textContent = batch?.batch_id || "—";
  $("#batchStarted").textContent = formatDate(batch?.started_at, true);
  $("#batchFinished").textContent = formatDate(batch?.finished_at, true);
  $("#batchStatus").textContent = statusLabel(batch?.status);
  $("#batchSubtitle").textContent = batch?.started_at
    ? `Manual Collection · ${formatDate(batch.started_at, true)}`
    : "Manual Collection";

  $("#progressText").textContent =
    `${finished} / ${total} Sources · ${failed} Error · ${pending} รอ`;
  $("#progressPct").textContent = `${percent}%`;
  $("#progressBar").style.width = `${percent}%`;

  const active = batch?.status === "active";

  $("#startCollectionBtn").disabled = active || isStarting;

  if (active) {
    $("#batchBadge").className = "status info";
    $("#batchBadge").textContent = `● กำลังทำงาน ${finished}/${total}`;
    $("#startCollectionBtn").textContent = "กำลังดึงข้อมูล...";
    setStatus("กำลังดึงข้อมูล ระบบจะอัปเดตอัตโนมัติ", "info");
    schedulePolling();
  } else {
    $("#startCollectionBtn").textContent = "ดึงข้อมูลใหม่";
    stopPolling();

    if (batch?.status === "completed") {
      $("#batchBadge").className = "status ok";
      $("#batchBadge").textContent = "● เสร็จสมบูรณ์";
      setStatus(`Batch ล่าสุดเสร็จครบ ${completed}/${total} Sources`, "success");
    } else if (batch?.status === "completed_with_errors") {
      $("#batchBadge").className = "status warn";
      $("#batchBadge").textContent = `● ผิดพลาด ${failed} Source`;
      setStatus(`Batch จบแล้ว แต่ผิดพลาด ${failed} Source`, "error");
    } else {
      $("#batchBadge").className = "status info";
      $("#batchBadge").textContent = "● พร้อมใช้งาน";
      setStatus("พร้อมดึงข้อมูล", "info");
    }
  }

  if (!active) loadSources();
}

async function loadCollectionStatus(batchId = null) {
  try {
    const payload = await invokeControl({
      action: "status",
      ...(batchId ? { batch_id: batchId } : {})
    });
    renderBatch(payload);
  } catch (error) {
    stopPolling();
    setStatus(error.message, "error");
  }
}

/* -------------------------
   SOURCES / OVERVIEW
------------------------- */

async function loadSources() {
  try {
    const payload = await invokeAdminConsole({ action: "sources" });
    sources = Array.isArray(payload?.sources) ? payload.sources : [];
    renderSourceTable();
    renderOverviewKpis();
    renderIssues();
  } catch (error) {
    setStatus(error.message, "error");
    $("#sourceRows").innerHTML =
      `<tr><td colspan="9">โหลด Sources ไม่สำเร็จ: ${safeText(error.message)}</td></tr>`;
  }
}

function renderOverviewKpis() {
  const ok = sources.filter(x => x.status === "ok").length;
  const issues = sources.length - ok;
  const apify = sources.reduce((sum, x) => sum + Number(x.apify_items || 0), 0);
  const newPosts = sources.reduce((sum, x) => sum + Number(x.new_saved || 0), 0);

  $("#kpiSources").textContent = sources.length;
  $("#kpiOk").textContent = ok;
  $("#kpiIssue").textContent = issues;
  $("#kpiApify").textContent = apify.toLocaleString();
  $("#kpiNew").textContent = newPosts.toLocaleString();
  $("#sourceCountBadge").textContent = `${sources.length} Sources`;
}

function renderIssues() {
  const items = sources.filter(x => x.status !== "ok");

  if (!items.length) {
    $("#issueList").innerHTML =
      '<div class="empty green">✓ ไม่มี Source ที่ต้องตรวจ</div>';
    return;
  }

  $("#issueList").innerHTML = items.map(source => {
    const detail = source.status === "error"
      ? (source.error_message || "Collection failed")
      : `Media ${source.media_ready}/${source.media_total} ยังไม่ครบ`;

    return `
      <div class="issue">
        <div>
          <strong>${safeText(source.institution_code)} · ${safeText(source.platform)}</strong>
          <small>${safeText(detail)}</small>
        </div>
        <button class="btn" type="button"
          data-open-source="${safeText(source.id)}">จัดการ</button>
      </div>`;
  }).join("");

  document.querySelectorAll("[data-open-source]").forEach(btn => {
    btn.addEventListener("click", () => openSource(btn.dataset.openSource));
  });
}

function renderSourceTable() {
  const q = ($("#sourceSearch").value || "").trim().toLowerCase();
  const platform = $("#platformFilter").value;
  const status = $("#statusFilter").value;

  const rows = sources.filter(source => {
    const searchable =
      `${source.institution_code} ${source.institution_name || ""} ${source.account_name || ""} ` +
      `${source.account_handle || ""} ${source.source_url || ""} ${source.platform}`.toLowerCase();

    return (!q || searchable.includes(q))
      && (!platform || source.platform === platform)
      && (!status || source.status === status);
  });

  if (!rows.length) {
    $("#sourceRows").innerHTML =
      '<tr><td colspan="9" class="empty">ไม่พบ Source ตามตัวกรอง</td></tr>';
    return;
  }

  $("#sourceRows").innerHTML = rows.map(source => {
    const platformClass = source.platform === "instagram" ? "ig" : "fb";
    const media = source.media_total > 0
      ? `${source.media_ready}/${source.media_total}`
      : "—";

    return `
      <tr>
        <td class="source">
          <strong>${safeText(source.institution_code)}</strong>
          <small>${safeText(source.account_handle || source.account_name || source.source_url)}</small>
        </td>
        <td>
          <span class="platform">
            <span class="dot ${platformClass}"></span>
            ${safeText(source.platform)}
          </span>
        </td>
        <td>${safeText(formatDate(source.last_finished_at || source.last_started_at, true))}</td>
        <td><strong>${Number(source.apify_items || 0).toLocaleString()}</strong></td>
        <td><strong class="green">${Number(source.new_saved || 0).toLocaleString()}</strong></td>
        <td>${Number(source.duplicate_count || 0).toLocaleString()}</td>
        <td>${safeText(media)}</td>
        <td>${sourceStatusHtml(source.status)}</td>
        <td>
          <button class="more-btn" type="button"
            title="รายละเอียด" data-source-menu="${safeText(source.id)}">⋮</button>
        </td>
      </tr>`;
  }).join("");

  document.querySelectorAll("[data-source-menu]").forEach(btn => {
    btn.addEventListener("click", () => openSource(btn.dataset.sourceMenu));
  });
}

function openSource(sourceId) {
  const source = sources.find(x => x.id === sourceId);
  if (!source) return;

  const mediaText = source.media_total > 0
    ? `${source.media_ready}/${source.media_total}`
    : "—";

  $("#drawerEyebrow").textContent = "SOURCE DETAIL";
  $("#drawerTitle").textContent =
    `${source.institution_code} · ${source.platform}`;
  $("#drawerSub").textContent =
    `${source.account_handle || source.account_name || source.source_url} · ` +
    `ล่าสุด ${formatDate(source.last_finished_at || source.last_started_at, true)}`;

  $("#drawerBody").innerHTML = `
    <div class="drawer-summary">
      <div class="sum"><span>Apify Items</span><strong>${Number(source.apify_items || 0)}</strong></div>
      <div class="sum"><span>New Saved</span><strong class="green">${Number(source.new_saved || 0)}</strong></div>
      <div class="sum"><span>Duplicate</span><strong>${Number(source.duplicate_count || 0)}</strong></div>
      <div class="sum"><span>Media</span><strong>${safeText(mediaText)}</strong></div>
    </div>

    <div class="process">
      <div class="process-item">
        <div>
          <strong>Apify Collect</strong>
          <small>${safeText(source.error_message || `Dataset returned ${source.apify_items || 0} items`)}</small>
        </div>
        ${processStatusHtml(source.collect_status)}
      </div>

      <div class="process-item">
        <div>
          <strong>Save + Dedupe</strong>
          <small>${Number(source.new_saved || 0)} new · ${Number(source.duplicate_count || 0)} duplicate</small>
        </div>
        ${processStatusHtml(source.collect_status === "error" ? "skip" : "ok")}
      </div>

      <div class="process-item">
        <div>
          <strong>Refresh Metrics</strong>
          <small>${Number(source.metrics_updated || 0)} posts with metric changes</small>
        </div>
        ${processStatusHtml(source.collect_status === "error" ? "skip" : "ok")}
      </div>

      <div class="process-item">
        <div>
          <strong>Media Resolve</strong>
          <small>${safeText(mediaText)}</small>
        </div>
        ${processStatusHtml(source.media_status)}
      </div>
    </div>

    <div class="policy">
      Collector จะดึง 30 โพสต์ล่าสุดของ Source นี้ทันทีทุกครั้ง
      โดยเริ่มจากโพสต์ล่าสุด และตรวจ Duplicate ก่อนบันทึก
    </div>`;

  let actions = '<button class="btn" type="button" id="drawerCloseAction">ปิด</button>';

  if (source.status === "error") {
    actions +=
      `<button class="btn pink" type="button" data-retry="${source.id}" data-scope="collect">
        Retry Apify Collect
      </button>`;
  }

  if (source.media_status === "partial") {
    const missing = Math.max(
      0,
      Number(source.media_total || 0) - Number(source.media_ready || 0)
    );

    actions +=
      `<button class="btn pink" type="button" data-retry="${source.id}" data-scope="media">
        Retry Media ${missing} รายการ
      </button>`;
  }

  actions +=
    `<button class="btn primary" type="button" data-retry="${source.id}" data-scope="full">
      ดึง Source นี้ใหม่ทั้งหมด
    </button>`;

  $("#drawerActions").innerHTML = actions;

  $("#drawerCloseAction").addEventListener("click", closeDrawer);

  document.querySelectorAll("[data-retry]").forEach(btn => {
    btn.addEventListener("click", () =>
      retrySource(btn.dataset.retry, btn.dataset.scope, btn)
    );
  });

  openDrawer();
}

async function retrySource(sourceId, scope, button) {
  const source = sources.find(x => x.id === sourceId);
  if (!source) return;

  const labels = {
    collect: "Retry Apify Collect",
    media: "Retry Media",
    full: "ดึง Source ใหม่ทั้งหมด"
  };

  const confirmMessage = scope === "full"
    ? `${labels[scope]}: ${source.institution_code} ${source.platform}\n\n` +
      `ระบบจะดึง 30 โพสต์ล่าสุดของ Source นี้`
    : `${labels[scope]}: ${source.institution_code} ${source.platform}`;

  if (!window.confirm(confirmMessage)) return;

  const old = button.textContent;
  button.disabled = true;
  button.textContent = "กำลังทำงาน...";

  try {
    const payload = await invokeAdminConsole({
      action: "retry_source",
      source_id: sourceId,
      scope
    });

    toast(payload?.message || "ทำงานสำเร็จ");
    closeDrawer();

    await Promise.all([
      loadSources(),
      loadLogs()
    ]);

    await loadCollectionStatus(currentBatchId);

  } catch (error) {
    alert("ทำงานไม่สำเร็จ: " + error.message);
  } finally {
    button.disabled = false;
    button.textContent = old;
  }
}

/* -------------------------
   FULL BATCH PREVIEW / START
------------------------- */

function openBatchPreview() {
  const enabled = sources.filter(x => x.enabled !== false);

  $("#drawerEyebrow").textContent = "COLLECTION PREVIEW";
  $("#drawerTitle").textContent = "ดึงข้อมูลใหม่";
  $("#drawerSub").textContent =
    `ระบบจะดึง ${enabled.length} Sources ที่เปิดใช้งานอยู่`;

  $("#drawerBody").innerHTML = `
    <div class="policy">
      นี่คือ Batch ปกติของระบบเดิม โดย social-collection-control จะจัดคิว
      แต่แต่ละ Source จะดึง 30 โพสต์ล่าสุดทันที ไม่มี Probe 5 อีกต่อไป
    </div>

    <div class="batch-preview">
      ${enabled.map(source => `
        <div class="preview">
          <strong>${safeText(source.institution_code)} · ${safeText(source.platform)}</strong>
          <span>Latest 30</span>
          <span>${source.status === "ok" ? "พร้อม" : "ตรวจได้"}</span>
        </div>
      `).join("")}
    </div>`;

  $("#drawerActions").innerHTML = `
    <button class="btn" type="button" id="cancelBatchBtn">ยกเลิก</button>
    <button class="btn pink" type="button" id="confirmBatchBtn">
      ยืนยันและเริ่มดึงข้อมูล
    </button>`;

  $("#cancelBatchBtn").addEventListener("click", closeDrawer);
  $("#confirmBatchBtn").addEventListener("click", startCollection);

  openDrawer();
}

async function startCollection() {
  if (isStarting) return;

  isStarting = true;
  closeDrawer();

  $("#startCollectionBtn").disabled = true;
  $("#startCollectionBtn").textContent = "กำลังสร้าง Batch...";
  setStatus("กำลังสร้าง Batch ใหม่...", "info");

  try {
    const payload = await invokeControl({ action: "start" });
    renderBatch(payload);
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    isStarting = false;
  }
}

/* -------------------------
   LOGS
------------------------- */

async function loadLogs() {
  try {
    const payload = await invokeAdminConsole({
      action: "logs",
      limit: 150
    });

    logs = Array.isArray(payload?.logs) ? payload.logs : [];
    renderLogs();

  } catch (error) {
    $("#logRows").innerHTML =
      `<tr><td colspan="9">โหลด Logs ไม่สำเร็จ: ${safeText(error.message)}</td></tr>`;
  }
}

function renderLogs() {
  const level = $("#logLevel").value;
  const q = ($("#logSearch").value || "").trim().toLowerCase();

  const rows = logs.filter(row => {
    const mappedLevel =
      row.status === "success"
        ? "SUCCESS"
        : row.status === "failed"
          ? "ERROR"
          : "RUNNING";

    const searchable =
      `${row.institution_code || ""} ${row.platform || ""} ` +
      `${row.run_mode || ""} ${row.error_message || ""}`.toLowerCase();

    return (!level || mappedLevel === level)
      && (!q || searchable.includes(q));
  });

  if (!rows.length) {
    $("#logRows").innerHTML =
      '<tr><td colspan="9" class="empty">ไม่พบ Log ตามตัวกรอง</td></tr>';
    return;
  }

  $("#logRows").innerHTML = rows.map(row => {
    const mappedLevel =
      row.status === "success"
        ? "SUCCESS"
        : row.status === "failed"
          ? "ERROR"
          : "RUNNING";

    const cls =
      mappedLevel === "SUCCESS"
        ? "log-success"
        : mappedLevel === "ERROR"
          ? "log-error"
          : "log-running";

    return `
      <tr>
        <td>${safeText(formatDate(row.started_at, true))}</td>
        <td class="loglevel ${cls}">${mappedLevel}</td>
        <td>${safeText(row.institution_code || "—")} · ${safeText(row.platform || "—")}</td>
        <td>${safeText(row.run_mode || "—")}</td>
        <td>${Number(row.fetched_count || 0)}</td>
        <td>${Number(row.new_count || 0)}</td>
        <td>${Number(row.duplicate_count || 0)}</td>
        <td>${safeText(row.error_message || `${Number(row.updated_count || 0)} metrics changed`)}</td>
        <td>
          ${row.source_id
            ? `<button class="btn" type="button" data-log-source="${safeText(row.source_id)}">ดู Source</button>`
            : "—"}
        </td>
      </tr>`;
  }).join("");

  document.querySelectorAll("[data-log-source]").forEach(btn => {
    btn.addEventListener("click", () => {
      showPage("sources");
      setTimeout(() => openSource(btn.dataset.logSource), 0);
    });
  });
}

function openFromLog(src) {
  const [inst, platform] = src.split(" ");
  const source = sources.find(x =>
    x.institution_code === inst && x.platform === platform
  );
  if (source) openSource(source.id);
}

/* -------------------------
   EVENTS
------------------------- */

document.querySelectorAll(".nav button").forEach(btn => {
  btn.addEventListener("click", () => showPage(btn.dataset.page));
});

$("#viewSourcesBtn").addEventListener("click", () => showPage("sources"));
$("#startCollectionBtn").addEventListener("click", openBatchPreview);

$("#refreshStatusBtn").addEventListener("click", async () => {
  await Promise.all([
    loadCollectionStatus(currentBatchId),
    loadSources()
  ]);
});

$("#refreshSourcesBtn").addEventListener("click", loadSources);
$("#refreshLogsBtn").addEventListener("click", loadLogs);

["sourceSearch", "platformFilter", "statusFilter"].forEach(id => {
  $(`#${id}`).addEventListener("input", renderSourceTable);
});

["logLevel", "logSearch"].forEach(id => {
  $(`#${id}`).addEventListener("input", renderLogs);
});

$("#closeDrawerBtn").addEventListener("click", closeDrawer);

$("#drawer").addEventListener("click", event => {
  if (event.target.id === "drawer") closeDrawer();
});

/* -------------------------
   INIT
------------------------- */

supabaseClient.auth.onAuthStateChange(() => {
  boot();
});

boot();
