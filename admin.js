
/* MTS Suvadi - SPA Admin */
function adminEscape(value) {
  return String(value ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}
function adminBookCounts(lending) {
  const counts = { overdue:0, pending:0, returned:0 };
  lending.forEach(raw => {
    const s = calculateBookStatus(normalizeLending(raw));
    if (s in counts) counts[s]++;
  });
  return counts;
}
function adminBookCountHtml(c) {
  return `<span class="admin-book-counts">
    <span class="admin-status-count overdue-count"><span class="overdue-dot">●</span> ${c.overdue}</span>
    <span class="admin-status-count pending-count"><span class="pending-dot">●</span> ${c.pending}</span>
    <span class="admin-status-count returned-count"><span class="returned-dot">●</span> ${c.returned}</span>
  </span>`;
}
function adminClassStatus(lending) {
  const counts = adminBookCounts(lending);
  if (counts.overdue > 0) return "red";
  if (counts.pending > 0) return "orange";
  return "green";
}
function adminStudentStatus(studentId, lending) {
  const books = lending.filter(b => String(b.studentId) === String(studentId));
  let pending = false;
  for (const b of books) {
    const s = calculateBookStatus(normalizeLending(b));
    if (s === "overdue") return "red";
    if (s === "pending") pending = true;
  }
  return pending ? "orange" : "green";
}
function adminGradeSort(a,b) {
  const special = x => /preschool/i.test(x) ? -3 : /kindergarten/i.test(x) ? -2 : /accelerated/i.test(x) ? -1 : null;
  const sa=special(String(a)), sb=special(String(b));
  if (sa !== null || sb !== null) {
    if (sa === null) return 1; if (sb === null) return -1;
    if (sa !== sb) return sa-sb;
  }
  const na=Number((String(a).match(/\d+/)||["999"])[0]);
  const nb=Number((String(b).match(/\d+/)||["999"])[0]);
  if (na!==nb) return na-nb;
  return String(a).localeCompare(String(b),undefined,{numeric:true,sensitivity:"base"});
}
async function requireAdminData() {
  const user = await waitForFirebaseAuth();
  if (!user) { spaNavigate("home",{},true); return null; }
  const data = await loadSuvadiData();
  if (data.mode !== "admin" || !data.admin?.active) { spaNavigate("home",{},true); return null; }
  return data;
}
function openAdminGrade(grade) {
  spaNavigate("admin-students", grade === "__ALL__" ? {} : {grade});
}
async function loadAdminHome() {
  const container=document.getElementById("admin-class-list");
  const schoolLabel=document.getElementById("admin-school");
  try {
    const data=await requireAdminData(); if(!data) return;
    schoolLabel.textContent=`${data.admin.school} Admin`;
    const students=data.students.map(normalizeStudent);
    const lending=data.lending.map(normalizeLending);
    const grades=[...new Set(students.map(s=>s.grade).filter(Boolean))].sort(adminGradeSort);
    const makeRow=(label, groupStudents)=>{
      const ids=new Set(groupStudents.map(s=>String(s.studentId)));
      const books=lending.filter(b=>ids.has(String(b.studentId)));
      const counts=adminBookCounts(books);
      const status=adminClassStatus(books);
      const arg=label==="All" ? "__ALL__" : label;
      return `<button class="admin-list-row" type="button" onclick='openAdminGrade(${JSON.stringify(arg)})'>
        <span class="admin-row-name suvadi-grade-status-${status}">${adminEscape(label)}
          <span class="admin-subcounts">${adminBookCountHtml(counts)}</span>
        </span>
        <span class="admin-row-right"><span class="admin-count">${groupStudents.length}</span><span class="admin-chevron">›</span></span>
      </button>`;
    };
    container.innerHTML=[makeRow("All",students), ...grades.map(g=>makeRow(g,students.filter(s=>s.grade===g)))].join("");
  } catch(e) { console.error(e); container.innerHTML=`<div class="admin-error">${adminEscape(e.message)}</div>`; }
}
function openAdminStudent(studentId) {
  setSelectedStudent(studentId);
  spaNavigate("student-books",{student:studentId,mode:"admin"});
}
async function loadAdminStudents() {
  const container=document.getElementById("admin-student-list");
  const title=document.getElementById("admin-students-title");
  const schoolLabel=document.getElementById("admin-students-school");
  try {
    const data=await requireAdminData(); if(!data) return;
    schoolLabel.textContent=`${data.admin.school} Admin`;
    const grade=new URLSearchParams(location.search).get("grade");
    title.textContent=grade||"All Students";
    let students=data.students.map(normalizeStudent);
    if(grade) students=students.filter(s=>s.grade===grade);
    students.sort((a,b)=>a.studentName.localeCompare(b.studentName,undefined,{sensitivity:"base"}));
    container.innerHTML=students.map(student=>{
      const books=data.lending.map(normalizeLending).filter(b=>String(b.studentId)===String(student.studentId));
      const counts=adminBookCounts(books);
      const status=adminStudentStatus(student.studentId,books);
      return `<button class="admin-list-row admin-student-row" type="button" onclick='openAdminStudent(${JSON.stringify(student.studentId)})'>
        <span class="admin-status-dot suvadi-status-${status}"></span>
        <span class="admin-student-name suvadi-status-${status}">${adminEscape(student.studentName)}
          <span class="admin-student-id">(${adminEscape(student.studentId)})</span>
          <span class="admin-subcounts">${adminBookCountHtml(counts)}</span>
        </span>
        <span class="admin-chevron">›</span>
      </button>`;
    }).join("") || `<div class="admin-empty">No students found.</div>`;
  } catch(e) { console.error(e); container.innerHTML=`<div class="admin-error">${adminEscape(e.message)}</div>`; }
}
async function adminSignOut(){ await signOutSuvadi(); }
