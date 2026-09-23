// ============================================================
// Nazrul Nazir & Co - Sistem Pengurusan Kes - app.js
// ============================================================

let currentUser = null;
let mattersCache = [];
let tasksCache = [];
let activeMatterId = null;

// ---------- INIT ----------
init();
async function init() {
  const { data } = await supabaseClient.auth.getSession();
  if (!data.session) { window.location.href = "index.html"; return; }
  currentUser = data.session.user;
  document.getElementById("userAvatar").textContent = (currentUser.email || "??").substring(0,2).toUpperCase();

  setupNav();
  document.getElementById("logoutBtn").addEventListener("click", logout);
  document.getElementById("bellBtn").addEventListener("click", () => switchView("notifications"));
  document.getElementById("addMatterBtn").addEventListener("click", () => openMatterModal());
  document.getElementById("saveMatterBtn").addEventListener("click", saveMatter);
  document.getElementById("addTaskBtn").addEventListener("click", () => openModal("taskModal"));
  document.getElementById("saveTaskBtn").addEventListener("click", saveTask);
  document.getElementById("saveCmBtn").addEventListener("click", saveCaseManagementRecord);
  document.getElementById("savePaymentBtn").addEventListener("click", savePayment);
  document.getElementById("matterSearch").addEventListener("input", renderMattersTable);
  document.getElementById("matterStatusFilter").addEventListener("change", renderMattersTable);
  document.getElementById("docMatterFilter").addEventListener("change", loadDocumentsForMatter);

  await loadAllData();
  switchView("dashboard");
}

async function logout() {
  await supabaseClient.auth.signOut();
  window.location.href = "index.html";
}

function setupNav() {
  document.querySelectorAll(".nav-item[data-view]").forEach(item => {
    item.addEventListener("click", () => switchView(item.dataset.view));
  });
}

function switchView(view) {
  document.querySelectorAll("[id^='view-']").forEach(el => el.style.display = "none");
  document.getElementById("view-" + view).style.display = "block";
  document.querySelectorAll(".nav-item[data-view]").forEach(el => el.classList.toggle("active", el.dataset.view === view));
  const titles = { dashboard: "Dashboard", matters: "Matters", calendar: "Calendar", tasks: "Tasks", documents: "Documents", accounts: "Accounts", notifications: "Notifications" };
  document.getElementById("viewTitle").textContent = titles[view];
  if (view === "dashboard") renderDashboard();
  if (view === "matters") renderMattersTable();
  if (view === "calendar") renderCalendar();
  if (view === "tasks") renderTasks();
  if (view === "accounts") renderAccounts();
  if (view === "notifications") renderNotifications();
}

// ---------- DATA LOADING ----------
async function loadAllData() {
  const [mattersRes, tasksRes] = await Promise.all([
    supabaseClient.from("matters").select("*").order("next_court_date", { ascending: true, nullsFirst: false }),
    supabaseClient.from("tasks").select("*").order("due_date", { ascending: true })
  ]);
  mattersCache = mattersRes.data || [];
  tasksCache = tasksRes.data || [];
  populateMatterDropdowns();
  updateBellBadge();
}

function populateMatterDropdowns() {
  const options = mattersCache.filter(m => m.status === "active")
    .map(m => `<option value="${m.id}">${escapeHtml(m.case_number)} - ${escapeHtml(m.case_title)}</option>`).join("");
  document.getElementById("t_matter").innerHTML = '<option value="">-- Tiada --</option>' + options;
  document.getElementById("docMatterFilter").innerHTML = '<option value="">Pilih Matter untuk lihat dokumen</option>' + options;
}

// ---------- HELPERS ----------
function escapeHtml(str) { return (str || "").toString().replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function fmtDate(d) { if (!d) return "-"; const [y,m,day] = d.split("-"); return `${day}/${m}/${y}`; }
function fmtMoney(n) { return "RM " + (Number(n) || 0).toLocaleString("en-MY", { minimumFractionDigits: 2 }); }
function daysUntil(dateStr) { if (!dateStr) return null; const diff = (new Date(dateStr) - new Date(new Date().toDateString())) / 86400000; return Math.round(diff); }
function openModal(id) { document.getElementById(id).classList.add("open"); }
function closeModal(id) { document.getElementById(id).classList.remove("open"); }
function showToast(msg, type) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.className = "toast show " + (type || "");
  setTimeout(() => t.className = "toast", 2500);
}

// ---------- DASHBOARD ----------
function renderDashboard() {
  const active = mattersCache.filter(m => m.status === "active");
  const upcomingDates = active.filter(m => m.next_court_date && daysUntil(m.next_court_date) >= 0).length;
  const overdueDeadlines = active.filter(m => m.deadline && daysUntil(m.deadline) < 0).length;
  const todayTasks = tasksCache.filter(t => t.status === "pending" && t.due_date === todayStr()).length;
  const overdueTasks = tasksCache.filter(t => t.status === "pending" && t.due_date && t.due_date < todayStr()).length;
  const outstanding = active.reduce((sum, m) => sum + ((Number(m.fee_agreed)||0) - (Number(m.amount_paid)||0)), 0);

  document.getElementById("dashboardStats").innerHTML = `
    <div class="card stat-card"><div class="num">${active.length}</div><div class="label">Jumlah Perkara Aktif</div></div>
    <div class="card stat-card"><div class="num">${upcomingDates}</div><div class="label">Tarikh Mahkamah Akan Datang</div></div>
    <div class="card stat-card warning"><div class="num">${overdueDeadlines}</div><div class="label">Deadline Belum Selesai</div></div>
    <div class="card stat-card danger"><div class="num">${fmtMoney(outstanding)}</div><div class="label">Fi Belum Dibayar</div></div>
  `;

  const upcoming = active.filter(m => m.next_court_date).sort((a,b) => a.next_court_date.localeCompare(b.next_court_date)).slice(0, 8);
  document.getElementById("upcomingDatesList").innerHTML = upcoming.length ? upcoming.map(m => {
    const d = daysUntil(m.next_court_date);
    const badge = d < 0 ? '<span class="badge badge-overdue">Overdue</span>' : (d <= 3 ? '<span class="badge badge-upcoming">Hampir</span>' : "");
    return `<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f0f0f0;">
      <div><span class="case-number-badge">${escapeHtml(m.case_number)}</span><div style="margin-top:4px;font-size:13px;">${escapeHtml(m.case_title)}</div></div>
      <div style="text-align:right;"><div style="font-weight:700;">${fmtDate(m.next_court_date)}</div>${badge}</div>
    </div>`;
  }).join("") : '<div class="empty-state">Tiada tarikh akan datang.</div>';

  const today = tasksCache.filter(t => t.status === "pending" && t.due_date === todayStr());
  document.getElementById("todayTasksList").innerHTML = today.length ? today.map(t => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #f0f0f0;">
      <span>${escapeHtml(t.title)}</span>
      <button class="btn btn-outline btn-sm" onclick="toggleTaskDone('${t.id}', true)">Done</button>
    </div>`).join("") : '<div class="empty-state">Tiada tugasan hari ini.</div>';
}

function todayStr() { return new Date().toISOString().split("T")[0]; }

// ---------- MATTERS ----------
function renderMattersTable() {
  const search = document.getElementById("matterSearch").value.toLowerCase();
  const statusFilter = document.getElementById("matterStatusFilter").value;
  let rows = mattersCache.filter(m => {
    const matchSearch = !search || (m.case_number||"").toLowerCase().includes(search) || (m.case_title||"").toLowerCase().includes(search) || (m.client_name||"").toLowerCase().includes(search);
    const matchStatus = !statusFilter || m.status === statusFilter;
    return matchSearch && matchStatus;
  }).sort((a,b) => (a.next_court_date||"9999").localeCompare(b.next_court_date||"9999"));

  document.getElementById("mattersEmptyState").style.display = rows.length ? "none" : "block";
  document.getElementById("mattersTableBody").innerHTML = rows.map(m => {
    const baki = (Number(m.fee_agreed)||0) - (Number(m.amount_paid)||0);
    return `<tr>
      <td><span class="case-number-badge">${escapeHtml(m.case_number)}</span></td>
      <td>${escapeHtml(m.case_title)}</td>
      <td>${escapeHtml(m.client_name || "-")}</td>
      <td>${fmtDate(m.next_court_date)}</td>
      <td><span class="badge badge-${m.status}">${m.status}</span></td>
      <td>${fmtMoney(baki)}</td>
      <td>
        <button class="btn btn-outline btn-sm" onclick="openMatterDetail('${m.id}')">Buka</button>
        <button class="btn btn-outline btn-sm" onclick="openMatterModal('${m.id}')">Edit</button>
      </td>
    </tr>`;
  }).join("");
}

function openMatterModal(id) {
  document.getElementById("matterModalError").style.display = "none";
  if (id) {
    const m = mattersCache.find(x => x.id === id);
    document.getElementById("matterModalTitle").textContent = "Edit Matter";
    document.getElementById("matterId").value = m.id;
    document.getElementById("m_case_number").value = m.case_number || "";
    document.getElementById("m_case_title").value = m.case_title || "";
    document.getElementById("m_court_name").value = m.court_name || "";
    document.getElementById("m_category").value = m.category || "";
    document.getElementById("m_status").value = m.status || "active";
    document.getElementById("m_client_name").value = m.client_name || "";
    document.getElementById("m_we_act_for").value = m.we_act_for || "";
    document.getElementById("m_client_role").value = m.client_role || "";
    document.getElementById("m_next_court_date").value = m.next_court_date || "";
    document.getElementById("m_next_court_time").value = m.next_court_time || "";
    document.getElementById("m_proceeding_type").value = m.proceeding_type || "";
    document.getElementById("m_deadline").value = m.deadline || "";
    document.getElementById("m_next_action").value = m.next_action || "";
    document.getElementById("m_fee_agreed").value = m.fee_agreed || 0;
    document.getElementById("m_amount_paid").value = m.amount_paid || 0;
  } else {
    document.getElementById("matterModalTitle").textContent = "Add Matter";
    ["matterId","m_case_number","m_case_title","m_court_name","m_category","m_client_name","m_we_act_for",
     "m_client_role","m_next_court_date","m_next_court_time","m_proceeding_type","m_deadline","m_next_action"]
     .forEach(id => document.getElementById(id).value = "");
    document.getElementById("m_status").value = "active";
    document.getElementById("m_fee_agreed").value = 0;
    document.getElementById("m_amount_paid").value = 0;
  }
  openModal("matterModal");
}

async function saveMatter() {
  const id = document.getElementById("matterId").value;
  const caseNumber = document.getElementById("m_case_number").value.trim();
  const caseTitle = document.getElementById("m_case_title").value.trim();
  const errEl = document.getElementById("matterModalError");
  if (!caseNumber || !caseTitle) {
    errEl.textContent = "Nombor kes dan tajuk kes wajib diisi."; errEl.style.display = "block"; return;
  }
  const payload = {
    case_number: caseNumber,
    case_title: caseTitle,
    court_name: document.getElementById("m_court_name").value,
    category: document.getElementById("m_category").value,
    status: document.getElementById("m_status").value,
    client_name: document.getElementById("m_client_name").value,
    we_act_for: document.getElementById("m_we_act_for").value,
    client_role: document.getElementById("m_client_role").value || null,
    next_court_date: document.getElementById("m_next_court_date").value || null,
    next_court_time: document.getElementById("m_next_court_time").value || null,
    proceeding_type: document.getElementById("m_proceeding_type").value,
    deadline: document.getElementById("m_deadline").value || null,
    next_action: document.getElementById("m_next_action").value,
    fee_agreed: Number(document.getElementById("m_fee_agreed").value) || 0,
    amount_paid: Number(document.getElementById("m_amount_paid").value) || 0,
    updated_at: new Date().toISOString()
  };

  const btn = document.getElementById("saveMatterBtn");
  btn.disabled = true; btn.innerHTML = '<span class="loading-spinner"></span>';

  let error;
  if (id) {
    ({ error } = await supabaseClient.from("matters").update(payload).eq("id", id));
  } else {
    payload.created_by = currentUser.id;
    ({ error } = await supabaseClient.from("matters").insert(payload));
  }

  btn.disabled = false; btn.textContent = "Simpan";

  if (error) {
    errEl.textContent = error.message.includes("duplicate") ? "Nombor kes ini sudah wujud." : "Ralat: " + error.message;
    errEl.style.display = "block";
    return;
  }
  showToast("Matter disimpan.", "success");
  closeModal("matterModal");
  await loadAllData();
  renderMattersTable();
}

// ---------- MATTER DETAIL (chronology + payment) ----------
async function openMatterDetail(id) {
  activeMatterId = id;
  const m = mattersCache.find(x => x.id === id);
  document.getElementById("detailCaseNumber").textContent = m.case_number;
  document.getElementById("detailCaseTitle").textContent = m.case_title;
  document.getElementById("detailMeta").textContent = `${m.court_name || "-"} | ${m.client_name || "-"} (${m.client_role || "-"}) | Baki: ${fmtMoney((Number(m.fee_agreed)||0)-(Number(m.amount_paid)||0))}`;
  openModal("matterDetailModal");
  await loadChronology(id);
}

async function loadChronology(matterId) {
  const { data } = await supabaseClient.from("case_management_records").select("*").eq("matter_id", matterId).order("created_at", { ascending: false });
  const list = data || [];
  document.getElementById("chronologyList").innerHTML = list.length ? list.map(r => `
    <div style="border-left:3px solid #1e3a8a; padding:8px 12px; margin-bottom:10px; background:#f9fafb; border-radius:0 8px 8px 0;">
      <div style="font-size:12px; color:#6b7280;">${fmtDate(r.cm_date)} · ${r.record_type}</div>
      ${r.what_happened ? `<div style="font-size:13px; margin-top:4px;">${escapeHtml(r.what_happened)}</div>` : ""}
      ${r.next_action ? `<div style="font-size:12px; margin-top:4px;"><b>Tindakan:</b> ${escapeHtml(r.next_action)}</div>` : ""}
      ${r.new_date ? `<div style="font-size:12px;"><b>Tarikh Baharu:</b> ${fmtDate(r.new_date)} (${r.new_date_type||""})</div>` : ""}
      ${r.amount ? `<div style="font-size:12px;"><b>Bayaran:</b> ${fmtMoney(r.amount)}</div>` : ""}
    </div>`).join("") : '<div class="empty-state">Belum ada rekod.</div>';
}

async function saveCaseManagementRecord() {
  if (!activeMatterId) return;
  const payload = {
    matter_id: activeMatterId,
    record_type: "case_management",
    cm_date: document.getElementById("cm_date").value || null,
    attendance: document.getElementById("cm_attendance").value,
    what_happened: document.getElementById("cm_what_happened").value,
    orders_given: document.getElementById("cm_orders").value,
    new_date: document.getElementById("cm_new_date").value || null,
    new_date_type: document.getElementById("cm_new_date_type").value || null,
    next_action: document.getElementById("cm_next_action").value,
    recorded_by: currentUser.id
  };
  const { error } = await supabaseClient.from("case_management_records").insert(payload);
  if (error) { showToast("Ralat simpan rekod: " + error.message, "error"); return; }

  // auto-update matter next date/action bila ada tarikh baharu
  if (payload.new_date) {
    await supabaseClient.from("matters").update({
      next_court_date: payload.new_date,
      proceeding_type: payload.new_date_type,
      next_action: payload.next_action,
      updated_at: new Date().toISOString()
    }).eq("id", activeMatterId);
  }

  showToast("Rekod Case Management disimpan.", "success");
  ["cm_date","cm_attendance","cm_what_happened","cm_orders","cm_new_date","cm_new_date_type","cm_next_action"].forEach(id => document.getElementById(id).value = "");
  await loadChronology(activeMatterId);
  await loadAllData();
}

async function savePayment() {
  if (!activeMatterId) return;
  const amount = Number(document.getElementById("pay_amount").value);
  const type = document.getElementById("pay_type").value;
  if (!amount || amount <= 0) { showToast("Sila isi jumlah bayaran.", "error"); return; }

  const { error } = await supabaseClient.from("payments").insert({ matter_id: activeMatterId, amount, payment_type: type, recorded_by: currentUser.id });
  if (error) { showToast("Ralat: " + error.message, "error"); return; }

  if (type === "payment") {
    const m = mattersCache.find(x => x.id === activeMatterId);
    await supabaseClient.from("matters").update({ amount_paid: (Number(m.amount_paid)||0) + amount }).eq("id", activeMatterId);
  }
  await supabaseClient.from("case_management_records").insert({ matter_id: activeMatterId, record_type: "payment", amount, next_action: "", recorded_by: currentUser.id });

  showToast("Bayaran direkodkan.", "success");
  document.getElementById("pay_amount").value = "";
  await loadAllData();
  await loadChronology(activeMatterId);
}

// ---------- CALENDAR ----------
function renderCalendar() {
  const active = mattersCache.filter(m => m.status === "active");
  const events = [];
  active.forEach(m => {
    if (m.next_court_date) events.push({ date: m.next_court_date, time: m.next_court_time, title: `${m.case_number} - ${m.proceeding_type || "Court Date"}`, matter: m });
    if (m.deadline) events.push({ date: m.deadline, time: null, title: `${m.case_number} - Deadline`, matter: m });
  });
  events.sort((a,b) => a.date.localeCompare(b.date));

  document.getElementById("calendarList").innerHTML = events.length ? events.map(e => {
    const d = daysUntil(e.date);
    const badge = d < 0 ? '<span class="badge badge-overdue">Overdue</span>' : (d<=3 ? '<span class="badge badge-upcoming">Hampir</span>' : "");
    const gcalUrl = googleCalendarLink(e);
    const icsUrl = icsDataUrl(e);
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid #f0f0f0;">
      <div><div style="font-weight:600;">${escapeHtml(e.title)}</div><div style="font-size:12px;color:#6b7280;">${fmtDate(e.date)} ${e.time || ""}</div></div>
      <div style="display:flex; gap:8px; align-items:center;">${badge}
        <a class="btn btn-outline btn-sm" target="_blank" href="${gcalUrl}">+ Google</a>
        <a class="btn btn-outline btn-sm" download="event.ics" href="${icsUrl}">.ics</a>
      </div>
    </div>`;
  }).join("") : '<div class="empty-state">Tiada tarikh direkodkan.</div>';
}

function googleCalendarLink(e) {
  const d = e.date.replace(/-/g,"");
  const start = e.time ? `${d}T${e.time.replace(":","")}00` : `${d}`;
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(e.title)}&dates=${start}/${start}`;
}
function icsDataUrl(e) {
  const d = e.date.replace(/-/g,"");
  const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nDTSTART;VALUE=DATE:${d}\nSUMMARY:${e.title}\nEND:VEVENT\nEND:VCALENDAR`;
  return "data:text/calendar;charset=utf8," + encodeURIComponent(ics);
}

// ---------- TASKS ----------
function renderTasks() {
  const active = tasksCache.filter(t => t.status === "pending").sort((a,b) => (a.due_date||"9999").localeCompare(b.due_date||"9999"));
  const completed = tasksCache.filter(t => t.status === "completed");

  document.getElementById("activeTasksList").innerHTML = active.length ? active.map(t => {
    const overdue = t.due_date && t.due_date < todayStr();
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #f0f0f0;">
      <div><div style="font-weight:600;">${escapeHtml(t.title)}</div>
        <div style="font-size:12px;color:#6b7280;">${fmtDate(t.due_date)} · Priority: ${t.priority} ${overdue ? '<span class="badge badge-overdue">Overdue</span>' : ""}</div></div>
      <button class="btn btn-primary btn-sm" onclick="toggleTaskDone('${t.id}', true)">Done</button>
    </div>`;
  }).join("") : '<div class="empty-state">Tiada tugasan aktif.</div>';

  document.getElementById("completedTasksList").innerHTML = completed.length ? completed.map(t => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #f0f0f0; opacity:0.6;">
      <span style="text-decoration:line-through;">${escapeHtml(t.title)}</span>
      <button class="btn btn-outline btn-sm" onclick="toggleTaskDone('${t.id}', false)">Buka Semula</button>
    </div>`).join("") : '<div class="empty-state">Belum ada tugasan selesai.</div>';
}

async function toggleTaskDone(id, done) {
  await supabaseClient.from("tasks").update({ status: done ? "completed" : "pending", completed_at: done ? new Date().toISOString() : null }).eq("id", id);
  showToast(done ? "Tugasan selesai." : "Tugasan dibuka semula.", "success");
  await loadAllData();
  renderTasks(); renderDashboard();
}

async function saveTask() {
  const title = document.getElementById("t_title").value.trim();
  if (!title) { showToast("Sila isi tajuk tugasan.", "error"); return; }
  const payload = {
    title,
    due_date: document.getElementById("t_date").value || null,
    priority: document.getElementById("t_priority").value,
    matter_id: document.getElementById("t_matter").value || null,
    notes: document.getElementById("t_notes").value,
    assigned_to: currentUser.id,
    created_by: currentUser.id
  };
  const { error } = await supabaseClient.from("tasks").insert(payload);
  if (error) { showToast("Ralat: " + error.message, "error"); return; }
  showToast("Task ditambah.", "success");
  closeModal("taskModal");
  ["t_title","t_date","t_notes"].forEach(id => document.getElementById(id).value = "");
  await loadAllData();
  renderTasks();
}

// ---------- DOCUMENTS ----------
async function loadDocumentsForMatter() {
  const matterId = document.getElementById("docMatterFilter").value;
  const listEl = document.getElementById("documentsList");
  if (!matterId) { listEl.innerHTML = '<div class="empty-state">Sila pilih matter di atas.</div>'; return; }

  listEl.innerHTML = '<div class="empty-state"><span class="loading-spinner"></span> Memuatkan...</div>';
  const { data } = await supabaseClient.from("documents").select("*").eq("matter_id", matterId).order("uploaded_at", { ascending: false });

  const uploadHtml = `
    <div style="margin-bottom:16px;">
      <input type="file" id="docFileInput">
      <select id="docCategorySelect"><option value="cause_paper">Cause Paper</option><option value="correspondence">Correspondence</option></select>
      <button class="btn btn-primary btn-sm" onclick="uploadDocument('${matterId}')">Upload</button>
    </div>`;

  const list = data || [];
  listEl.innerHTML = uploadHtml + (list.length ? `<table><thead><tr><th>Fail</th><th>Kategori</th><th>Tarikh</th><th></th></tr></thead><tbody>` +
    list.map(d => `<tr><td>${escapeHtml(d.file_name)}</td><td>${d.category}</td><td>${new Date(d.uploaded_at).toLocaleDateString("ms-MY")}</td>
      <td><a class="btn btn-outline btn-sm" href="#" onclick="downloadDoc('${d.file_path}'); return false;">Download</a></td></tr>`).join("") +
    `</tbody></table>` : '<div class="empty-state">Belum ada dokumen.</div>');
}

async function uploadDocument(matterId) {
  const fileInput = document.getElementById("docFileInput");
  const category = document.getElementById("docCategorySelect").value;
  const file = fileInput.files[0];
  if (!file) { showToast("Sila pilih fail.", "error"); return; }
  const maxSize = 20 * 1024 * 1024;
  if (file.size > maxSize) { showToast("Saiz fail melebihi 20MB.", "error"); return; }

  showToast("Memuat naik...", "");
  const path = `${matterId}/${Date.now()}_${file.name}`;
  const { error: uploadErr } = await supabaseClient.storage.from("documents").upload(path, file);
  if (uploadErr) { showToast("Ralat upload: " + uploadErr.message, "error"); return; }

  const { error: dbErr } = await supabaseClient.from("documents").insert({
    matter_id: matterId, category, doc_type: category, file_path: path, file_name: file.name, uploaded_by: currentUser.id
  });
  if (dbErr) { showToast("Ralat simpan rekod: " + dbErr.message, "error"); return; }

  showToast("Dokumen dimuat naik.", "success");
  loadDocumentsForMatter();
}

async function downloadDoc(path) {
  const { data, error } = await supabaseClient.storage.from("documents").createSignedUrl(path, 60);
  if (error) { showToast("Ralat: " + error.message, "error"); return; }
  window.open(data.signedUrl, "_blank");
}

// ---------- ACCOUNTS ----------
function renderAccounts() {
  const active = mattersCache.filter(m => m.status === "active");
  const totalFee = active.reduce((s,m) => s + (Number(m.fee_agreed)||0), 0);
  const totalPaid = active.reduce((s,m) => s + (Number(m.amount_paid)||0), 0);
  const totalOutstanding = totalFee - totalPaid;

  document.getElementById("accountsStats").innerHTML = `
    <div class="card stat-card"><div class="num">${fmtMoney(totalFee)}</div><div class="label">Jumlah Fi Dipersetujui</div></div>
    <div class="card stat-card" style="color:#16a34a;"><div class="num">${fmtMoney(totalPaid)}</div><div class="label">Telah Dibayar</div></div>
    <div class="card stat-card danger"><div class="num">${fmtMoney(totalOutstanding)}</div><div class="label">Baki Tertunggak</div></div>
  `;
  document.getElementById("accountsTableBody").innerHTML = active.map(m => {
    const baki = (Number(m.fee_agreed)||0) - (Number(m.amount_paid)||0);
    return `<tr><td><span class="case-number-badge">${escapeHtml(m.case_number)}</span></td>
      <td>${fmtMoney(m.fee_agreed)}</td><td>${fmtMoney(m.amount_paid)}</td><td>${fmtMoney(baki)}</td>
      <td><button class="btn btn-outline btn-sm" onclick="openMatterDetail('${m.id}')">Rekod Bayaran</button></td></tr>`;
  }).join("");
}

// ---------- NOTIFICATIONS ----------
function computeNotifications() {
  const active = mattersCache.filter(m => m.status === "active");
  const items = [];
  active.forEach(m => {
    if (m.next_court_date) {
      const d = daysUntil(m.next_court_date);
      if (d < 0) items.push({ type: "danger", text: `Tarikh mahkamah TERLEPAS untuk ${m.case_number}`, matterId: m.id });
      else if (d <= 3) items.push({ type: "warning", text: `Tarikh mahkamah ${m.case_number} dalam ${d} hari`, matterId: m.id });
    }
    if (m.deadline) {
      const d = daysUntil(m.deadline);
      if (d < 0) items.push({ type: "danger", text: `Deadline OVERDUE untuk ${m.case_number}`, matterId: m.id });
      else if (d <= 3) items.push({ type: "warning", text: `Deadline ${m.case_number} dalam ${d} hari`, matterId: m.id });
    }
    const baki = (Number(m.fee_agreed)||0) - (Number(m.amount_paid)||0);
    if (baki > 0) items.push({ type: "info", text: `Fi tertunggak ${fmtMoney(baki)} untuk ${m.case_number}`, matterId: m.id });
  });
  tasksCache.filter(t => t.status === "pending" && t.due_date && t.due_date <= todayStr()).forEach(t => {
    items.push({ type: t.due_date < todayStr() ? "danger" : "warning", text: `Tugasan: ${t.title}`, matterId: null });
  });
  return items;
}

function updateBellBadge() {
  const count = computeNotifications().length;
  const badge = document.getElementById("bellBadge");
  badge.style.display = count ? "block" : "none";
  badge.textContent = count;
}

function renderNotifications() {
  const items = computeNotifications();
  document.getElementById("notificationsList").innerHTML = items.length ? items.map(n => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid #f0f0f0; cursor:${n.matterId?"pointer":"default"};" ${n.matterId ? `onclick="openMatterDetail('${n.matterId}')"` : ""}>
      <span>${escapeHtml(n.text)}</span>
      <span class="badge badge-${n.type === "danger" ? "overdue" : n.type === "warning" ? "upcoming" : "active"}">${n.type}</span>
    </div>`).join("") : '<div class="empty-state">Tiada notifikasi.</div>';
}
