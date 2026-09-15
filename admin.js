const cfg = window.SPU_SOCIAL_CONFIG || {};

const supabaseClient = window.supabase.createClient(
  cfg.SUPABASE_URL,
  cfg.SUPABASE_PUBLISHABLE_KEY
);

const $ = selector => document.querySelector(selector);

let currentBatchId = null;
let pollTimer = null;
let isStarting = false;


/* -------------------------
   UI
------------------------- */

function showOnly(panel) {
  $("#loginPanel").classList.add("hidden");
  $("#forbiddenPanel").classList.add("hidden");
  $("#adminApp").classList.add("hidden");

  panel.classList.remove("hidden");
}

function setStatus(message = "", type = "") {
  const el = $("#statusMessage");

  el.textContent = message;
  el.className = `message ${type}`.trim();
}

function formatDate(value) {
  if (!value) return "—";

  const d = new Date(value);

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Bangkok"
  }).format(d);
}

function statusLabel(status) {
  return {
    active: "กำลังทำงาน",
    completed: "เสร็จแล้ว",
    completed_with_errors: "เสร็จพร้อมข้อผิดพลาด"
  }[status] || status || "ยังไม่มี Batch";
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
    throw new Error(
      "ไม่สามารถตรวจสอบสิทธิ์ Admin ได้: " + error.message
    );
  }

  return !!data;
}


async function boot() {

  const {
    data: { session }
  } = await supabaseClient.auth.getSession();

  if (!session) {
    $("#userBadge").classList.add("hidden");
    showOnly($("#loginPanel"));
    return;
  }

  const email = session.user.email.toLowerCase();

  try {

    const isAdmin = await checkAdmin(email);

    if (!isAdmin) {

      $("#forbiddenMessage").textContent =
        `บัญชี ${email} ไม่มีสิทธิ์ Admin`;

      showOnly($("#forbiddenPanel"));
      return;
    }

    $("#userBadge").textContent = email;
    $("#userBadge").classList.remove("hidden");

    showOnly($("#adminApp"));

    await loadCollectionStatus();

  } catch (error) {

    $("#forbiddenMessage").textContent = error.message;

    showOnly($("#forbiddenPanel"));
  }
}


/* -------------------------
   LOGIN
------------------------- */

$("#loginForm").addEventListener("submit", async event => {

  event.preventDefault();

  const email = $("#email").value.trim().toLowerCase();
  const password = $("#password").value;

  $("#loginMessage").textContent = "กำลังเข้าสู่ระบบ...";

  const { error } =
    await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

  if (error) {
    $("#loginMessage").textContent =
      "เข้าสู่ระบบไม่สำเร็จ: " + error.message;

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
   COLLECTION CONTROL
------------------------- */

async function invokeControl(body) {

  const { data, error } =
    await supabaseClient.functions.invoke(
      "social-collection-control",
      {
        body
      }
    );

  if (error) {

    let message =
      error.message ||
      "เรียก Social Collection Control ไม่สำเร็จ";

    try {

      if (
        error.context &&
        typeof error.context.json === "function"
      ) {

        const payload =
          await error.context.json();

        message =
          payload?.message ||
          payload?.error ||
          message;
      }

    } catch {}

    throw new Error(message);
  }

  return data;
}


/* -------------------------
   STATUS
------------------------- */

function stopPolling() {

  if (pollTimer) {
    clearTimeout(pollTimer);
  }

  pollTimer = null;
}


function schedulePolling() {

  stopPolling();

  pollTimer = setTimeout(
    () => loadCollectionStatus(currentBatchId),
    3000
  );
}


function renderBatch(payload) {

  const batch = payload?.batch || null;
  const progress = payload?.progress || {};

  const total =
    Number(progress.total || 0);

  const completed =
    Number(progress.completed || 0);

  const dispatched =
    Number(progress.dispatched || 0);

  const pending =
    Number(progress.pending || 0);

  const failed =
    Number(progress.failed || 0);

  const finished =
    completed + failed;

  const percent =
    total
      ? Math.round((finished / total) * 100)
      : 0;

  currentBatchId =
    batch?.batch_id || null;


  $("#batchStatus").textContent =
    statusLabel(batch?.status);

  $("#completedCount").textContent =
    completed;

  $("#runningCount").textContent =
    dispatched;

  $("#pendingCount").textContent =
    pending;

  $("#failedCount").textContent =
    failed;

  $("#progressLabel").textContent =
    `${finished} / ${total} Sources`;

  $("#progressPercent").textContent =
    `${percent}%`;

  $("#progressBar").style.width =
    `${percent}%`;

  $("#batchId").textContent =
    batch?.batch_id || "—";

  $("#batchStarted").textContent =
    formatDate(batch?.started_at);

  $("#batchFinished").textContent =
    formatDate(batch?.finished_at);


  const active =
    batch?.status === "active";

  $("#startCollectionBtn").disabled =
    active || isStarting;


  if (active) {

    $("#startCollectionBtn").textContent =
      `กำลังดึงข้อมูล... ${finished}/${total}`;

    setStatus(
      "กำลังดึงข้อมูล ระบบจะอัปเดตอัตโนมัติ",
      "info"
    );

    schedulePolling();

  } else {

    $("#startCollectionBtn").textContent =
      "ดึงข้อมูลใหม่";

    stopPolling();

    if (batch?.status === "completed") {

      setStatus(
        `Batch ล่าสุดเสร็จครบ ${completed}/${total} Sources`,
        "success"
      );

    }

    else if (
      batch?.status ===
      "completed_with_errors"
    ) {

      setStatus(
        `Batch จบแล้ว แต่ผิดพลาด ${failed} Source`,
        "error"
      );

    }

    else {

      setStatus(
        "พร้อมดึงข้อมูล",
        "info"
      );
    }
  }
}


async function loadCollectionStatus(batchId = null) {

  try {

    const payload =
      await invokeControl({
        action: "status",
        ...(batchId
          ? { batch_id: batchId }
          : {})
      });

    renderBatch(payload);

  } catch (error) {

    stopPolling();

    setStatus(
      error.message,
      "error"
    );
  }
}


/* -------------------------
   START COLLECTION
------------------------- */

async function startCollection() {

  if (isStarting) return;

  isStarting = true;

  $("#startCollectionBtn").disabled = true;

  $("#startCollectionBtn").textContent =
    "กำลังสร้าง Batch...";

  setStatus(
    "กำลังสร้าง Batch ใหม่...",
    "info"
  );

  try {

    const payload =
      await invokeControl({
        action: "start"
      });

    renderBatch(payload);

  } catch (error) {

    setStatus(
      error.message,
      "error"
    );

  } finally {

    isStarting = false;
  }
}


$("#startCollectionBtn")
  .addEventListener(
    "click",
    startCollection
  );


$("#refreshStatusBtn")
  .addEventListener(
    "click",
    () =>
      loadCollectionStatus(
        currentBatchId
      )
  );


/* -------------------------
   INIT
------------------------- */

supabaseClient.auth.onAuthStateChange(
  () => {
    boot();
  }
);

boot();