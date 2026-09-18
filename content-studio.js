
const tabs = document.querySelectorAll(".studio-tab");
const panels = document.querySelectorAll(".studio-panel");

tabs.forEach(btn=>{
  btn.addEventListener("click",()=>{
    tabs.forEach(x=>x.classList.remove("active"));
    panels.forEach(x=>x.classList.remove("active"));
    btn.classList.add("active");
    document.querySelector(`#tab-${btn.dataset.tab}`).classList.add("active");
  });
});

document.querySelectorAll(".goal").forEach(btn=>{
  btn.addEventListener("click",()=>{
    document.querySelectorAll(".goal").forEach(x=>x.classList.remove("active"));
    btn.classList.add("active");
  });
});

document.querySelectorAll(".source-tab").forEach(btn=>{
  btn.addEventListener("click",()=>{
    document.querySelectorAll(".source-tab").forEach(x=>x.classList.remove("active"));
    document.querySelectorAll(".source-panel").forEach(x=>x.classList.remove("active"));
    btn.classList.add("active");
    document.querySelector(`#source-${btn.dataset.source}`).classList.add("active");
  });
});

document.querySelectorAll(".visual-mode").forEach(btn=>{
  btn.addEventListener("click",()=>{
    document.querySelectorAll(".visual-mode").forEach(x=>x.classList.remove("active"));
    btn.classList.add("active");
  });
});

document.querySelector("#generateMock")?.addEventListener("click",()=>{
  const goal = document.querySelector(".goal.active")?.dataset.goal || "Custom";
  const topic = document.querySelector("#topic")?.value.trim() || "";
  const objective = document.querySelector("#objective")?.value.trim() || "";
  const facts = document.querySelector("#facts")?.value.trim() || "";
  const locked = document.querySelector("#lockedFacts")?.value.trim() || "";
  const audience = document.querySelector("#audience")?.value || "";
  const market = document.querySelector("#market")?.value || "";
  const platform = document.querySelector("#platform")?.value || "";
  const language = document.querySelector("#language")?.value || "";
  const tone = document.querySelector("#tone")?.value || "";
  const cta = document.querySelector("#cta")?.value.trim() || "";
  const visualMode = document.querySelector(".visual-mode.active")?.dataset.mode || "verified";
  const visualDirection = document.querySelector("#visualDirection")?.value.trim() || "";

  const summary = [
    `ประเภท: ${goal}`,
    `หัวข้อ: ${topic || "ยังไม่ระบุ"}`,
    `กลุ่มเป้าหมาย: ${audience}`,
    `ตลาด: ${market}`,
    `ช่องทาง: ${platform}`,
    `ภาษาผลลัพธ์: ${language}`,
    `โทน: ${tone}`,
    `โหมดภาพ: ${visualMode}`
  ].join(" · ");
  document.querySelector("#briefSummary").textContent = summary;
  document.querySelector("#previewPlatform").textContent = platform;

  if(goal === "Academic Calendar"){
    document.querySelector("#mockHook").textContent = "Save these important academic dates.";
    document.querySelector("#mockCaption").textContent =
      `${topic || "Academic Calendar"} — Please check the important dates below and plan your semester in advance. ${facts || "Add verified dates before publishing."} ${cta || "Save this post for later."}`;
    document.querySelector("#mockHashtags").textContent = "#SPUInternational #AcademicCalendar #StudentUpdate";
    document.querySelector("#visualLabel").innerHTML = "ACADEMIC CALENDAR<br><strong>IMPORTANT DATES</strong>";
    document.querySelector("#whyText").textContent =
      "ใช้โครงสร้างที่ชัดและตรงประเด็น เพราะเป็นข้อมูลกำหนดการที่ต้องอ่านง่ายและลดความคลาดเคลื่อน ไม่เน้นภาษาการตลาดมากเกินไป";
    document.querySelector("#visualBrief").textContent =
      `${visualDirection || "Infographic 4:5 พร้อม Timeline แยกวันสำคัญ"} · ใช้เฉพาะวันที่ที่ได้รับการยืนยันแล้ว · ห้ามเปลี่ยนตัวเลขหรือวัน`;
  } else {
    document.querySelector("#mockHook").textContent = topic ? topic : "Build your future beyond borders.";
    document.querySelector("#mockCaption").textContent =
      `${objective || "Create a clear international-facing message."} ${facts || ""} ${cta || ""}`.trim();
    document.querySelector("#mockHashtags").textContent = "#SPUInternational #StudyInBangkok #GlobalEducation";
    document.querySelector("#visualLabel").innerHTML = "SPU INTERNATIONAL<br><strong>GLOBAL EXPERIENCE</strong>";
    document.querySelector("#whyText").textContent =
      "ระบบจะใช้ข้อมูลจริงของ SPU, Pattern จากคู่เทียบ และเงื่อนไขของ Brief เพื่อเลือกโครงสร้างข้อความที่เหมาะกับกลุ่มเป้าหมาย";
    document.querySelector("#visualBrief").textContent =
      visualDirection || "ใช้ภาพจริงของ SPU International หรือสร้าง Concept Visual ตามวัตถุประสงค์ โดยไม่สร้างข้อมูลสถานที่หรือสิ่งอำนวยความสะดวกที่ไม่มีจริง";
  }
});

document.querySelector("#mockCompareBtn")?.addEventListener("click",()=>{
  alert("Mockup: เวอร์ชันจริงจะให้เลือกสถาบันและดึง social_posts มาเปรียบเทียบรูปแบบการสื่อสาร");
});
