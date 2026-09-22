window.SPU_CONTENT_PRESETS = [
  {
    key: "academic_calendar",
    label: "ปฏิทินการศึกษา",
    icon: "▦",
    contentType: "Academic Calendar",
    summary: "วันลงทะเบียน เปิดเรียน สอบ และวันสำคัญ",
    defaultAudience: "นักศึกษาต่างชาติปัจจุบัน",
    referenceCategory: "academic",
    fields: [
      {id:"semester", label:"ภาคเรียน / ปีการศึกษา", placeholder:"เช่น Semester 1 / 2027", required:true},
      {id:"important_dates", label:"วันสำคัญ", placeholder:"เช่น Registration: 1–5 Aug 2027\nAdd/Drop: 6–10 Aug 2027\nMidterm Exams: 10–14 Oct 2027", type:"textarea", required:true},
      {id:"cta", label:"ช่องทางติดตาม / CTA", placeholder:"เช่น Check the student portal", required:false}
    ]
  },
  {
    key: "scholarship",
    label: "ทุนการศึกษา",
    icon: "◇",
    contentType: "Scholarship",
    summary: "ทุน สิทธิประโยชน์ คุณสมบัติ และกำหนดสมัคร",
    defaultAudience: "นักศึกษาต่างชาติที่สนใจสมัครเรียน",
    referenceCategory: "scholarship",
    fields: [
      {id:"scholarship_name", label:"ชื่อทุน", placeholder:"ชื่อทุนหรือแคมเปญ", required:true},
      {id:"benefits", label:"จุดเด่น / สิทธิประโยชน์", placeholder:"ใส่เฉพาะข้อมูลที่ยืนยันแล้ว", type:"textarea", required:true},
      {id:"eligibility", label:"ใครสมัครได้", placeholder:"เช่น International applicants", required:false},
      {id:"deadline", label:"วันปิดรับสมัคร", placeholder:"เช่น 31 March 2027", required:false},
      {id:"cta", label:"สมัคร / ดูรายละเอียด", placeholder:"เช่น Apply now at ...", required:false}
    ]
  },
  {
    key: "event",
    label: "กิจกรรม / Event",
    icon: "✦",
    contentType: "Event",
    summary: "กิจกรรม วัน เวลา สถานที่ และสิ่งที่จะได้รับ",
    defaultAudience: "นักศึกษาต่างชาติปัจจุบัน",
    referenceCategory: "event",
    fields: [
      {id:"event_name", label:"ชื่อกิจกรรม", placeholder:"ชื่อกิจกรรม", required:true},
      {id:"date_time", label:"วัน / เวลา", placeholder:"เช่น 15 November 2027 · 13:00–16:00", required:true},
      {id:"location", label:"สถานที่", placeholder:"เช่น SPU Bangkok Campus", required:false},
      {id:"highlights", label:"ไฮไลต์ / สิ่งที่จะได้รับ", placeholder:"เช่น Workshop, Networking, Guest Speaker", type:"textarea", required:true},
      {id:"cta", label:"วิธีเข้าร่วม", placeholder:"เช่น Register via ...", required:false}
    ]
  },
  {
    key: "career",
    label: "Career / Internship",
    icon: "▣",
    contentType: "Career & Internship",
    summary: "อาชีพ ฝึกงาน Networking และ Employability",
    defaultAudience: "นักศึกษาต่างชาติปัจจุบัน",
    referenceCategory: "career",
    fields: [
      {id:"campaign_name", label:"ชื่อกิจกรรม / แคมเปญ", placeholder:"เช่น Global Career & Internship Week 2027", required:true},
      {id:"benefit", label:"นักศึกษาจะได้อะไร", placeholder:"เช่น Career Talk, CV Clinic, Mock Interview, Internship Matching", type:"textarea", required:true},
      {id:"date_time", label:"วัน / เวลา", placeholder:"เช่น 15–19 November 2027", required:false},
      {id:"location", label:"สถานที่", placeholder:"เช่น SPU Bangkok Campus", required:false},
      {id:"cta", label:"วิธีเข้าร่วม", placeholder:"เช่น Register now", required:false}
    ]
  },
  {
    key: "achievement",
    label: "ความสำเร็จ / ข่าวดี",
    icon: "★",
    contentType: "Achievement & News",
    summary: "รางวัล ผลงาน ข่าวดี และ Milestone",
    defaultAudience: "นักศึกษาต่างชาติปัจจุบัน",
    referenceCategory: "achievement",
    fields: [
      {id:"headline_fact", label:"ความสำเร็จคืออะไร", placeholder:"ระบุข้อเท็จจริงหลัก", required:true},
      {id:"who", label:"ใคร / หน่วยงานที่เกี่ยวข้อง", placeholder:"ชื่อบุคคล ทีม หรือหลักสูตร", required:false},
      {id:"why_matters", label:"ทำไมจึงสำคัญ", placeholder:"ผลลัพธ์หรือความหมายที่ยืนยันได้", type:"textarea", required:false},
      {id:"source", label:"แหล่งอ้างอิง", placeholder:"ชื่อรางวัล / หน่วยงาน / เอกสารอ้างอิง", required:false}
    ]
  },
  {
    key: "announcement",
    label: "ประกาศสำคัญ",
    icon: "!",
    contentType: "Important Announcement",
    summary: "Reminder กำหนดส่ง เปลี่ยนแปลง และข้อมูลทางการ",
    defaultAudience: "นักศึกษาต่างชาติปัจจุบัน",
    referenceCategory: "announcement",
    fields: [
      {id:"announcement", label:"เรื่องที่ประกาศ", placeholder:"ข้อความหลักที่ต้องการแจ้ง", required:true},
      {id:"effective_date", label:"วันที่ / ช่วงเวลาที่เกี่ยวข้อง", placeholder:"ระบุถ้ามี", required:false},
      {id:"action_required", label:"ผู้รับสารต้องทำอะไร", placeholder:"เช่น Submit documents before ...", required:false},
      {id:"contact", label:"ช่องทางติดต่อ", placeholder:"ระบุถ้ามี", required:false}
    ]
  },
  {
    key: "student_life",
    label: "Student Life",
    icon: "☺",
    contentType: "Student Life",
    summary: "ชีวิตนักศึกษา Community และประสบการณ์นานาชาติ",
    defaultAudience: "นักศึกษาต่างชาติที่สนใจสมัครเรียน",
    referenceCategory: "student_life",
    fields: [
      {id:"story", label:"เรื่องที่อยากเล่า", placeholder:"เช่น International Student Community at SPU", required:true},
      {id:"moments", label:"บรรยากาศ / Moment สำคัญ", placeholder:"เช่น clubs, campus life, friendships, cultural exchange", type:"textarea", required:false},
      {id:"cta", label:"CTA", placeholder:"เช่น Discover life at SPUIC", required:false}
    ]
  },
  {
    key: "program_highlight",
    label: "แนะนำหลักสูตร",
    icon: "◆",
    contentType: "Program Highlight",
    summary: "จุดเด่นหลักสูตร ทักษะ และโอกาส",
    defaultAudience: "นักศึกษาต่างชาติที่สนใจสมัครเรียน",
    referenceCategory: "program",
    fields: [
      {id:"program_name", label:"ชื่อหลักสูตร", placeholder:"ชื่อหลักสูตรอย่างเป็นทางการ", required:true},
      {id:"highlights", label:"จุดเด่นที่ยืนยันแล้ว", placeholder:"เช่น learning approach, modules, facilities ที่มีจริง", type:"textarea", required:true},
      {id:"career_paths", label:"ตัวอย่างเส้นทางอาชีพ", placeholder:"ระบุเฉพาะที่ต้องการสื่อสาร", type:"textarea", required:false},
      {id:"cta", label:"CTA", placeholder:"เช่น Explore the program", required:false}
    ]
  },
  {
    key: "custom",
    label: "กำหนดเอง",
    icon: "+",
    contentType: "Custom",
    summary: "สำหรับเรื่องที่ไม่เข้ากับ Template ด้านบน",
    defaultAudience: "นักศึกษาต่างชาติปัจจุบัน",
    referenceCategory: "general",
    fields: []
  }
];

window.SPU_CONTENT_PRESET_MAP = Object.fromEntries(
  window.SPU_CONTENT_PRESETS.map(x => [x.key, x])
);
