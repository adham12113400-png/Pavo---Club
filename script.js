/* ============================================================
   PAVO CLUB — script.js
   ملف مشترك بين الصفحة العامة (index.html) ولوحة الأدمن (admin.html)
   يحتوي على: الإعدادات، الاتصال بـ Google Apps Script API،
   دوال مساعدة عامة، ودوال عرض الصفحة العامة.
   ============================================================ */

/* ------------------------------------------------------------
   1) الإعدادات العامة
   ------------------------------------------------------------ */
const CONFIG = {
  // رابط Google Apps Script Web App (القراءة والكتابة تمران من هنا)
  API_URL: "https://script.google.com/macros/s/AKfycbwF5HqnD0SOWBUGc6pVp3hmiE6SgANnuqib84AvjD2FE7qjw45vywh2h3Ed-2qbd5gR/exec",
  // فترة تحديث الصفحة العامة تلقائيًا (بالمللي ثانية) — 30 ثانية
  REFRESH_INTERVAL: 30000,
};

// نص الرسالة الموحّد عند عدم وجود بيانات
const NO_DATA_TEXT = "لا توجد بيانات حاليًا";

/* ------------------------------------------------------------
   2) خرائط ترجمة القيم إلى العربية
   ملاحظة: إذا كانت القيمة في الشيت مكتوبة بالعربية أصلًا،
   يتم عرضها كما هي بدون أي افتراض إضافي.
   ------------------------------------------------------------ */
const POSITION_MAP = {
  goalkeeper: "حارس مرمى",
  gk: "حارس مرمى",
  defender: "مدافع",
  centerback: "مدافع",
  cb: "مدافع",
  fullback: "ظهير",
  rb: "ظهير",
  lb: "ظهير",
  midfielder: "لاعب وسط",
  midfield: "لاعب وسط",
  cm: "لاعب وسط",
  dm: "لاعب وسط",
  am: "لاعب وسط",
  winger: "جناح",
  wing: "جناح",
  rw: "جناح",
  lw: "جناح",
  forward: "مهاجم",
  striker: "مهاجم",
  st: "مهاجم",
  fw: "مهاجم",
};

const EVENT_TYPE_MAP = {
  goal: "⚽ هدف",
  yellow: "🟨 بطاقة صفراء",
  red: "🟥 بطاقة حمراء",
  sub: "🔄 تبديل",
  substitution: "🔄 تبديل",
  other: "📌 حدث",
};

const MATCH_STATUS_LABELS = {
  upcoming: "قادمة",
  live: "مباشر الآن",
  finished: "منتهية",
};

/* ------------------------------------------------------------
   3) خريطة الحقول المحتملة لكل جدول
   (تُستخدم للبحث المرن عن اسم العمود الحقيقي في Google Sheets
   بغض النظر عن التسمية الدقيقة التي استخدمها المستخدم)
   ------------------------------------------------------------ */
const FIELD_MAP = {
  club: {
    id: ["id"],
    name: ["clubname", "name", "اسمالنادي", "اسم"],
    logo: ["logo", "شعار"],
    cover: ["cover", "coverimage", "صورةالغلاف", "غلاف"],
    city: ["city", "مدينة"],
    founded: ["founded", "foundedyear", "establishedyear", "سنةالتأسيس", "تأسيس"],
    description: ["description", "desc", "about", "وصف"],
    colors: ["colors", "color", "ألوان"],
    strength: ["strength", "rating", "powerlevel", "level", "مستوىالقوة", "قوة"],
    contact: ["contact", "phone", "email", "تواصل", "هاتف", "بريد"],
  },
  player: {
    id: ["id"],
    name: ["name", "playername", "اسم"],
    number: ["number", "shirtnumber", "jerseynumber", "رقم"],
    position: ["position", "role", "مركز"],
    photo: ["photo", "image", "صورة"],
    birthDate: ["birthdate", "dob", "تاريخالميلاد"],
    height: ["height", "الطول"],
    preferredFoot: ["preferredfoot", "foot", "القدمالمفضلة"],
    description: ["description", "bio", "notes", "وصف"],
    status: ["status", "حالة", "active"],
  },
  match: {
    id: ["id"],
    opponent: ["opponent", "rival", "منافس"],
    date: ["date", "matchdate", "تاريخ"],
    time: ["time", "matchtime", "وقت"],
    kickoff: ["kickoff", "datetime", "starttime", "بدايةالمباراة"],
    opponentLogo: ["opponentlogo", "rivallogo", "شعارالمنافس"],
    competition: ["competition", "tournament", "league", "بطولة"],
    venue: ["venue", "stadium", "ملعب"],
    pavoScore: ["pavoscore", "homescore", "ourscore", "نتيجةبافو", "نتيجةالنادي"],
    opponentScore: ["opponentscore", "awayscore", "rivalscore", "نتيجةالمنافس"],
    status: ["status", "حالة"],
    minute: ["minute", "currentminute", "دقيقة"],
  },
  event: {
    id: ["id"],
    matchId: ["matchid", "match", "مباراة"],
    minute: ["minute", "دقيقة"],
    player: ["player", "لاعب"],
    type: ["type", "eventtype", "نوع"],
    details: ["details", "description", "تفاصيل"],
  },
  news: {
    id: ["id"],
    title: ["title", "عنوان"],
    content: ["content", "body", "محتوى"],
    date: ["date", "تاريخ", "publishedat", "published"],
    image: ["image", "photo", "صورة"],
    status: ["status", "حالة", "active"],
  },
};

/* ------------------------------------------------------------
   4) دوال مساعدة عامة
   ------------------------------------------------------------ */

// تطبيع النص للمقارنة (إزالة المسافات/الشرطات وتحويل لحروف صغيرة)
function normalize(str) {
  return String(str == null ? "" : str)
    .toLowerCase()
    .replace(/[\s_\-]/g, "");
}

// البحث عن قيمة حقل داخل صف بيانات (row) بالاعتماد على قائمة كلمات مفتاحية محتملة
function findValue(row, keywords) {
  if (!row) return "";
  const rowKeys = Object.keys(row);
  for (const kw of keywords) {
    const nkw = normalize(kw);
    const matchedKey = rowKeys.find((k) => normalize(k).includes(nkw));
    if (matchedKey !== undefined) {
      const val = row[matchedKey];
      if (val !== undefined && val !== null && String(val).trim() !== "") {
        return val;
      }
    }
  }
  return "";
}

// منع الـ XSS عند إدراج نصوص قادمة من الشيت داخل HTML
function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setImage(id, url) {
  const el = document.getElementById(id);
  if (!el) return;
  if (url) {
    el.src = toDirectImageUrl(url);
    el.classList.remove("img-placeholder");
    el.onerror = () => {
      el.classList.add("img-placeholder");
      el.removeAttribute("src");
    };
  } else {
    el.removeAttribute("src");
    el.classList.add("img-placeholder");
  }
}

function setBackgroundImage(id, url) {
  const el = document.getElementById(id);
  if (!el) return;
  const finalUrl = toDirectImageUrl(url);
  el.style.backgroundImage = finalUrl ? `url('${String(finalUrl).replace(/'/g, "%27")}')` : "";
}

// تحويل روابط مشاركة Google Drive (file/d/... أو ?id=...) إلى رابط صورة مباشر قابل للعرض في <img>
function toDirectImageUrl(url) {
  if (!url) return url;
  const trimmed = String(url).trim();

  // نمط: https://drive.google.com/file/d/FILE_ID/view?usp=sharing
  let match = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);

  // نمط: https://drive.google.com/open?id=FILE_ID  أو أي رابط فيه ...&id=FILE_ID
  if (!match) {
    match = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  }

  if (match && match[1]) {
    return `https://lh3.googleusercontent.com/d/${match[1]}`;
  }

  return trimmed; // رابط صورة مباشر عادي (غير Google Drive) — يُترك كما هو
}

/* ------------------------------------------------------------
   4.1) تنسيق قيم التاريخ/الوقت
   بعد تعديل Google Apps Script (راجع رسالة التسليم)، أصبح الـ API
   يرجع التاريخ كنص "yyyy-MM-dd" والوقت كنص "HH:mm" مباشرة، فنعتمد
   على قراءتهما كنصوص بالدرجة الأولى، مع الإبقاء على معالجة احتياطية
   لأي قيمة Date خام قديمة (لو الكاش لسه فيه بيانات قديمة مثلًا).
   ------------------------------------------------------------ */

function formatArabicDateParts(year, monthIndex, day) {
  const months = [
    "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
    "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
  ];
  return `${day} ${months[monthIndex]} ${year}`;
}

function formatArabicTimeParts(hours, minutes) {
  const period = hours >= 12 ? "م" : "ص";
  let h = hours % 12;
  if (h === 0) h = 12;
  return `${h}:${String(minutes).padStart(2, "0")} ${period}`;
}

function formatArabicDate(value) {
  if (value === undefined || value === null || value === "") return "";
  const str = String(value).trim();

  // الصيغة النظيفة القادمة من الـ API بعد الإصلاح: yyyy-MM-dd أو yyyy-MM-ddTHH:mm
  let m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return formatArabicDateParts(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));

  // احتياطي لأي قيمة Date خام قديمة (ISO مع Z مثلًا)
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    if (d.getFullYear() === 1899) return formatArabicTime(value); // كانت أصلًا وقت فقط
    return formatArabicDateParts(d.getFullYear(), d.getMonth(), d.getDate());
  }

  return str; // نص عادي غير معروف الصيغة — اعرضه كما هو
}

function formatArabicTime(value) {
  if (value === undefined || value === null || value === "") return "";
  const str = String(value).trim();

  // الصيغة النظيفة: HH:mm (وقت فقط) أو جزء الوقت داخل yyyy-MM-ddTHH:mm
  let m = str.match(/T(\d{2}):(\d{2})/) || (!str.includes("-") ? str.match(/^(\d{2}):(\d{2})/) : null);
  if (m) return formatArabicTimeParts(parseInt(m[1], 10), parseInt(m[2], 10));

  // احتياطي لأي قيمة Date خام قديمة
  const d = new Date(str);
  if (!isNaN(d.getTime())) return formatArabicTimeParts(d.getHours(), d.getMinutes());

  return str;
}

// تحويل أي قيمة قادمة من الـ API إلى صيغة يفهمها <input type="date">
function toDateInputValue(value) {
  if (!value) return "";
  const str = String(value).trim();
  let m = str.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  return "";
}

// تحويل أي قيمة قادمة من الـ API إلى صيغة يفهمها <input type="time">
function toTimeInputValue(value) {
  if (!value) return "";
  const str = String(value).trim();
  let m = str.match(/(\d{2}:\d{2})/);
  if (m) return m[1];
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  return "";
}

// تحويل أي قيمة قادمة من الـ API إلى صيغة يفهمها <input type="datetime-local">
function toDateTimeLocalInputValue(value) {
  if (!value) return "";
  const str = String(value).trim();
  let m = str.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  if (m) return `${m[1]}T${m[2]}`;
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  return "";
}

// فحص إن كان صف (لاعب/خبر) "نشط" — يتعامل مع Boolean الحقيقي القادم
// من دالة convertActive() في Apps Script، ومع أي نص قديم بديل
function isEntryActive(rawValue) {
  if (typeof rawValue === "boolean") return rawValue;
  if (rawValue === "" || rawValue === undefined || rawValue === null) return true; // لا توجد بيانات حالة = نشط افتراضيًا
  const n = normalize(rawValue);
  if (n === "false" || n === "0") return false;
  return !(n.includes("inactive") || n.includes("disabled") || n.includes("معطل") || n.includes("موقوف") || n.includes("غيرنشط"));
}

function translatePosition(raw) {
  if (!raw) return "";
  const n = normalize(raw);
  for (const key in POSITION_MAP) {
    if (n.includes(key)) return POSITION_MAP[key];
  }
  return String(raw); // القيمة قد تكون عربية بالفعل أو تسمية خاصة بالنادي
}

function translateEventType(rawType) {
  const n = normalize(rawType);
  for (const key in EVENT_TYPE_MAP) {
    if (n.includes(key)) return EVENT_TYPE_MAP[key];
  }
  return EVENT_TYPE_MAP.other;
}

function translateMatchStatus(rawStatus) {
  const n = normalize(rawStatus);
  for (const key in MATCH_STATUS_LABELS) {
    if (n.includes(key)) return MATCH_STATUS_LABELS[key];
  }
  return rawStatus || "";
}

// تحويل جدول Settings (Key/Value) إلى كائن عادي
function settingsToObject(settingsArr) {
  const obj = {};
  if (!Array.isArray(settingsArr)) return obj;
  settingsArr.forEach((row) => {
    const key = findValue(row, ["key", "اسم", "setting", "name"]);
    const value = findValue(row, ["value", "قيمة"]);
    if (key) obj[normalize(key)] = value;
  });
  return obj;
}

/* ------------------------------------------------------------
   5) الاتصال بـ Google Apps Script API
   ------------------------------------------------------------ */

// ذاكرة تخزين مؤقت لآخر بيانات تم جلبها
let PAVO_CACHE = { club: [], players: [], matches: [], events: [], settings: [], news: [] };

// جلب كل البيانات (قراءة فقط) من الـ API
async function fetchPavoData() {
  try {
    const res = await fetch(CONFIG.API_URL);
    const json = await res.json();
    if (json && json.success && json.data) {
      PAVO_CACHE = {
        club: json.data.club || [],
        players: json.data.players || [],
        matches: json.data.matches || [],
        events: json.data.events || [],
        settings: json.data.settings || [],
        news: json.data.news || [],
      };
      return true;
    }
    console.warn("PAVO API: استجابة غير ناجحة", json);
    return false;
  } catch (err) {
    console.error("PAVO API: فشل الاتصال", err);
    return false;
  }
}

/**
 * تنفيذ عملية كتابة (إنشاء/تعديل/حذف) عبر الـ API.
 * هذه الدالة جاهزة هيكليًا، لكنها تحتاج أن يدعم Google Apps Script
 * الحالي طلبات POST بالشكل: { action: "...", payload: {...} }
 * راجع شرح الأكشنز المطلوبة في نهاية الرد المرفق مع هذا الكود.
 */
async function callPavoAction(action, payload) {
  try {
    const res = await fetch(CONFIG.API_URL, {
      method: "POST",
      // نستخدم text/plain لتفادي مشاكل CORS preflight مع Apps Script Web Apps
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, payload }),
    });
    const json = await res.json();
    return json;
  } catch (err) {
    console.error("PAVO API Action Error:", err);
    return { success: false, message: "تعذر الاتصال بالخادم" };
  }
}

/* ------------------------------------------------------------
   6) معلومات هوية النادي (مدمجة من club + settings)
   ------------------------------------------------------------ */
function getClubInfo() {
  const club = (PAVO_CACHE.club && PAVO_CACHE.club[0]) || {};
  const settingsObj = settingsToObject(PAVO_CACHE.settings);
  return {
    name: findValue(club, FIELD_MAP.club.name) || settingsObj[normalize("clubname")] || "",
    logo: findValue(club, FIELD_MAP.club.logo) || settingsObj[normalize("logo")] || "",
    cover: findValue(club, FIELD_MAP.club.cover) || settingsObj[normalize("cover")] || "",
    city: findValue(club, FIELD_MAP.club.city) || "",
    founded: findValue(club, FIELD_MAP.club.founded) || "",
    description: findValue(club, FIELD_MAP.club.description) || "",
    colors: findValue(club, FIELD_MAP.club.colors) || "",
    strength: findValue(club, FIELD_MAP.club.strength) || settingsObj[normalize("strength")] || "",
    contact: findValue(club, FIELD_MAP.club.contact) || "",
  };
}

/* ------------------------------------------------------------
   7) دوال إحصائيات (تُستخدم في لوحة الأدمن)
   ------------------------------------------------------------ */
function computePavoStats() {
  const matches = PAVO_CACHE.matches || [];
  return {
    playersCount: (PAVO_CACHE.players || []).length,
    matchesCount: matches.length,
    newsCount: (PAVO_CACHE.news || []).length,
    liveCount: matches.filter((m) => {
      const st = normalize(findValue(m, FIELD_MAP.match.status));
      return st.includes("live") || st.includes("مباشر");
    }).length,
  };
}

/* ==============================================================
   8) دوال عرض الصفحة العامة (Public Website)
   كل الدوال هنا "آمنة" — إن لم يوجد العنصر في الصفحة تتجاهله فقط،
   لذلك يمكن تحميل هذا الملف في admin.html أيضًا بدون أخطاء.
   ============================================================== */

function renderIdentityAndHero() {
  const info = getClubInfo();

  setText("heroClubName", info.name || "PAVO CLUB");
  setText("headerClubName", info.name || "PAVO CLUB");
  setText("footerClubName", info.name || "PAVO CLUB");
  setImage("heroLogo", info.logo);
  setImage("headerLogo", info.logo);
  setText("heroDescription", info.description || NO_DATA_TEXT);
  setBackgroundImage("heroSection", info.cover);

  setImage("identityLogo", info.logo);
  setText("identityName", info.name || NO_DATA_TEXT);
  setText("identityCity", info.city || NO_DATA_TEXT);
  setText("identityFounded", info.founded || NO_DATA_TEXT);
  setText("identityDescription", info.description || NO_DATA_TEXT);
  setText("identityColors", info.colors || NO_DATA_TEXT);
  setText("identityContact", info.contact || NO_DATA_TEXT);

  // مستوى قوة النادي
  const strengthValueEl = document.getElementById("strengthValue");
  const strengthBarEl = document.getElementById("strengthBarFill");
  if (strengthValueEl) {
    const numeric = parseFloat(info.strength);
    if (info.strength && !isNaN(numeric)) {
      strengthValueEl.textContent = numeric + "%";
      if (strengthBarEl) strengthBarEl.style.width = Math.min(Math.max(numeric, 0), 100) + "%";
    } else if (info.strength) {
      strengthValueEl.textContent = String(info.strength);
      if (strengthBarEl) strengthBarEl.style.width = "0%";
    } else {
      strengthValueEl.textContent = "غير محدد";
      if (strengthBarEl) strengthBarEl.style.width = "0%";
    }
  }
}

function renderPlayers() {
  const container = document.getElementById("playersGrid");
  if (!container) return;

  const players = (PAVO_CACHE.players || []).filter((p) => isEntryActive(findValue(p, FIELD_MAP.player.status)));

  if (!players.length) {
    container.innerHTML = `<p class="empty-msg">${NO_DATA_TEXT}</p>`;
    return;
  }

  container.innerHTML = players
    .map((p) => {
      const name = findValue(p, FIELD_MAP.player.name);
      const number = findValue(p, FIELD_MAP.player.number);
      const position = translatePosition(findValue(p, FIELD_MAP.player.position));
      const photo = toDirectImageUrl(findValue(p, FIELD_MAP.player.photo));
      const desc = findValue(p, FIELD_MAP.player.description);

      return `
        <div class="player-card">
          <div class="player-photo-wrap">
            <img class="player-photo${photo ? "" : " img-placeholder"}"
                 src="${photo ? escapeHtml(photo) : ""}"
                 alt="${escapeHtml(name || "لاعب")}"
                 onerror="this.classList.add('img-placeholder'); this.removeAttribute('src');">
            ${number ? `<span class="player-number">${escapeHtml(number)}</span>` : ""}
          </div>
          <div class="player-info">
            <h3 class="player-name">${escapeHtml(name || NO_DATA_TEXT)}</h3>
            ${position ? `<span class="player-position">${escapeHtml(position)}</span>` : ""}
            ${desc ? `<p class="player-desc">${escapeHtml(desc)}</p>` : ""}
          </div>
        </div>
      `;
    })
    .join("");
}

function combineDateTime(dateStr, timeStr) {
  if (!dateStr) return "";
  return timeStr ? `${dateStr}T${timeStr}` : dateStr;
}

function parseKickoff(kickoffStr) {
  if (!kickoffStr) return null;
  const d = new Date(kickoffStr);
  return isNaN(d.getTime()) ? null : d;
}

function classifyMatches() {
  const matches = PAVO_CACHE.matches || [];
  return matches.map((m) => {
    const date = findValue(m, FIELD_MAP.match.date);
    const time = findValue(m, FIELD_MAP.match.time);
    return {
      raw: m,
      opponent: findValue(m, FIELD_MAP.match.opponent),
      opponentLogo: toDirectImageUrl(findValue(m, FIELD_MAP.match.opponentLogo)),
      date,
      time,
      kickoff: findValue(m, FIELD_MAP.match.kickoff) || combineDateTime(date, time),
      competition: findValue(m, FIELD_MAP.match.competition),
      venue: findValue(m, FIELD_MAP.match.venue),
      pavoScore: findValue(m, FIELD_MAP.match.pavoScore),
      oppScore: findValue(m, FIELD_MAP.match.opponentScore),
      status: normalize(findValue(m, FIELD_MAP.match.status)),
    };
  });
}

function computeLiveMinute(kickoffDate) {
  const diffMs = new Date() - kickoffDate;
  if (diffMs < 0) return 0;
  return Math.floor(diffMs / 60000);
}

function renderLiveMatch(m) {
  const container = document.getElementById("liveMatchContainer");
  if (!container) return;

  if (!m) {
    container.innerHTML = `<p class="empty-msg">لا توجد مباراة مباشرة حاليًا</p>`;
    return;
  }

  const kickoffDate = parseKickoff(m.kickoff);
  const rawMinute = findValue(m.raw, FIELD_MAP.match.minute);
  const minuteText = kickoffDate ? computeLiveMinute(kickoffDate) : rawMinute;
  const pavoLogo = getClubInfo().logo;

  container.innerHTML = `
    <div class="live-match-card">
      <div class="live-badge">● مباشر</div>
      <div class="live-teams">
        <div class="team-block">
          <img class="team-logo${pavoLogo ? "" : " img-placeholder"}" src="${pavoLogo ? escapeHtml(pavoLogo) : ""}" alt="PAVO" onerror="this.classList.add('img-placeholder'); this.removeAttribute('src');">
          <span class="team-name">PAVO</span>
          <span class="team-score">${escapeHtml(m.pavoScore !== "" ? m.pavoScore : "-")}</span>
        </div>
        <span class="score-sep">:</span>
        <div class="team-block">
          <img class="team-logo${m.opponentLogo ? "" : " img-placeholder"}" src="${m.opponentLogo ? escapeHtml(m.opponentLogo) : ""}" alt="${escapeHtml(m.opponent || "منافس")}" onerror="this.classList.add('img-placeholder'); this.removeAttribute('src');">
          <span class="team-name">${escapeHtml(m.opponent || NO_DATA_TEXT)}</span>
          <span class="team-score">${escapeHtml(m.oppScore !== "" ? m.oppScore : "-")}</span>
        </div>
      </div>
      ${minuteText !== "" && minuteText !== undefined ? `<div class="live-minute">${escapeHtml(minuteText)}'</div>` : ""}
      <div class="live-meta">
        ${m.competition ? `<span>🏆 ${escapeHtml(m.competition)}</span>` : ""}
        ${m.venue ? `<span>📍 ${escapeHtml(m.venue)}</span>` : ""}
      </div>
    </div>
  `;
}

function renderPastMatches(list) {
  const container = document.getElementById("pastMatchesList");
  if (!container) return;

  if (!list.length) {
    container.innerHTML = `<p class="empty-msg">${NO_DATA_TEXT}</p>`;
    return;
  }

  const sorted = [...list].sort((a, b) => new Date(b.kickoff || b.date || 0) - new Date(a.kickoff || a.date || 0));

  container.innerHTML = sorted
    .map(
      (m) => `
      <div class="match-row">
        <div class="match-row-main">
          <span class="match-opponent">
            ${m.opponentLogo ? `<img class="match-row-logo" src="${escapeHtml(m.opponentLogo)}" alt="" onerror="this.style.display='none';">` : ""}
            ${escapeHtml(m.opponent || NO_DATA_TEXT)}
          </span>
          <span class="match-score">${escapeHtml(m.pavoScore !== "" ? m.pavoScore : "-")} : ${escapeHtml(m.oppScore !== "" ? m.oppScore : "-")}</span>
        </div>
        <div class="match-row-meta">
          ${m.date ? `<span>📅 ${escapeHtml(formatArabicDate(m.date))}</span>` : ""}
          ${m.time ? `<span>🕒 ${escapeHtml(formatArabicTime(m.time))}</span>` : ""}
          ${m.competition ? `<span>🏆 ${escapeHtml(m.competition)}</span>` : ""}
          ${m.venue ? `<span>📍 ${escapeHtml(m.venue)}</span>` : ""}
        </div>
      </div>
    `
    )
    .join("");
}

let pavoCountdownTimer = null;

function renderCountdown(nextMatch) {
  const el = document.getElementById("nextMatchCountdown");
  if (!el) return;

  if (pavoCountdownTimer) {
    clearInterval(pavoCountdownTimer);
    pavoCountdownTimer = null;
  }

  if (!nextMatch) {
    el.textContent = "";
    return;
  }

  const kickoffDate = parseKickoff(nextMatch.kickoff);
  if (!kickoffDate) {
    el.textContent = "";
    return;
  }

  function tick() {
    const diff = kickoffDate - new Date();
    if (diff <= 0) {
      el.textContent = "بدأت المباراة";
      clearInterval(pavoCountdownTimer);
      return;
    }
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    el.textContent = `${days} يوم ${hours} ساعة ${mins} دقيقة ${secs} ثانية`;
  }

  tick();
  pavoCountdownTimer = setInterval(tick, 1000);
}

function renderUpcomingMatches(list) {
  const container = document.getElementById("upcomingMatchesList");
  if (!container) {
    return;
  }

  if (!list.length) {
    container.innerHTML = `<p class="empty-msg">${NO_DATA_TEXT}</p>`;
    renderCountdown(null);
    return;
  }

  const sorted = [...list].sort((a, b) => new Date(a.kickoff || a.date || 0) - new Date(b.kickoff || b.date || 0));

  container.innerHTML = sorted
    .map(
      (m) => `
      <div class="match-row">
        <div class="match-row-main">
          <span class="match-opponent">
            ${m.opponentLogo ? `<img class="match-row-logo" src="${escapeHtml(m.opponentLogo)}" alt="" onerror="this.style.display='none';">` : ""}
            ${escapeHtml(m.opponent || NO_DATA_TEXT)}
          </span>
        </div>
        <div class="match-row-meta">
          ${m.date ? `<span>📅 ${escapeHtml(formatArabicDate(m.date))}</span>` : ""}
          ${m.time ? `<span>🕒 ${escapeHtml(formatArabicTime(m.time))}</span>` : ""}
          ${m.competition ? `<span>🏆 ${escapeHtml(m.competition)}</span>` : ""}
          ${m.venue ? `<span>📍 ${escapeHtml(m.venue)}</span>` : ""}
        </div>
      </div>
    `
    )
    .join("");

  renderCountdown(sorted[0]);
}

function renderMatches() {
  const all = classifyMatches();
  const live = all.filter((m) => m.status.includes("live") || m.status.includes("مباشر"));
  const finished = all.filter((m) => m.status.includes("finish") || m.status.includes("منته"));
  const upcoming = all.filter((m) => m.status.includes("upcoming") || m.status.includes("قادم"));

  renderLiveMatch(live[0]);
  renderPastMatches(finished);
  renderUpcomingMatches(upcoming);
}

function renderEvents() {
  const container = document.getElementById("eventsList");
  if (!container) return;

  const events = PAVO_CACHE.events || [];
  if (!events.length) {
    container.innerHTML = `<p class="empty-msg">${NO_DATA_TEXT}</p>`;
    return;
  }

  const withMeta = events
    .map((e) => ({
      minute: findValue(e, FIELD_MAP.event.minute),
      player: findValue(e, FIELD_MAP.event.player),
      type: findValue(e, FIELD_MAP.event.type),
      details: findValue(e, FIELD_MAP.event.details),
    }))
    .sort((a, b) => (parseFloat(b.minute) || 0) - (parseFloat(a.minute) || 0));

  container.innerHTML = withMeta
    .map(
      (e) => `
      <div class="event-row">
        ${e.minute !== "" ? `<span class="event-minute">${escapeHtml(e.minute)}'</span>` : ""}
        <span class="event-type">${escapeHtml(translateEventType(e.type))}</span>
        ${e.player ? `<span class="event-player">${escapeHtml(e.player)}</span>` : ""}
        ${e.details ? `<span class="event-details">${escapeHtml(e.details)}</span>` : ""}
      </div>
    `
    )
    .join("");
}

function renderNews() {
  const container = document.getElementById("newsList");
  if (!container) return;

  const news = (PAVO_CACHE.news || []).filter((n) => isEntryActive(findValue(n, FIELD_MAP.news.status)));

  if (!news.length) {
    container.innerHTML = `<p class="empty-msg">لا توجد أخبار حاليًا</p>`;
    return;
  }

  const sorted = [...news].sort(
    (a, b) => new Date(findValue(b, FIELD_MAP.news.date) || 0) - new Date(findValue(a, FIELD_MAP.news.date) || 0)
  );

  container.innerHTML = sorted
    .map((n) => {
      const title = findValue(n, FIELD_MAP.news.title);
      const content = findValue(n, FIELD_MAP.news.content);
      const date = findValue(n, FIELD_MAP.news.date);
      const image = toDirectImageUrl(findValue(n, FIELD_MAP.news.image));

      return `
        <div class="news-card">
          ${image ? `<img class="news-image" src="${escapeHtml(image)}" alt="${escapeHtml(title || "خبر")}" onerror="this.style.display='none';">` : ""}
          <div class="news-body">
            <h3 class="news-title">${escapeHtml(title || NO_DATA_TEXT)}</h3>
            ${date ? `<span class="news-date">${escapeHtml(formatArabicDate(date))}</span>` : ""}
            ${content ? `<p class="news-content">${escapeHtml(content)}</p>` : ""}
          </div>
        </div>
      `;
    })
    .join("");
}

function renderFooterYear() {
  setText("footerYear", new Date().getFullYear());
}

/* ------------------------------------------------------------
   9) تهيئة الصفحة العامة + التحديث التلقائي
   ------------------------------------------------------------ */
let pavoRefreshTimer = null;

async function initPublicSite() {
  await fetchPavoData();
  renderIdentityAndHero();
  renderPlayers();
  renderMatches();
  renderEvents();
  renderNews();
  renderFooterYear();

  if (pavoRefreshTimer) clearInterval(pavoRefreshTimer);
  pavoRefreshTimer = setInterval(async () => {
    const ok = await fetchPavoData();
    if (ok) {
      renderMatches();
      renderEvents();
      renderNews();
    }
  }, CONFIG.REFRESH_INTERVAL);
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page === "public") {
    initPublicSite();
  }
});
