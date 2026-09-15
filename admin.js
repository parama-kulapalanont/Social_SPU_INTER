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

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Bangkok"
  }).format(date);
}

function statusLabel(status) {
  const labels = {
    active: "กำลังทำงาน",
    completed: "เสร็จแล้ว",
    completed_with_errors: "เสร็จพร้อมข้อผิดพลาด"
  };

  return labels[status] || status || "ยังไม่มี Batch";
}

function stopPolling() {
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

function schedulePolling(delay = 3000) {
  stopPolling();

  pollTimer = setTimeout(async () => {
    await loadCollectionStatus(currentBatchId);
  }, delay);
}

async function currentSession() {
  const { data, error } = await db.auth.getSession();

  if (error) {
    throw error;
  }

  return data.session;
}

async function invokeControl(body) {
  const { data, error } = await db.functions.invoke(
    "social-collection-control",
    { body }
  );

  if (error) {
    let message = error.message || "ไม่สามารถเรียก Social Collection Control ได้";

    try {
      const context = error.context;

      if (context && typeof context.json === "function") {
        const payload = await context.json();

        if (payload?.message) message = payload.message;
        else if (payload?.error) message = payload.error;
      }
    } catch {
      // ใช้ข้อความ error เดิม
    }

    const wrapped = new Error(message);
    wrapped.original = error;
    throw wrapped;
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
  const percent = total > 0
    ? Math.min(100, Math.round((finished / total) * 100))
    : 0;

  currentBatchId = batch?.batch_id || null;

  $("#batchStatus").textContent = statusLabel(batch?.status);
  $("#completedCount").textContent = completed;
  $("#runningCount").textContent = dispatched;
  $("#pendingCount").textContent = pending;
  $("#failedCount").textContent = failed;

  $("#progressLabel").textContent = `${finished} / ${total} Sources`;
  $("#progressPercent").textContent = `${percent}%`;
  $("#progressBar").style.width = `${percent}%`;

  const progressTrack = $(".progress-track");
  progressTrack?.setAttribute("aria-valuenow", String(percent));

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
    } else if (!batch) {
      setMessage("ยังไม่มี Batch ล่าสุด กด “ดึงข้อมูลใหม่” เพื่อเริ่ม", "info");
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

    return payload;
  } catch (error) {
    stopPolling();

    const message = error.message || "โหลดสถานะไม่สำเร็จ";

    if (/forbidden|not allowed|ไม่มีสิทธิ์/i.test(message)) {
      $("#adminApp").classList.add("hidden");
      $("#forbiddenPanel").classList.remove("hidden");
      $("#forbiddenMessage").textContent = message;
      return null;
    }

    setMessage(message, "error");
    throw error;
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
    const payload = await invokeControl({
      action: "start"
    });

    renderBatchStatus(payload);
  } catch (error) {
    setMessage(error.message || "เริ่มดึงข้อมูลไม่สำเร็จ", "error");
  } finally {
    isStarting = false;

    if ($("#batchStatus").textContent !== "กำลังทำงาน") {
      button.disabled = false;
      button.textContent = "ดึงข้อมูลใหม่";
    }
  }
}

async function refreshAuthUI() {
  stopPolling();

  const session = await currentSession();

  const loggedIn = !!session;

  $("#loginPanel").classList.toggle("hidden", loggedIn);
  $("#signOutBtn").classList.toggle("hidden", !loggedIn);
  $("#userBadge").classList.toggle("hidden", !loggedIn);

  if (!loggedIn) {
    $("#adminApp").classList.add("hidden");
    $("#forbiddenPanel").classList.add("hidden");
    $("#userBadge").textContent = "";
    return;
  }

  $("#userBadge").textContent = session.user?.email || "Signed in";
  $("#forbiddenPanel").classList.add("hidden");
  $("#adminApp").classList.remove("hidden");

  try {
    await loadCollectionStatus();
  } catch {
    // UI แสดง error อยู่แล้ว
  }
}

$("#loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = $("#email").value.trim();

  $("#loginMessage").textContent = "กำลังส่งลิงก์เข้าสู่ระบบ...";

  const { error } = await db.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${location.origin}${location.pathname}`
    }
  });

  $("#loginMessage").textContent = error
    ? error.message
    : "ส่ง Magic Link แล้ว กรุณาตรวจสอบอีเมล";
});

$("#signOutBtn").addEventListener("click", async () => {
  stopPolling();
  await db.auth.signOut();
  location.reload();
});

$("#startCollectionBtn").addEventListener("click", startCollection);

$("#refreshStatusBtn").addEventListener("click", async () => {
  setMessage("กำลังรีเฟรชสถานะ...", "info");

  try {
    await loadCollectionStatus(currentBatchId);
  } catch {
    // UI แสดง error อยู่แล้ว
  }
});

db.auth.onAuthStateChange((_event, session) => {
  if (!session) {
    stopPolling();
  }

  refreshAuthUI();
});

refreshAuthUI();
