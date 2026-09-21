/* MTS Suvadi - SPA Admin */

function adminEscape(value) {
  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
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
    <span class="admin-status-count overdue-count">
      <span class="overdue-dot">●</span> ${c.overdue}
    </span>
    <span class="admin-status-count pending-count">
      <span class="pending-dot">●</span> ${c.pending}
    </span>
    <span class="admin-status-count returned-count">
      <span class="returned-dot">●</span> ${c.returned}
    </span>
  </span>`;
}

function adminClassStatus(lending) {
  const counts = adminBookCounts(lending);

  if (counts.overdue > 0) return "red";
  if (counts.pending > 0) return "orange";

  return "green";
}

function adminStudentStatus(studentId, lending) {
  const books = lending.filter(
    b => String(b.studentId) === String(studentId)
  );

  let pending = false;

  for (const b of books) {
    const s = calculateBookStatus(normalizeLending(b));

    if (s === "overdue") return "red";
    if (s === "pending") pending = true;
  }

  return pending ? "orange" : "green";
}

function adminGradeSort(a,b) {
  const special = x =>
    /preschool/i.test(x) ? -3 :
    /kindergarten/i.test(x) ? -2 :
    /accelerated/i.test(x) ? -1 :
    null;

  const sa = special(String(a));
  const sb = special(String(b));

  if (sa !== null || sb !== null) {
    if (sa === null) return 1;
    if (sb === null) return -1;
    if (sa !== sb) return sa - sb;
  }

  const na = Number((String(a).match(/\d+/) || ["999"])[0]);
  const nb = Number((String(b).match(/\d+/) || ["999"])[0]);

  if (na !== nb) return na - nb;

  return String(a).localeCompare(
    String(b),
    undefined,
    { numeric:true, sensitivity:"base" }
  );
}

async function requireAdminData() {
  const user = await waitForFirebaseAuth();

  if (!user) {
    spaNavigate("home", {}, true);
    return null;
  }

  const data = await loadSuvadiData();

  if (data.mode !== "admin" || !data.admin?.active) {
    spaNavigate("home", {}, true);
    return null;
  }

  return data;
}

function openAdminGrade(grade) {
  spaNavigate(
    "admin-students",
    grade === "__ALL__" ? {} : { grade }
  );
}

async function loadAdminHome() {
  const container = document.getElementById("admin-class-list");
  const schoolLabel = document.getElementById("admin-school");

  try {
    const data = await requireAdminData();
    if (!data) return;

    schoolLabel.textContent = `${data.admin.school} Admin`;

    const students = data.students.map(normalizeStudent);
    const lending = data.lending.map(normalizeLending);

    const grades = [
      ...new Set(
        students
          .map(s => s.grade)
          .filter(Boolean)
      )
    ].sort(adminGradeSort);

    const makeRow = (label, groupStudents) => {
      const ids = new Set(
        groupStudents.map(s => String(s.studentId))
      );

      const books = lending.filter(
        b => ids.has(String(b.studentId))
      );

      const counts = adminBookCounts(books);
      const status = adminClassStatus(books);
      const arg = label === "All" ? "__ALL__" : label;

      return `
        <button
          class="admin-list-row"
          type="button"
          onclick='openAdminGrade(${JSON.stringify(arg)})'>

          <span class="admin-row-name suvadi-grade-status-${status}">
            ${adminEscape(label)}
            <span class="admin-subcounts">
              ${adminBookCountHtml(counts)}
            </span>
          </span>

          <span class="admin-row-right">
            <span class="admin-count">${groupStudents.length}</span>
            <span class="admin-chevron">›</span>
          </span>

        </button>
      `;
    };

    container.innerHTML = [
      makeRow("All", students),
      ...grades.map(
        g => makeRow(
          g,
          students.filter(s => s.grade === g)
        )
      )
    ].join("");

  } catch(e) {
    console.error(e);

    if (container) {
      container.innerHTML =
        `<div class="admin-error">${adminEscape(e.message)}</div>`;
    }
  }
}

function openAdminStudent(studentId) {
  setSelectedStudent(studentId);

  spaNavigate(
    "student-books",
    {
      student: studentId,
      mode: "admin"
    }
  );
}

async function loadAdminStudents() {
  const container =
    document.getElementById("admin-student-list");

  const title =
    document.getElementById("admin-students-title");

  const schoolLabel =
    document.getElementById("admin-students-school");

  /*
   * These elements belong to screen-admin-students.
   * If they are missing, show a useful console error
   * instead of throwing "setting innerHTML of null".
   */
  if (!container || !title || !schoolLabel) {
    console.error(
      "Admin Students screen is missing required HTML elements:",
      {
        container: !!container,
        title: !!title,
        schoolLabel: !!schoolLabel
      }
    );
    return;
  }

  try {
    const data = await requireAdminData();
    if (!data) return;

    schoolLabel.textContent =
      `${data.admin.school} Admin`;

    const grade =
      new URLSearchParams(location.search).get("grade");

    title.textContent =
      grade || "All Students";

    let students =
      data.students.map(normalizeStudent);

    if (grade) {
      students =
        students.filter(s => s.grade === grade);
    }

    students.sort(
      (a,b) =>
        a.studentName.localeCompare(
          b.studentName,
          undefined,
          { sensitivity:"base" }
        )
    );

    container.innerHTML =
      students.map(student => {

        const books =
          data.lending
            .map(normalizeLending)
            .filter(
              b =>
                String(b.studentId) ===
                String(student.studentId)
            );

        const counts =
          adminBookCounts(books);

        const status =
          adminStudentStatus(
            student.studentId,
            books
          );

        return `
          <button
            class="admin-list-row admin-student-row"
            type="button"
            onclick='openAdminStudent(${JSON.stringify(student.studentId)})'>

             <span class="admin-student-name suvadi-status-${status}">
              ${adminEscape(student.studentName)}
              <span class="admin-subcounts">
                ${adminBookCountHtml(counts)}
              </span>
            </span>

            <span class="admin-chevron">›</span>

          </button>
        `;
      }).join("")
      ||
      `<div class="admin-empty">No students found.</div>`;

  } catch(e) {
    console.error(e);

    container.innerHTML =
      `<div class="admin-error">${adminEscape(e.message)}</div>`;
  }
}

async function loadAdminReaders() {
  const container =
    document.getElementById("admin-readers-list");

  const schoolLabel =
    document.getElementById("admin-readers-school");

  if (!container || !schoolLabel) {
    console.error(
      "Readers List screen is missing required HTML elements:",
      {
        container: !!container,
        schoolLabel: !!schoolLabel
      }
    );
    return;
  }

  try {
    const data = await requireAdminData();
    if (!data) return;

    schoolLabel.textContent =
      `${data.admin.school} Admin`;

    const students =
      data.students.map(normalizeStudent);

    const lending =
      data.lending.map(normalizeLending);


    /*
     * Count books marked READ for each student.
     */

    const readCountByStudent = new Map();

    lending.forEach(book => {
      if (book.bookRead === true) {
        const studentId =
          String(book.studentId);

        readCountByStudent.set(
          studentId,
          (readCountByStudent.get(studentId) || 0) + 1
        );
      }
    });


    /*
     * Exclude zero-read students and
     * sort highest Books Read first.
     */

    const readers =
      students
        .map(student => ({
          student,
          booksRead:
            readCountByStudent.get(
              String(student.studentId)
            ) || 0
        }))
        .filter(
          reader => reader.booksRead > 0
        )
        .sort((a,b) => {
          if (b.booksRead !== a.booksRead) {
            return b.booksRead - a.booksRead;
          }

          return a.student.studentName.localeCompare(
            b.student.studentName,
            undefined,
            { sensitivity:"base" }
          );
        });


    /*
     * No readers yet.
     */

    if (!readers.length) {
      container.innerHTML = `
        <div class="readers-empty">

          <div class="readers-empty-icon">
            📖
          </div>

          <div class="readers-empty-title">
            Students are reading now...
          </div>

          <div class="readers-empty-message">
            Please come back soon!
          </div>

        </div>
      `;

      return;
    }


    /*
     * Display Readers List.
     */

    container.innerHTML =
      readers.map(({ student, booksRead }) => `
        <button
          class="reader-list-row"
          type="button"
          onclick='openAdminReaderBooks(${JSON.stringify(student.studentId)})'>

          <span class="reader-info">

            <span class="reader-name">
              ${adminEscape(student.studentName)}
            </span>

            <span class="reader-grade">
              ${adminEscape(student.grade)}
            </span>

          </span>

          <span class="reader-book-count">
            <span class="reader-book-icon">📖</span>
            ${booksRead}
          </span>

          <span class="admin-chevron">
            ›
          </span>

        </button>
      `).join("");

  } catch(error) {
    console.error(error);

    container.innerHTML =
      `<div class="admin-error">
         ${adminEscape(error.message)}
       </div>`;
  }
}
function openAdminReaderBooks(studentId) {

  setSelectedStudent(studentId);

  spaNavigate(
    "admin-reader-books",
    { student: studentId }
  );
}


async function loadAdminReaderBooks() {

  const title =
    document.getElementById(
      "admin-reader-books-title"
    );

  const schoolLabel =
    document.getElementById(
      "admin-reader-books-school"
    );

  const countElement =
    document.getElementById(
      "admin-reader-books-count"
    );

  const container =
    document.getElementById(
      "admin-reader-books-list"
    );


  if (
    !title ||
    !schoolLabel ||
    !countElement ||
    !container
  ) {

    console.error(
      "Reader Books screen is missing required HTML elements."
    );

    return;
  }


  try {

    const data =
      await requireAdminData();

    if (!data) return;


    const studentId =
      new URLSearchParams(
        location.search
      ).get("student");


    if (!studentId) {

      container.innerHTML =
        `<div class="admin-empty">
           No student selected.
         </div>`;

      return;
    }


    /*
     * Find selected student.
     */

    const students =
      data.students.map(
        normalizeStudent
      );


    const student =
      students.find(
        s =>
          String(s.studentId) ===
          String(studentId)
      );


    if (!student) {

      container.innerHTML =
        `<div class="admin-empty">
           Student not found.
         </div>`;

      return;
    }


    /*
     * Header
     */

    title.textContent =
      `${student.studentName} - ${student.grade}`;

    /*
     * Get only books marked READ.
     */

    const books =
      data.lending
        .map(normalizeLending)

        .filter(book =>
          String(book.studentId) ===
            String(studentId) &&
          book.bookRead === true
        );


    /*
     * Convert bookReadUpdateTime into
     * a JavaScript Date for sorting/display.
     */

    function getReadDate(book) {

      const value =
        book.bookReadUpdateTime;


      if (!value) {
        return null;
      }


      /*
       * Firestore Timestamp
       */

      if (
        typeof value.toDate ===
        "function"
      ) {

        return value.toDate();

      }


      /*
       * JavaScript Date
       */

      if (value instanceof Date) {

        return value;

      }


      /*
       * Other date representation
       */

      const parsed =
        new Date(value);


      return isNaN(parsed.getTime())
        ? null
        : parsed;
    }


    /*
     * Newest Read date first.
     */

    books.sort((a,b) => {

      const dateA =
        getReadDate(a);

      const dateB =
        getReadDate(b);


      const timeA =
        dateA
          ? dateA.getTime()
          : 0;

      const timeB =
        dateB
          ? dateB.getTime()
          : 0;


      return timeB - timeA;

    });


    /*
     * Books Read count.
     */

    countElement.innerHTML =
      `<span class="reader-books-count-icon">
         📖
       </span>
       Books Read:
       <strong>${books.length}</strong>`;


    /*
     * No books marked read.
     */

    if (!books.length) {

      container.innerHTML = `
        <div class="readers-empty">

          <div class="readers-empty-icon">
            📖
          </div>

          <div class="readers-empty-title">
            No books marked as read.
          </div>

        </div>
      `;

      return;
    }


    /*
     * Format read date.
     */

    function formatReadDate(book) {

      const date =
        getReadDate(book);


      if (!date) {
        return "";
      }


      return new Intl.DateTimeFormat(
        "en-US",
        {
          month: "numeric",
          day: "numeric",
          year: "numeric"
        }
      ).format(date);

    }


    /*
     * Display simple Books Read list.
     */

    container.innerHTML =
      books.map(book => {

        /*
         * Current library status:
         *
         * overdue  = red
         * pending  = orange
         * returned = green
         */

        const status =
          calculateBookStatus(book);


        let statusClass =
          "reader-book-returned";


        if (status === "overdue") {

          statusClass =
            "reader-book-overdue";

        }
        else if (status === "pending") {

          statusClass =
            "reader-book-pending";

        }


        const readDate =
          formatReadDate(book);


        return `
          <div class="reader-book-row">

            <span class="reader-book-title ${statusClass}">

              <span class="reader-book-title-icon">
                📖
              </span>

              ${adminEscape(book.bookTitle)}

            </span>

            ${
              readDate
                ? `<span class="reader-book-date">
                     (${adminEscape(readDate)})
                   </span>`
                : ""
            }

          </div>
        `;

      }).join("");

  }

  catch(error) {

    console.error(error);

    container.innerHTML =
      `<div class="admin-error">
         ${adminEscape(error.message)}
       </div>`;

  }
}
async function adminSignOut() {
  await signOutSuvadi();
}


function toggleAdminGradeGroup(groupId) {

  const body =
    document.getElementById(groupId);

  const arrow =
    document.getElementById(groupId + "-arrow");

  if (!body) return;

  if (body.hidden) {

    // Currently collapsed -> expand
    body.hidden = false;

    if (arrow) {
      arrow.textContent = "▼";
    }

  } else {

    // Currently expanded -> collapse
    body.hidden = true;

    if (arrow) {
      arrow.textContent = "▶";
    }

  }
}

/* ============================================================
 * ADMIN - APP USAGE AUDIT
 * ============================================================ */
async function loadAdminUsage() {

  const content =
    document.getElementById("admin-usage-content");

  const schoolLabel =
    document.getElementById("admin-usage-school");

  if (!content || !schoolLabel) return;

  try {

    const data = await requireAdminData();
    if (!data) return;

    schoolLabel.textContent =
      `${data.admin.school} Admin`;

    const students =
      data.students.map(normalizeStudent);

    /*
     * Get login audit records for this school.
     */
    const snap =
      await suvadiDb
        .collection("familyLoginAudit")
        .where("school", "==", data.admin.school)
        .get();

    const audits =
      snap.docs.map(
        d => d.data() || {}
      );
/*
 * Get notification-enabled families.
 */
const notificationSnap =
  await suvadiDb
    .collection("notificationDevices")
    .where("school", "==", data.admin.school)
    .get();

const notificationFamilies =
  new Set();

notificationSnap.docs.forEach(doc => {

  const device = doc.data() || {};

  if (device.enabled === true) {

    const parentEmail =
      normalizeEmail(device.parentEmail || "");

    if (parentEmail) {
      notificationFamilies.add(parentEmail);
    }

  }

});

    /*
     * Determine which students/families have used MTS Suvadi.
     */
    const usedStudentIds =
      new Set();

    audits.forEach(a => {

      (a.studentIds || []).forEach(id => {

        usedStudentIds.add(
          String(id)
        );

      });

    });


    const usedStudents =
      students.filter(
        s =>
          usedStudentIds.has(
            String(s.studentId)
          )
      );


    const neverStudents =
      students.filter(
        s =>
          !usedStudentIds.has(
            String(s.studentId)
          )
      );


    const familyKeys =
      new Set(
        students
          .map(
            s => normalizeEmail(
              s.parentEmail
            )
          )
          .filter(Boolean)
      );


    const usedFamilyKeys =
      new Set(
        audits
          .map(
            a => normalizeEmail(
              a.parentEmail
            )
          )
          .filter(Boolean)
      );


    /*
     * Map audit record to each student in that family.
     */
    const auditByStudent =
      new Map();

    audits.forEach(a => {

      (a.studentIds || []).forEach(id => {

        auditByStudent.set(
          String(id),
          a
        );

      });

    });


    /*
     * Format login date.
     */
    const formatTimestamp = value => {

      if (!value) return "";

      const d =
        typeof value.toDate === "function"
          ? value.toDate()
          : new Date(value);

      if (
        Number.isNaN(
          d.getTime()
        )
      ) {
        return "";
      }

      return new Intl.DateTimeFormat(
        "en-US",
        {
          month: "short",
          day: "numeric",
          year: "numeric"
        }
      ).format(d);

    };


    /*
     * ==========================================================
     * GROUP STUDENTS BY GRADE
     * ==========================================================
     */

    const gradeMap =
      new Map();


    students.forEach(student => {

      const grade =
        student.grade ||
        "No Grade";

      if (
        !gradeMap.has(grade)
      ) {

        gradeMap.set(
          grade,
          []
        );

      }

      gradeMap
        .get(grade)
        .push(student);

    });


    /*
     * Sort grades using the same grade sorting
     * already used elsewhere in the Admin screen.
     */

    const grades =
      [...gradeMap.keys()]
        .sort(adminGradeSort);


    /*
     * Build grouped Student Usage HTML.
     */

    const groupedRows =
      grades.map(grade => {

        const gradeStudents =
          gradeMap.get(grade);


        /*
         * Within each grade:
         *
         * NEVER USED first,
         * then USED,
         * then alphabetical by student name.
         */

        gradeStudents.sort(
          (a, b) => {

            const aUsed =
              usedStudentIds.has(
                String(a.studentId)
              );

            const bUsed =
              usedStudentIds.has(
                String(b.studentId)
              );


            if (aUsed !== bUsed) {

              return aUsed
                ? 1
                : -1;

            }


            return (
              a.studentName || ""
            ).localeCompare(
              b.studentName || "",
              undefined,
              {
                sensitivity: "base"
              }
            );

          }
        );


        const studentRows =
          gradeStudents
            .map(student => {

              const audit =
                auditByStudent.get(
                  String(
                    student.studentId
                  )
                );


              const used =
                !!audit;
              const notificationsEnabled =
                notificationFamilies.has(
                  normalizeEmail(student.parentEmail || "")
                );

              const last =
                used
                  ? formatTimestamp(
                      audit.lastLogin
                    )
                  : "";


              return `
                <div class="admin-audit-row">

                  <div>

                    <div class="admin-audit-name">
                      ${adminEscape(student.studentName)}
                    </div>

                    <div class="admin-audit-meta">

                      ${adminEscape(student.grade)}

                      ·

                      ${adminEscape(
                        student.studentEmail || ""
                      )}

                      ${
                        last
                          ? ` · Last login: ${adminEscape(last)}`
                          : ""
                      }

                    </div>

                  </div>

                  <div
                    class="admin-audit-status ${
                      used
                        ? "used"
                        : "never"
                    }">

${
  used
    ? "USED"
    : "NEVER USED"
}

<span
  title="${
    notificationsEnabled
      ? "Notifications enabled"
      : "Notifications not enabled"
  }"
  style="
    margin-left:8px;
    font-size:18px;
  ">
  ${
    notificationsEnabled
      ? "🔔"
      : "🔕"
  }
</span>

                  </div>

                </div>
              `;

            })
            .join("");


        const usedCount =
          gradeStudents.filter(
            student =>
              usedStudentIds.has(
                String(
                  student.studentId
                )
              )
          ).length;


const groupId =
  "usage-grade-" +
  grade.replace(/[^a-zA-Z0-9]/g, "-");

return `

  <div class="admin-usage-grade">

    <button
      class="admin-usage-grade-header"
      type="button"
      onclick='toggleAdminGradeGroup(${JSON.stringify(groupId)})'>

      <span class="admin-usage-grade-left">

        <span
          id="${adminEscape(groupId)}-arrow"
          class="admin-grade-arrow">
          ▶
        </span>

        <span class="admin-usage-grade-name">
          ${adminEscape(grade)}
        </span>

      </span>

      <span class="admin-usage-grade-count">
        ${gradeStudents.length} Students
        ·
        ${usedCount} Used
      </span>

    </button>

    <div
      id="${adminEscape(groupId)}"
      class="admin-usage-grade-students"
      
      hidden>

      ${studentRows}

    </div>

  </div>

`;

      })
      .join("");


    /*
     * ==========================================================
     * DISPLAY PAGE
     * ==========================================================
     */

    content.innerHTML = `

      <div class="admin-dashboard-grid">

        <div class="admin-metric-card info">
          <div class="admin-metric-label">
            Students
          </div>
          <div class="admin-metric-value">
            ${students.length}
          </div>
        </div>


        <div class="admin-metric-card good">
          <div class="admin-metric-label">
            Used MTS சுவடி
          </div>
          <div class="admin-metric-value">
            ${usedStudents.length}
          </div>
        </div>


        <div class="admin-metric-card bad">
          <div class="admin-metric-label">
            Never Used
          </div>
          <div class="admin-metric-value">
            ${neverStudents.length}
          </div>
        </div>


        <div class="admin-metric-card">
          <div class="admin-metric-label">
            Families
          </div>
          <div class="admin-metric-value">
            ${familyKeys.size}
          </div>
        </div>


        <div class="admin-metric-card good">
          <div class="admin-metric-label">
            Families Used
          </div>
          <div class="admin-metric-value">
            ${usedFamilyKeys.size}
          </div>
        </div>


        <div class="admin-metric-card warn">
          <div class="admin-metric-label">
            Families Never Used
          </div>
          <div class="admin-metric-value">

            ${
              Math.max(
                0,
                familyKeys.size -
                usedFamilyKeys.size
              )
            }

          </div>
        </div>

      </div>


      <div class="admin-section-title">
        Student Usage
      </div>


      ${
        groupedRows ||
        '<div class="admin-empty">No students found.</div>'
      }

    `;

  }
  catch (e) {

    console.error(e);

    content.innerHTML =
      `<div class="admin-error">
         ${adminEscape(e.message)}
       </div>`;

  }

}
/* ============================================================
 * ADMIN - SATURDAY LIBRARY ACTIVITY
 * ============================================================ */

function adminDateOnly(value) {
  const d = parseLocalDate(value);
  if (!d) return "";

  return (
    `${d.getFullYear()}-` +
    `${String(d.getMonth() + 1).padStart(2, "0")}-` +
    `${String(d.getDate()).padStart(2, "0")}`
  );
}


function adminSaturday(offsetWeeks = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);

  const back =
    (d.getDay() - 6 + 7) % 7;

  d.setDate(
    d.getDate() -
    back +
    (offsetWeeks * 7)
  );

  return adminDateOnly(d);
}


function changeAdminActivityWeek(delta) {

  const p =
    new URLSearchParams(location.search);

  const current =
    p.get("date") ||
    adminSaturday(0);

  const d =
    parseLocalDate(current) ||
    new Date();

  d.setDate(
    d.getDate() +
    (delta * 7)
  );

  spaNavigate(
    "admin-activity",
    {
      date: adminDateOnly(d)
    },
    true
  );
}


/* ============================================================
 * ACTIVITY GROUPING
 *
 * Grade
 *   -> Student
 *       -> Books
 * ============================================================ */

function adminGroupedBookList(books, prefix) {

  if (!books || !books.length) {
    return "";
  }


  /*
   * GROUP BY GRADE
   */

  const gradeMap =
    new Map();


  books.forEach(book => {

    const grade =
      book.grade ||
      "No Grade";

    if (!gradeMap.has(grade)) {
      gradeMap.set(grade, []);
    }

    gradeMap
      .get(grade)
      .push(book);

  });


  const grades =
    [...gradeMap.keys()]
      .sort(adminGradeSort);


  /*
   * BUILD GRADES
   */

  return grades
    .map((grade, gradeIndex) => {

      const gradeBooks =
        gradeMap.get(grade);


      /*
       * GROUP BY STUDENT
       */

      const studentMap =
        new Map();


      gradeBooks.forEach(book => {

        const key =
          String(
            book.studentId ||
            book.studentName ||
            "unknown"
          );


        if (!studentMap.has(key)) {

          studentMap.set(
            key,
            {
              studentId:
                String(
                  book.studentId ||
                  ""
                ),

              studentName:
                book.studentName ||
                "Unknown Student",

              books: []
            }
          );

        }


        studentMap
          .get(key)
          .books
          .push(book);

      });


      /*
       * SORT STUDENTS
       */

      const students =
        [...studentMap.values()]
          .sort(
            (a, b) =>
              a.studentName.localeCompare(
                b.studentName,
                undefined,
                {
                  sensitivity: "base"
                }
              )
          );


      const gradeId =
        `${prefix}-grade-${gradeIndex}-` +
        grade.replace(
          /[^a-zA-Z0-9]/g,
          "-"
        );


      /*
       * BUILD STUDENTS
       */

      const studentRows =
        students
          .map(
            (
              student,
              studentIndex
            ) => {

              const studentGroupId =
                `${gradeId}-student-${studentIndex}`;


              const studentBooks =
                [...student.books]
                  .sort(
                    (a, b) =>
                      (
                        a.bookTitle ||
                        ""
                      ).localeCompare(
                        b.bookTitle ||
                        "",
                        undefined,
                        {
                          sensitivity:
                            "base"
                        }
                      )
                  );


              /*
               * BOOK ROWS
               */

              const bookRows =
                studentBooks
                  .map(book => `

                    <div class="activity-list-row">

<div class="activity-book-title">

  ${adminEscape(
    book.bookTitle ||
    "Untitled Book"
  )}

  ${
    book.dateToReturn
      ? `<span style="
           color:#8B5A2B;
           font-size:13px;
           font-weight:600;
           margin-left:6px;
         ">
           Due: ${adminEscape(
             adminDateOnly(book.dateToReturn)
           )}
         </span>`
      : ""
  }

</div>

                    </div>

                  `)
                  .join("");


              /*
               * STUDENT HEADER
               */

              return `

                <div class="admin-activity-student-group">

                  <button
                    class="admin-usage-grade-header admin-activity-student-header activity-student-header"
                    type="button"
                    onclick='toggleAdminGradeGroup(${JSON.stringify(studentGroupId)})'>

                    <span class="admin-usage-grade-left">

                      <span
                        id="${adminEscape(studentGroupId)}-arrow"
                        class="admin-grade-arrow">
                        ▶
                      </span>

                      <span class="admin-usage-grade-name">

                       ${adminEscape(student.studentName)}

                      </span>

                    </span>


                    <span class="admin-usage-grade-count">

                      ${studentBooks.length}

                      ${
                        studentBooks.length === 1
                          ? "Book"
                          : "Books"
                      }

                    </span>

                  </button>


                  <div
                    id="${adminEscape(studentGroupId)}"
                    class="admin-usage-grade-students"
                    hidden>

                    ${bookRows}

                  </div>

                </div>

              `;

            }
          )
          .join("");


      /*
       * GRADE HEADER
       */
     
      return `

        <div class="admin-usage-grade">

          <button
            class="admin-usage-grade-header activity-grade-header"
            type="button"
            onclick='toggleAdminGradeGroup(${JSON.stringify(gradeId)})'>

            <span class="admin-usage-grade-left">

              <span
                id="${adminEscape(gradeId)}-arrow"
                class="admin-grade-arrow">
                ▶
              </span>

              <span class="admin-usage-grade-name">
                ${adminEscape(grade)}
              </span>

            </span>


            <span class="admin-usage-grade-count">

              ${gradeBooks.length}

              ${
                gradeBooks.length === 1
                  ? "Book"
                  : "Books"
              }

            </span>

          </button>


          <div
            id="${adminEscape(gradeId)}"
            class="admin-usage-grade-students"
            hidden>

            ${studentRows}

          </div>

        </div>

      `;

    })
    .join("");
}


/* ============================================================
 * LOAD ACTIVITY
 * ============================================================ */

async function loadAdminActivity() {

  const content =
    document.getElementById(
      "admin-activity-content"
    );

  const schoolLabel =
    document.getElementById(
      "admin-activity-school"
    );


  if (!content || !schoolLabel) {
    return;
  }


  try {

    const data =
      await requireAdminData();

    if (!data) return;


    schoolLabel.textContent =
      `${data.admin.school} Admin`;


    /*
     * SELECT DATE
     */

    const p =
      new URLSearchParams(
        location.search
      );

    let selected =
      p.get("date") ||
      adminSaturday(0);


    let selectedDate =
      parseLocalDate(selected);


    if (
      !selectedDate ||
      selectedDate.getDay() !== 6
    ) {

      selected =
        adminSaturday(0);

      selectedDate =
        parseLocalDate(selected);
    }


    /*
     * GET ACTIVITY
     */

    const books =
      data.lending.map(
        normalizeLending
      );


    const checkedOut =
      books.filter(
        book =>
          adminDateOnly(
            book.checkedOutDate
          ) === selected
      );


    const expected =
      books.filter(
        book =>
          adminDateOnly(
            book.dateToReturn
          ) === selected
      );


    const totalReturned =
      books.filter(
        book =>
          adminDateOnly(
            book.dateReturned
          ) === selected
      );


    const expectedReturned =
      expected.filter(book => {

        const returnedDate =
          adminDateOnly(
            book.dateReturned
          );

        return (
          returnedDate &&
          returnedDate <= selected
        );

      });


    const expectedNotReturned =
      expected.filter(book => {

        const returnedDate =
          adminDateOnly(
            book.dateReturned
          );

        return (
          !returnedDate ||
          returnedDate > selected
        );

      });


    /*
     * DATE LABEL
     */

    const d =
      parseLocalDate(selected);


    const label =
      new Intl.DateTimeFormat(
        "en-US",
        {
          weekday: "long",
          month: "short",
          day: "numeric",
          year: "numeric"
        }
      ).format(d);


    /*
     * FUTURE OR PAST
     */

    const today =
      new Date();

    today.setHours(
      0,
      0,
      0,
      0
    );


    const activityDate =
      parseLocalDate(selected);

    activityDate.setHours(
      0,
      0,
      0,
      0
    );


    const isFuture =
      activityDate > today;


    const expectedDisplayBooks =
      isFuture
        ? expected
        : expectedNotReturned;


    const expectedSectionTitle =
      isFuture
        ? "Expected Return Count"
        : "Expected but Not Returned";


    /*
     * BUILD GROUPED BOOK LISTS
     */

    const checkedOutRows =
      adminGroupedBookList(
        checkedOut,
        "activity-checkout"
      );


    const expectedRows =
      adminGroupedBookList(
        expectedDisplayBooks,
        "activity-expected"
      );


    /*
     * CHECKED OUT SECTION
     *
     * Only appears when count > 0
     */

const checkedOutSection =
  checkedOut.length > 0
    ? `

      <button
        class="admin-usage-grade-header activity-section-header"
        type="button"
        onclick='toggleAdminGradeGroup("activity-checkedout-section")'>

        <span class="admin-usage-grade-left">

          <span
            id="activity-checkedout-section-arrow"
            class="admin-grade-arrow">
            ▶
          </span>

          <span class="admin-usage-grade-name">
            Books Checked Out (${checkedOut.length})
          </span>

        </span>

      </button>


      <div
        id="activity-checkedout-section"
        hidden>

        ${checkedOutRows}

      </div>

    `
    : "";


    /*
     * EXPECTED EMPTY MESSAGE
     */

    const expectedEmptyMessage =
      isFuture
        ? "No books are expected to be returned."
        : "All expected books were returned.";


    /*
     * DISPLAY
     */

    content.innerHTML = `

      <div class="activity-datebar">

        <button
          class="activity-date-button"
          type="button"
          onclick="changeAdminActivityWeek(-1)">
          ‹
        </button>

        <div class="activity-date-label">
          ${adminEscape(label)}
        </div>

        <button
          class="activity-date-button"
          type="button"
          onclick="changeAdminActivityWeek(1)">
          ›
        </button>

      </div>


      <div class="admin-dashboard-grid">


        <div class="admin-metric-card info">

          <div class="admin-metric-label">
            Books Checked Out
          </div>

          <div class="admin-metric-value">
            ${checkedOut.length}
          </div>

        </div>


        <div class="admin-metric-card warn">

          <div class="admin-metric-label">
            Expected to Return
          </div>

          <div class="admin-metric-value">
            ${expected.length}
          </div>

        </div>


        <div class="admin-metric-card good">

          <div class="admin-metric-label">
            Expected & Returned
          </div>

          <div class="admin-metric-value">
            ${expectedReturned.length}
          </div>

        </div>


        <div class="admin-metric-card bad">

          <div class="admin-metric-label">
            Expected but Not Returned
          </div>

          <div class="admin-metric-value">
            ${expectedNotReturned.length}
          </div>

        </div>


        <div class="admin-metric-card good">

          <div class="admin-metric-label">
            Total Returned
          </div>

          <div class="admin-metric-value">
            ${totalReturned.length}
          </div>

        </div>


      </div>


${checkedOutSection}


<button
  class="admin-usage-grade-header activity-section-header"
  type="button"
  onclick='toggleAdminGradeGroup("activity-expected-section")'>

  <span class="admin-usage-grade-left">

    <span
      id="activity-expected-section-arrow"
      class="admin-grade-arrow">
      ▶
    </span>

    <span class="admin-usage-grade-name">

      ${expectedSectionTitle}
      (${expectedDisplayBooks.length})

    </span>

  </span>

</button>


<div
  id="activity-expected-section"
  hidden>

  ${
    expectedRows ||
    `<div class="admin-empty">
       ${expectedEmptyMessage}
     </div>`
  }

</div>

    `;

  }

  catch (error) {

    console.error(error);

    content.innerHTML = `
      <div class="admin-error">
        ${adminEscape(error.message)}
      </div>
    `;

  }
}
