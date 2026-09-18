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

            <span class="admin-status-dot suvadi-status-${status}"></span>

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
