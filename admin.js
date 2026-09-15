const cfg = window.SPU_SOCIAL_CONFIG || {};

if (!cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY) {
  throw new Error("Missing Supabase configuration in config.js");
}

const db = window.supabase.createClient(
  cfg.SUPABASE_URL,
  cfg.SUPABASE_PUBLISHABLE_KEY
);

const $ = (selector) => document.querySelector(selector);

let pollTimer = null;
let currentBatchId = null;
let isStarting = false;

function setMessage(message = "", type = "") {
  const el = $("#statusMessage");
  el.textContent = message;
  el.className = `message ${type}`.trim();
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Bangkok"
  }).format(date);
}

function statusLabel(status) {
  return {
    active: "กำลังทำงาน",
    completed: "เสร็จแล้ว",
    completed_with_errors: "เสร็จพร้อมข้อผิดพลาด"
  }[status] || status || "ยังไม่มี Batch";
}

function stopPolling() {
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

function schedulePolling(delay = 3000) {
  stopPolling();
  pollTimer = setTimeout(() => loadCollectionStatus(currentBatchId), delay);
}

async function invokeControl(body) {
  const { data, error } = await db.functions.invoke(
    "social-collection-control",
    { body }
  );

  if (error) {
    let message = error.message || "ไม่สามารถเรียก Social Collection Control ได้";
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

function renderBatchStatus(payload) {
  const batch = payload?.batch || null;
  const progress = payload?.progress || {};

  const total = Number(progress.total || 0);
  const completed = Number(progress.completed || 0);
  const dispatched = Number(progress.dispatched || 0);
  const pending = Number(progress.pending || 0);
  const failed = Number(progress.failed || 0);
  const finished = completed + failed;
  const percent = total > 0 ? Math.min(100, Math.round((finished / total) * 100)) : 0;

  currentBatchId = batch?.batch_id || null;

  $("#batchStatus").textContent = statusLabel(batch?.status);
  $("#completedCount").textContent = completed;
  $("#runningCount").textContent = dispatched;
  $("#pendingCount").textContent = pending;
  $("#failedCount").textContent = failed;

  $("#progressLabel").textContent = `${finished} / ${total} Sources`;
  $("#progressPercent").textContent = `${percent}%`;
  $("#progressBar").style.width = `${percent}%`;
  $(".progress-track")?.setAttribute("aria-valuenow", String(percent));

  $("#batchId").textContent = batch?.batch_id || "—";
  $("#batchStarted").textContent = formatDate(batch?.started_at);
  $("#batchFinished").textContent = formatDate(batch?.finished_at);

  const active = batch?.status === "active";
  const button = $("#startCollectionBtn");

  button.disabled = active || isStarting;
  button.textContent = active
    ? `กำลังดึงข้อมูล... ${finished}/${total}`
    : "ดึงข้อมูลใหม่";

  if (active) {
    setMessage("กำลังทำงาน ระบบจะอัปเดตสถานะอัตโนมัติ", "info");
    schedulePolling(3000);
  } else {
    stopPolling();
    if (batch?.status === "completed") {
      setMessage(`Batch ล่าสุดเสร็จครบ ${completed}/${total} Sources`, "success");
    } else if (batch?.status === "completed_with_errors") {
      setMessage(`Batch จบแล้ว แต่มี ${failed} Source ที่ผิดพลาด`, "error");
    } else {
      setMessage("พร้อมดึงข้อมูล", "info");
    }
  }
}

async function loadCollectionStatus(batchId = null) {
  try {
    const payload = await invokeControl({
      action: "status",
      ...(batchId ? { batch_id: batchId } : {})
    });
    renderBatchStatus(payload);
  } catch (error) {
    stopPolling();
    setMessage(error.message || "โหลดสถานะไม่สำเร็จ", "error");
  }
}

async function startCollection() {
  if (isStarting) return;

  isStarting = true;
  const button = $("#startCollectionBtn");
  button.disabled = true;
  button.textContent = "กำลังสร้าง Batch...";
  setMessage("กำลังสร้าง Batch ใหม่...", "info");

  try {
    const payload = await invokeControl({ action: "start" });
    renderBatchStatus(payload);
  } catch (error) {
    setMessage(error.message || "เริ่มดึงข้อมูลไม่สำเร็จ", "error");
  } finally {
    isStarting = false;
  }
}

async function boot() {
  if (cfg.LOGIN_URL) $("#mainLoginLink").href = cfg.LOGIN_URL;
  stopPolling();

  // จุดสำคัญ: หน้านี้ไม่ Sign in, ไม่ส่ง Magic Link และไม่สร้าง Auth flow ใหม่
  const { data, error } = await db.auth.getSession();

  if (error) {
    $("#sessionNotice").classList.remove("hidden");
    return;
  }

  const session = data?.session;

  if (!session) {
    $("#sessionNotice").classList.remove("hidden");
    $("#adminApp").classList.add("hidden");
    $("#userBadge").classList.add("hidden");
    return;
  }

  $("#sessionNotice").classList.add("hidden");
  $("#userBadge").classList.remove("hidden");
  $("#userBadge").textContent = session.user?.email || "Admin";
  $("#adminApp").classList.remove("hidden");

  await loadCollectionStatus();
}

$("#startCollectionBtn").addEventListener("click", startCollection);

$("#refreshStatusBtn").addEventListener("click", () => {
  setMessage("กำลังรีเฟรชสถานะ...", "info");
  loadCollectionStatus(currentBatchId);
});

db.auth.onAuthStateChange((_event, session) => {
  if (!session) stopPolling();
  boot();
});

boot();
