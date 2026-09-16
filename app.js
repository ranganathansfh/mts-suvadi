function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js")
        .catch(error => console.error("Service worker registration failed:", error));
    });
  }
}

function refreshPage() {
  window.location.reload();
}

function goBack() {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    window.location.href = "./index.html";
  }
}

function setSelectedStudent(studentId) {
  localStorage.setItem("suvadiSelectedStudentId", String(studentId));
}

function getSelectedStudent() {
  return localStorage.getItem("suvadiSelectedStudentId");
}

function studentDisplayName(student) {
  const studentId = String(student.studentId || "").trim();
  let studentName = String(student.studentName || "").trim();

  // Remove Student ID from the end of the name if it is already there.
  const idAtEnd = new RegExp(
    `\\s*\\(${studentId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\)\\s*$`
  );

  studentName = studentName.replace(idAtEnd, "").trim();

  return `${studentName} (${studentId})`;
}

function formatDate(dateText) {
  if (!dateText) return "";
  const date = parseLocalDate(dateText);
  if (!date) return dateText;

  return new Intl.DateTimeFormat("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function setMyBooksLinks() {
  document.querySelectorAll("[data-my-books-link]").forEach(link => {
    link.href = "./books.html";
  });
}

function renderSummary(summary) {
  return `
    <div class="summary-line"><span class="summary-icon">📚</span>Total Books: ${summary.totalBooks}</div>
    <div class="summary-line"><span class="summary-icon returned-dot">●</span>Returned: ${summary.returned}</div>
    <div class="summary-line"><span class="summary-icon pending-dot">●</span>Pending: ${summary.pending}</div>
    <div class="summary-line"><span class="summary-icon overdue-dot">●</span>Overdue: ${summary.overdue}</div>
  `;
}

async function loadHome() {
  const welcome = document.getElementById("welcome");
  const studentList = document.getElementById("student-list");
  const currentUser = await getCurrentUser();
  const students = await getStudentsForCurrentUser();

  welcome.innerHTML = `Welcome, ${currentUser.displayName.replace(" & ", " &<br>")}`;
  setMyBooksLinks();

  const rows = [];
  for (const student of students) {
    const summary = await getStudentSummary(student.studentId);
    rows.push(`
      <button class="student-card"
              type="button"
              onclick="openStudentDetails('${student.studentId}')">
        <div class="student-row">
          <span class="status-dot ${student.status}"></span>
          <span>${studentDisplayName(student)}</span>
        </div>
        <div class="stats">
          <span>📚 ${summary.totalBooks}</span>
          <span class="returned-dot">●</span> ${summary.returned}
          <span class="pending-dot">●</span> ${summary.pending}
          <span class="overdue-dot">●</span> ${summary.overdue}
        </div>
      </button>
    `);
  }
  studentList.innerHTML = rows.join("");
}

function openStudentDetails(studentId) {
  setSelectedStudent(studentId);
  window.location.href = `./details.html?student=${encodeURIComponent(studentId)}`;
}

async function loadDetails() {
  const params = new URLSearchParams(window.location.search);
  const studentId = params.get("student") || getSelectedStudent();
  const content = document.getElementById("details-content");

  if (!studentId) {
    content.innerHTML = `<div class="error-box">Student ID was not supplied.</div>`;
    return;
  }

  const student = await getStudentById(studentId);
  if (!student) {
    content.innerHTML = `<div class="error-box">Student ${studentId} was not found.</div>`;
    return;
  }

  setSelectedStudent(studentId);
  setMyBooksLinks();

  const summary = await getStudentSummary(studentId);
  const teacherText = student.teachers.join("<br>");
  const parentText = student.parents.join("<br>&amp; ");

  content.innerHTML = `
    <div class="field">
      <div class="field-label">Student</div>
      <div class="field-value value-with-dot">
        <span class="status-dot ${student.status}"></span>
        <span>${studentDisplayName(student)}</span>
      </div>
    </div>

    <div class="field">
      <div class="field-label">Grade</div>
      <div class="field-value value-with-dot">
        <span class="status-dot green"></span>
        <span>${student.grade}</span>
      </div>
    </div>

    <div class="field">
      <div class="field-label">Parents Email ID</div>
      <div class="field-value">${student.parentEmail}</div>
    </div>

    <div class="field">
      <div class="field-label">Teacher(s)</div>
      <div class="field-value">${teacherText}</div>
    </div>

    <div class="field">
      <div class="field-label">Parent(s)</div>
      <div class="field-value">${parentText}</div>
    </div>

    <div class="field">
      <div class="field-label">Summary</div>
      ${renderSummary(summary)}
    </div>
  `;
}

/* MY BOOKS root: list students exactly like the attachment */
async function loadMyBooksStudents() {
  const list = document.getElementById("mybooks-students");
  const students = await getStudentsForCurrentUser();
  const rows = [];

  for (const student of students) {
    const lending = await getLendingForStudent(student.studentId);

    // My Books contains current AND returned-book sections, so every family
    // student should be listed here.  The badge shows that student's total
    // lending records rather than only currently checked-out books.
    rows.push(`
      <button class="mybooks-student-row"
              type="button"
              onclick="openStudentBooks('${student.studentId}')">
        <span class="mybooks-student-name">${studentDisplayName(student)}</span>
        <span class="count-badge">${lending.length}</span>
        <span class="chevron">›</span>
      </button>
    `);
  }

  list.innerHTML = rows.length
    ? rows.join("")
    : `<div class="mybooks-empty">No books are currently checked out.</div>`;
}

function openStudentBooks(studentId) {
  setSelectedStudent(studentId);
  window.location.href = `./student-books.html?student=${encodeURIComponent(studentId)}`;
}

/* Student's My Books: group current books by Checked Out Date */
function groupBy(items, keyFn) {
  return items.reduce((groups, item) => {
    const key = keyFn(item);
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
    return groups;
  }, {});
}


function daysUntil(dateText) {
  const due = parseLocalDate(dateText);
  if (!due) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  return Math.round((due - today) / 86400000);
}

function dueRelativeText(dateText) {
  const days = daysUntil(dateText);
  if (days === null) return "";

  if (days === 0) return "Due today";
  if (days === 1) return "Due in 1 day";
  if (days > 1) return `Due in ${days} days`;

  const overdueDays = Math.abs(days);
  if (overdueDays === 1) return "Overdue by 1 day";
  return `Overdue by ${overdueDays} days`;
}

function toggleBookSection(sectionId, headerButton) {
  const content = document.getElementById(sectionId);
  if (!content) return;

  const isExpanded = headerButton.getAttribute("aria-expanded") === "true";

  headerButton.setAttribute("aria-expanded", String(!isExpanded));
  content.hidden = isExpanded;
}

async function loadStudentBooks() {
  const params = new URLSearchParams(window.location.search);
  const studentId = params.get("student") || getSelectedStudent();
  const groupsContainer = document.getElementById("student-book-groups");

  if (!studentId) {
    groupsContainer.innerHTML = `<div class="mybooks-empty">No student selected.</div>`;
    return;
  }

  setSelectedStudent(studentId);

  const rows = await getLendingForStudent(studentId);

  const overdueBooks = rows
    .filter(book => !book.returned && calculateBookStatus(book) === "overdue")
    .sort((a, b) => parseLocalDate(a.dateToReturn) - parseLocalDate(b.dateToReturn));

  const upcomingBooks = rows
    .filter(book => !book.returned && calculateBookStatus(book) !== "overdue")
    .sort((a, b) => parseLocalDate(a.dateToReturn) - parseLocalDate(b.dateToReturn));

  const returnedBooks = rows
    .filter(book => book.returned)
    .sort((a, b) => {
      const ad = parseLocalDate(a.dateReturned || a.checkedOutDate);
      const bd = parseLocalDate(b.dateReturned || b.checkedOutDate);
      return bd - ad;
    });

  function renderStatusSection(
    sectionId,
    title,
    headerClass,
    books,
    emptyText,
    returnedMode = false
  ) {
    return `
      <section class="book-status-section">
        <button
          class="book-status-header ${headerClass}"
          type="button"
          aria-expanded="true"
          aria-controls="${sectionId}"
          onclick="toggleBookSection('${sectionId}', this)">
          <span class="book-status-header-grid">
            <span>${title}</span>
            <span class="status-section-count">${books.length}</span>
            <span class="group-chevron" aria-hidden="true"></span>
          </span>
        </button>

        <div id="${sectionId}" class="book-status-content">
          ${
            books.length
              ? books.map(book => `
                  <button class="book-item ${returnedMode ? "returned-book" : ""}"
                          type="button"
                          onclick="openBookDetails('${book.lendingId}')">
                    <div class="book-main">
                      <div class="book-title">${book.bookTitle}</div>
                      <div class="book-due">
                        ${
                          returnedMode
                            ? `Returned On: ${formatDate(book.dateReturned || "")}`
                            : `Due On: ${formatDate(book.dateToReturn)} - <span class="due-relative">${dueRelativeText(book.dateToReturn)}</span>`
                        }
                      </div>
                    </div>

                    <div class="book-read-status ${book.bookRead ? "read" : "not-read"}">
                      ${book.bookRead ? "Read" : "Not Read"}
                    </div>
                  </button>
                `).join("")
              : `<div class="mybooks-empty">${emptyText}</div>`
          }
        </div>
      </section>
    `;
  }

  groupsContainer.innerHTML =
    renderStatusSection(
      "overdue-books-content",
      "Overdue Books",
      "overdue-header",
      overdueBooks,
      "No overdue books."
    ) +
    renderStatusSection(
      "upcoming-books-content",
      "Upcoming Due Books",
      "upcoming-header",
      upcomingBooks,
      "No upcoming due books."
    ) +
    renderStatusSection(
      "returned-books-content",
      "Returned Books",
      "returned-header",
      returnedBooks,
      "No returned books.",
      true
    );
}

function openBookDetails(lendingId) {
  window.location.href = `./book-details.html?lending=${encodeURIComponent(lendingId)}`;
}

async function loadBookDetails() {
  const params = new URLSearchParams(window.location.search);
  const lendingId = params.get("lending");
  const content = document.getElementById("details-content");

  if (!lendingId) {
    content.innerHTML = `<div class="error-box">Lending ID was not supplied.</div>`;
    return;
  }

  const book = await getLendingById(lendingId);
  if (!book) {
    content.innerHTML = `<div class="error-box">Book transaction ${lendingId} was not found.</div>`;
    return;
  }

  const student = await getStudentById(book.studentId);
  setSelectedStudent(book.studentId);

  const status = calculateBookStatus(book);
  const statusText =
    status === "overdue" ? "Overdue" :
    status === "returned" ? "Returned" : "Pending";

  const statusClass =
    status === "overdue" ? "overdue-dot" :
    status === "returned" ? "returned-dot" :
    "pending-dot";

  content.innerHTML = `
    <div class="field">
      <div class="field-label">Student</div>
      <div class="field-value" style="color:#00a51a;font-weight:700;">
        ${student ? studentDisplayName(student) : book.studentId}
      </div>
    </div>

    <div class="field">
      <div class="field-label">Grade</div>
      <div class="field-value">${student ? student.grade : ""}</div>
    </div>

    <div class="field">
      <div class="field-label">Book</div>
      <div class="field-value" style="color:#e67800;font-weight:700;">
        ${book.bookTitle}
      </div>
    </div>

    <div class="field">
      <div class="field-label">Checked Out</div>
      <div class="field-value">${formatDate(book.checkedOutDate)}</div>
    </div>

    <div class="field">
      <div class="field-label">Date to Return</div>
      <div class="field-value">${formatDate(book.dateToReturn)}</div>
    </div>

    <div class="field">
      <div class="field-label">Date Returned</div>
      <div class="field-value">${book.returned ? formatDate(book.dateReturned) : "Not Returned"}</div>
    </div>

    <div class="field">
      <div class="field-label">Status</div>
      <div class="field-value ${statusClass}" style="font-weight:700;">
        ${statusText}
      </div>
    </div>

    <div class="field">
      <div class="field-label">Book Read</div>
      <div class="field-value ${book.bookRead ? "returned-dot" : "pending-dot"}"
           style="font-weight:700;">
        ${book.bookRead ? "Read" : "Not Read"}
      </div>
    </div>
  `;

  // Show MARK BOOK READ only for an unreturned, unread book.
  if (!book.returned && !book.bookRead) {
    const actionArea = document.createElement("div");
    actionArea.style.marginTop = "24px";
    actionArea.style.marginBottom = "90px";
    actionArea.style.textAlign = "center";

    const readButton = document.createElement("button");
    readButton.type = "button";
    readButton.textContent = "MARK BOOK READ";
    readButton.style.padding = "14px 24px";
    readButton.style.fontSize = "16px";
    readButton.style.fontWeight = "700";
    readButton.style.cursor = "pointer";
    readButton.onclick = function () {
      confirmMarkBookRead(book.lendingId);
    };

    actionArea.appendChild(readButton);
    content.appendChild(actionArea);
  }
}

async function confirmMarkBookRead(lendingId) {
  const confirmed = window.confirm(
    "Confirm\n\nI Attest that the Kid read the book!!!"
  );

  if (!confirmed) return;

  try {
    await markBookRead(lendingId);
    await loadBookDetails();
  } catch (error) {
    console.error("Mark Book Read failed:", error);
    alert(error.message || "Unable to mark the book as read.");
  }
}

registerServiceWorker();