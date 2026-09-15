const cfg = window.SPU_SOCIAL_CONFIG || {};
const $ = (s) => document.querySelector(s);

const isPlaceholder = (v) =>
  !v || String(v).startsWith("PASTE_");

if (isPlaceholder(cfg.SUPABASE_URL) || isPlaceholder(cfg.SUPABASE_PUBLISHABLE_KEY)) {
  $("#configError")?.classList.remove("hidden");
} else {
  startApp();
}

function startApp() {
  const db = window.supabase.createClient(
    cfg.SUPABASE_URL,
    cfg.SUPABASE_PUBLISHABLE_KEY
  );

  let pollTimer = null;
  let currentBatchId = null;
  let isStarting = false;

  const setMessage = (message = "", type = "") => {
    const el = $("#statusMessage");
    if (!el) return;
    el.textContent = message;
    el.className = `message ${type}`.trim();
  };

  const stopPolling = () => {
    if (pollTimer) clearTimeout(pollTimer);
    pollTimer = null;
  };

  const schedulePolling = () => {
    stopPolling();
    pollTimer = setTimeout(() => loadStatus(currentBatchId), 3000);
  };

  const fmtDate = (value) => {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat("th-TH", {
      dateStyle: "medium",
      timeStyle: "medium",
      timeZone: "Asia/Bangkok"
    }).format(d);
  };

  const statusLabel = (v) => ({
    active: "กำลังทำงาน",
    completed: "เสร็จแล้ว",
    completed_with_errors: "เสร็จพร้อมข้อผิดพลาด"
  })[v] || v || "ยังไม่มี Batch";

  async function invokeControl(body) {
    const { data, error } = await db.functions.invoke(
      "social-collection-control",
      { body }
    );

    if (error) {
      let message = error.message || "เรียก Social Collection Control ไม่สำเร็จ";

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

  function render(payload) {
    const batch = payload?.batch || null;
    const p = payload?.progress || {};

    const total = Number(p.total || 0);
    const completed = Number(p.completed || 0);
    const dispatched = Number(p.dispatched || 0);
    const pending = Number(p.pending || 0);
    const failed = Number(p.failed || 0);
    const finished = completed + failed;
    const percent = total
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
    $(".progress-track")?.setAttribute("aria-valuenow", String(percent));
    $("#batchId").textContent = batch?.batch_id || "—";
    $("#batchStarted").textContent = fmtDate(batch?.started_at);
    $("#batchFinished").textContent = fmtDate(batch?.finished_at);

    const active = batch?.status === "active";
    const btn = $("#startCollectionBtn");

    btn.disabled = active || isStarting;
    btn.textContent = active
      ? `กำลังดึงข้อมูล... ${finished}/${total}`
      : "ดึงข้อมูลใหม่";

    if (active) {
      setMessage("กำลังทำงาน ระบบจะอัปเดตสถานะอัตโนมัติ", "info");
      schedulePolling();
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

  async function loadStatus(batchId = null) {
    try {
      const payload = await invokeControl({
        action: "status",
        ...(batchId ? { batch_id: batchId } : {})
      });
      render(payload);
    } catch (err) {
      stopPolling();
      setMessage(err.message || "โหลดสถานะไม่สำเร็จ", "error");
    }
  }

  async function startCollection() {
    if (isStarting) return;

    isStarting = true;
    $("#startCollectionBtn").disabled = true;
    $("#startCollectionBtn").textContent = "กำลังสร้าง Batch...";
    setMessage("กำลังสร้าง Batch ใหม่...", "info");

    try {
      const payload = await invokeControl({ action: "start" });
      render(payload);
    } catch (err) {
      setMessage(err.message || "เริ่มดึงข้อมูลไม่สำเร็จ", "error");
    } finally {
      isStarting = false;
    }
  }

  async function signOut() {
    stopPolling();
    await db.auth.signOut();
    location.replace(cfg.ADMIN_URL || location.href);
  }

  async function loginWithGoogle() {
    $("#googleLoginBtn").disabled = true;
    $("#loginMessage").textContent = "กำลังเปิด Supabase Auth...";

    const { error } = await db.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: cfg.ADMIN_URL ||
          "https://parama-kulapalanont.github.io/Social_SPU_INTER/admin.html"
      }
    });

    if (error) {
      $("#googleLoginBtn").disabled = false;
      $("#loginMessage").textContent = error.message;
    }
  }

  async function boot() {
    stopPolling();

    const { data, error } = await db.auth.getSession();
    const session = data?.session || null;

    if (error || !session) {
      $("#loginPanel").classList.remove("hidden");
      $("#forbiddenPanel").classList.add("hidden");
      $("#adminApp").classList.add("hidden");
      $("#userBadge").classList.add("hidden");
      return;
    }

    const email = (session.user?.email || "").toLowerCase();

    $("#loginPanel").classList.add("hidden");
    $("#forbiddenPanel").classList.add("hidden");
    $("#adminApp").classList.remove("hidden");
    $("#userBadge").classList.remove("hidden");
    $("#userBadge").textContent = email || "Admin";

    await loadStatus();
  }

  $("#googleLoginBtn").addEventListener("click", loginWithGoogle);
  $("#startCollectionBtn").addEventListener("click", startCollection);
  $("#refreshStatusBtn").addEventListener("click", () => loadStatus(currentBatchId));
  $("#signOutBtn").addEventListener("click", signOut);
  $("#signOutForbiddenBtn").addEventListener("click", signOut);

  db.auth.onAuthStateChange((_event, session) => {
    if (!session) stopPolling();
    boot();
  });

  boot();
}
