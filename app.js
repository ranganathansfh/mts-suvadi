/*
 * ============================================================
 * SERVICE WORKER
 * ============================================================
 */

function registerServiceWorker() {

  if ("serviceWorker" in navigator) {

    window.addEventListener(
      "load",
      function () {

        navigator.serviceWorker
          .register("./service-worker.js")
          .catch(
            function (error) {

              console.error(
                "Service worker registration failed:",
                error
              );

            }
          );

      }
    );

  }

}


/*
 * ============================================================
 * GENERAL NAVIGATION
 * ============================================================
 */

function refreshPage() {

  window.location.reload();

}


function goBack() {

  if (window.history.length > 1) {

    window.history.back();

  }
  else {

    window.location.href =
      "./index.html";

  }

}


/*
 * ============================================================
 * SELECTED STUDENT
 * ============================================================
 */

function setSelectedStudent(studentId) {

  localStorage.setItem(
    "suvadiSelectedStudentId",
    String(studentId)
  );

}


function getSelectedStudent() {

  return localStorage.getItem(
    "suvadiSelectedStudentId"
  );

}


/*
 * ============================================================
 * DISPLAY HELPERS
 * ============================================================
 */

function studentDisplayName(student) {

  return (
    student.studentName +
    " (" +
    student.studentId +
    ")"
  );

}


function formatDate(dateText) {

  if (!dateText) {

    return "";

  }


  const date =
    parseLocalDate(
      dateText
    );


  if (!date) {

    return dateText;

  }


  return new Intl.DateTimeFormat(
    "en-US",
    {
      month:
        "numeric",

      day:
        "numeric",

      year:
        "numeric"
    }
  ).format(date);

}


function setMyBooksLinks() {

  document
    .querySelectorAll(
      "[data-my-books-link]"
    )
    .forEach(
      function (link) {

        link.href =
          "./books.html";

      }
    );

}


/*
 * ============================================================
 * SUMMARY
 * ============================================================
 */

function renderSummary(summary) {

  return `
    <div class="summary-line">
      <span class="summary-icon">📚</span>
      Total Books: ${summary.totalBooks}
    </div>

    <div class="summary-line">
      <span class="summary-icon returned-dot">●</span>
      Returned: ${summary.returned}
    </div>

    <div class="summary-line">
      <span class="summary-icon pending-dot">●</span>
      Pending: ${summary.pending}
    </div>

    <div class="summary-line">
      <span class="summary-icon overdue-dot">●</span>
      Overdue: ${summary.overdue}
    </div>
  `;

}


/*
 * ============================================================
 * HOME
 * ============================================================
 */

async function loadHome() {

  const welcome =
    document.getElementById(
      "welcome"
    );

  const studentList =
    document.getElementById(
      "student-list"
    );


  /*
   * This function can also be referenced while another
   * page is loading, so safely stop if Home elements
   * do not exist.
   */

  if (
    !welcome ||
    !studentList
  ) {

    return;

  }


  try {

    /*
     * loadSuvadiData() in data.js caches the complete
     * family bootstrap. Therefore these calls do NOT
     * create separate Apps Script requests.
     */

    const currentUser =
      await getCurrentUser();

    const students =
      await getStudentsForCurrentUser();


    welcome.innerHTML =
      "Welcome, " +
      currentUser.displayName.replace(
        " & ",
        " &<br>"
      );


    setMyBooksLinks();


    const rows = [];


    for (
      const student of students
    ) {

      const summary =
        await getStudentSummary(
          student.studentId
        );


      rows.push(`
        <button
          class="student-card"
          type="button"
          onclick="openStudentDetails('${student.studentId}')">

          <div class="student-row">

            <span
              class="status-dot ${student.status}">
            </span>

            <span>
              ${studentDisplayName(student)}
            </span>

          </div>

          <div class="stats">

            <span>
              📚 ${summary.totalBooks}
            </span>

            <span class="returned-dot">
              ●
            </span>
            ${summary.returned}

            <span class="pending-dot">
              ●
            </span>
            ${summary.pending}

            <span class="overdue-dot">
              ●
            </span>
            ${summary.overdue}

          </div>

        </button>
      `);

    }


    studentList.innerHTML =
      rows.join("");

  }
  catch (error) {

    console.error(
      "Home load failed:",
      error
    );


    studentList.innerHTML =
      `<div class="error-box">
        ${error.message || "Unable to load student information."}
       </div>`;

  }

}


function openStudentDetails(studentId) {

  setSelectedStudent(
    studentId
  );


  window.location.href =
    "./details.html?student=" +
    encodeURIComponent(
      studentId
    );

}


/*
 * ============================================================
 * STUDENT DETAILS
 * ============================================================
 */

async function loadDetails() {

  const params =
    new URLSearchParams(
      window.location.search
    );


  const studentId =
    params.get("student") ||
    getSelectedStudent();


  const content =
    document.getElementById(
      "details-content"
    );


  if (!content) {

    return;

  }


  if (!studentId) {

    content.innerHTML =
      `<div class="error-box">
        Student ID was not supplied.
       </div>`;

    return;

  }


  try {

    const student =
      await getStudentById(
        studentId
      );


    if (!student) {

      content.innerHTML =
        `<div class="error-box">
          Student ${studentId} was not found.
         </div>`;

      return;

    }


    setSelectedStudent(
      studentId
    );


    setMyBooksLinks();


    const summary =
      await getStudentSummary(
        studentId
      );


    const teacherText =
      student.teachers.length
        ? student.teachers.join("<br>")
        : "";


    const parentText =
      student.parents.length
        ? student.parents.join(
            "<br>&amp; "
          )
        : "";


    content.innerHTML = `

      <div class="field">

        <div class="field-label">
          Student
        </div>

        <div
          class="field-value value-with-dot">

          <span
            class="status-dot ${student.status}">
          </span>

          <span>
            ${studentDisplayName(student)}
          </span>

        </div>

      </div>


      <div class="field">

        <div class="field-label">
          Grade
        </div>

        <div
          class="field-value value-with-dot">

          <span
            class="status-dot green">
          </span>

          <span>
            ${student.grade}
          </span>

        </div>

      </div>


      <div class="field">

        <div class="field-label">
          Parents Email ID
        </div>

        <div class="field-value">
          ${student.parentEmail}
        </div>

      </div>


      <div class="field">

        <div class="field-label">
          Teacher(s)
        </div>

        <div class="field-value">
          ${teacherText}
        </div>

      </div>


      <div class="field">

        <div class="field-label">
          Parent(s)
        </div>

        <div class="field-value">
          ${parentText}
        </div>

      </div>


      <div class="field">

        <div class="field-label">
          Summary
        </div>

        ${renderSummary(summary)}

      </div>
    `;

  }
  catch (error) {

    console.error(
      "Student Details load failed:",
      error
    );


    content.innerHTML =
      `<div class="error-box">
        ${error.message || "Unable to load student details."}
       </div>`;

  }

}


/*
 * ============================================================
 * MY BOOKS ROOT
 * ============================================================
 */

async function loadMyBooksStudents() {

  const list =
    document.getElementById(
      "mybooks-students"
    );


  if (!list) {

    return;

  }


  try {

    const students =
      await getStudentsForCurrentUser();


    const rows = [];


    for (
      const student of students
    ) {

      const lending =
        await getLendingForStudent(
          student.studentId
        );


      const currentBooks =
        lending.filter(
          function (book) {

            return !book.returned;

          }
        );


      if (
        currentBooks.length === 0
      ) {

        continue;

      }


      rows.push(`

        <button
          class="mybooks-student-row"
          type="button"
          onclick="openStudentBooks('${student.studentId}')">

          <span class="mybooks-student-name">
            ${studentDisplayName(student)}
          </span>

          <span class="count-badge">
            ${currentBooks.length}
          </span>

          <span class="chevron">
            ›
          </span>

        </button>
      `);

    }


    list.innerHTML =
      rows.length
        ? rows.join("")
        : `<div class="mybooks-empty">
             No books are currently checked out.
           </div>`;

  }
  catch (error) {

    console.error(
      "My Books load failed:",
      error
    );


    list.innerHTML =
      `<div class="error-box">
        ${error.message || "Unable to load books."}
       </div>`;

  }

}


function openStudentBooks(studentId) {

  setSelectedStudent(
    studentId
  );


  window.location.href =
    "./student-books.html?student=" +
    encodeURIComponent(
      studentId
    );

}


/*
 * ============================================================
 * GROUP HELPER
 * ============================================================
 */

function groupBy(
  items,
  keyFn
) {

  return items.reduce(
    function (
      groups,
      item
    ) {

      const key =
        keyFn(item);


      if (!groups[key]) {

        groups[key] = [];

      }


      groups[key].push(
        item
      );


      return groups;

    },
    {}
  );

}


/*
 * ============================================================
 * DUE DATE HELPERS
 * ============================================================
 */

function daysUntil(dateText) {

  const due =
    parseLocalDate(
      dateText
    );


  if (!due) {

    return null;

  }


  const today =
    new Date();


  today.setHours(
    0,
    0,
    0,
    0
  );


  due.setHours(
    0,
    0,
    0,
    0
  );


  return Math.round(
    (
      due.getTime() -
      today.getTime()
    ) /
    86400000
  );

}


function dueRelativeText(dateText) {

  const days =
    daysUntil(
      dateText
    );


  if (
    days === null
  ) {

    return "";

  }


  if (
    days === 0
  ) {

    return "Due today";

  }


  if (
    days === 1
  ) {

    return "Due in 1 day";

  }


  if (
    days > 1
  ) {

    return (
      "Due in " +
      days +
      " days"
    );

  }


  const overdueDays =
    Math.abs(
      days
    );


  if (
    overdueDays === 1
  ) {

    return "Overdue by 1 day";

  }


  return (
    "Overdue by " +
    overdueDays +
    " days"
  );

}


/*
 * ============================================================
 * COLLAPSIBLE BOOK SECTIONS
 * ============================================================
 */

function toggleBookSection(
  sectionId,
  headerButton
) {

  const content =
    document.getElementById(
      sectionId
    );


  if (!content) {

    return;

  }


  const isExpanded =
    headerButton.getAttribute(
      "aria-expanded"
    ) === "true";


  headerButton.setAttribute(
    "aria-expanded",
    String(
      !isExpanded
    )
  );


  content.hidden =
    isExpanded;

}


/*
 * ============================================================
 * STUDENT BOOKS
 * ============================================================
 */

async function loadStudentBooks() {

  const params =
    new URLSearchParams(
      window.location.search
    );


  const studentId =
    params.get("student") ||
    getSelectedStudent();


  const groupsContainer =
    document.getElementById(
      "student-book-groups"
    );


  if (!groupsContainer) {

    return;

  }


  if (!studentId) {

    groupsContainer.innerHTML =
      `<div class="mybooks-empty">
        No student selected.
       </div>`;

    return;

  }


  setSelectedStudent(
    studentId
  );


  try {

    const rows =
      await getLendingForStudent(
        studentId
      );


    /*
     * ----------------------------------------------------------
     * OVERDUE
     * ----------------------------------------------------------
     */

    const overdueBooks =
      rows
        .filter(
          function (book) {

            return (
              !book.returned &&
              calculateBookStatus(
                book
              ) === "overdue"
            );

          }
        )
        .sort(
          function (a, b) {

            const dateA =
              parseLocalDate(
                a.dateToReturn
              );

            const dateB =
              parseLocalDate(
                b.dateToReturn
              );


            return (
              (dateA?.getTime() || 0) -
              (dateB?.getTime() || 0)
            );

          }
        );


    /*
     * ----------------------------------------------------------
     * UPCOMING
     * ----------------------------------------------------------
     */

    const upcomingBooks =
      rows
        .filter(
          function (book) {

            return (
              !book.returned &&
              calculateBookStatus(
                book
              ) !== "overdue"
            );

          }
        )
        .sort(
          function (a, b) {

            const dateA =
              parseLocalDate(
                a.dateToReturn
              );

            const dateB =
              parseLocalDate(
                b.dateToReturn
              );


            return (
              (dateA?.getTime() || 0) -
              (dateB?.getTime() || 0)
            );

          }
        );


    /*
     * ----------------------------------------------------------
     * RETURNED
     * ----------------------------------------------------------
     */

    const returnedBooks =
      rows
        .filter(
          function (book) {

            return book.returned;

          }
        )
        .sort(
          function (a, b) {

            const dateA =
              parseLocalDate(
                a.dateReturned ||
                a.checkedOutDate
              );

            const dateB =
              parseLocalDate(
                b.dateReturned ||
                b.checkedOutDate
              );


            return (
              (dateB?.getTime() || 0) -
              (dateA?.getTime() || 0)
            );

          }
        );


    /*
     * ----------------------------------------------------------
     * SECTION RENDERER
     * ----------------------------------------------------------
     */

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

              <span>
                ${title}
              </span>

              <span class="status-section-count">
                ${books.length}
              </span>

              <span class="group-chevron">
                ⌃
              </span>

            </span>

          </button>


          <div
            id="${sectionId}"
            class="book-status-content">

            ${
              books.length

                ? books
                    .map(
                      function (book) {

                        return `

                          <button
                            class="book-item ${returnedMode ? "returned-book" : ""}"
                            type="button"
                            onclick="openBookDetails('${book.lendingId}')">

                            <div class="book-main">

                              <div class="book-title">
                                ${book.bookTitle}
                              </div>

                              <div class="book-due">

                                ${
                                  returnedMode

                                    ? (
                                        "Returned On: " +
                                        formatDate(
                                          book.dateReturned ||
                                          ""
                                        )
                                      )

                                    : (
                                        "Due On: " +
                                        formatDate(
                                          book.dateToReturn
                                        ) +
                                        ' - <span class="due-relative">' +
                                        dueRelativeText(
                                          book.dateToReturn
                                        ) +
                                        "</span>"
                                      )
                                }

                              </div>

                            </div>


                            <div
                              class="book-read-status ${
                                book.bookRead
                                  ? "read"
                                  : "not-read"
                              }">

                              ${
                                book.bookRead
                                  ? "Read"
                                  : "Not Read"
                              }

                            </div>

                          </button>
                        `;

                      }
                    )
                    .join("")

                : (
                    `<div class="mybooks-empty">
                      ${emptyText}
                     </div>`
                  )
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
  catch (error) {

    console.error(
      "Student Books load failed:",
      error
    );


    /*
     * IMPORTANT:
     *
     * Previously the page could remain displaying
     * "Loading..." forever when the API request failed.
     *
     * Now the actual error is shown on the page.
     */

    groupsContainer.innerHTML =
      `<div class="error-box">
        ${error.message || "Unable to load student books."}
       </div>`;

  }

}


/*
 * ============================================================
 * OPEN BOOK DETAILS
 * ============================================================
 */

function openBookDetails(lendingId) {

  window.location.href =
    "./book-details.html?lending=" +
    encodeURIComponent(
      lendingId
    );

}


/*
 * ============================================================
 * BOOK DETAILS
 * ============================================================
 */

async function loadBookDetails() {

  const params =
    new URLSearchParams(
      window.location.search
    );


  const lendingId =
    params.get(
      "lending"
    );


  const content =
    document.getElementById(
      "details-content"
    );


  if (!content) {

    return;

  }


  if (!lendingId) {

    content.innerHTML =
      `<div class="error-box">
        Lending ID was not supplied.
       </div>`;

    return;

  }


  try {

    /*
     * getLendingById() uses the family bootstrap
     * in data.js.
     */

    const book =
      await getLendingById(
        lendingId
      );


    if (!book) {

      content.innerHTML =
        `<div class="error-box">
          Book transaction ${lendingId} was not found.
         </div>`;

      return;

    }


    const student =
      await getStudentById(
        book.studentId
      );


    setSelectedStudent(
      book.studentId
    );


    const status =
      calculateBookStatus(
        book
      );


    const statusText =

      status === "overdue"
        ? "Overdue"

        : status === "returned"
          ? "Returned"

          : "Pending";


    const statusClass =

      status === "overdue"
        ? "overdue-dot"

        : status === "returned"
          ? "returned-dot"

          : "pending-dot";


    content.innerHTML = `

      <div class="field">

        <div class="field-label">
          Student
        </div>

        <div
          class="field-value"
          style="color:#00a51a;font-weight:700;">

          ${
            student
              ? studentDisplayName(
                  student
                )
              : book.studentId
          }

        </div>

      </div>


      <div class="field">

        <div class="field-label">
          Grade
        </div>

        <div class="field-value">

          ${
            student
              ? student.grade
              : ""
          }

        </div>

      </div>


      <div class="field">

        <div class="field-label">
          Book
        </div>

        <div
          class="field-value"
          style="color:#e67800;font-weight:700;">

          ${book.bookTitle}

        </div>

      </div>


      <div class="field">

        <div class="field-label">
          Checked Out
        </div>

        <div class="field-value">
          ${formatDate(book.checkedOutDate)}
        </div>

      </div>


      <div class="field">

        <div class="field-label">
          Date to Return
        </div>

        <div class="field-value">
          ${formatDate(book.dateToReturn)}
        </div>

      </div>


      <div class="field">

        <div class="field-label">
          Date Returned
        </div>

        <div class="field-value">

          ${
            book.returned
              ? formatDate(
                  book.dateReturned
                )
              : "Not Returned"
          }

        </div>

      </div>


      <div class="field">

        <div class="field-label">
          Status
        </div>

        <div
          class="field-value ${statusClass}"
          style="font-weight:700;">

          ${statusText}

        </div>

      </div>


      <div class="field">

        <div class="field-label">
          Book Read
        </div>

        <div
          id="book-read-value"
          class="field-value ${
            book.bookRead
              ? "returned-dot"
              : "pending-dot"
          }"
          style="font-weight:700;">

          ${
            book.bookRead
              ? "Read"
              : "Not Read"
          }

        </div>

      </div>
    `;


    /*
     * ----------------------------------------------------------
     * MARK BOOK READ
     *
     * Show only when:
     *
     * Returned = FALSE
     * AND
     * Book Read = FALSE / blank
     * ----------------------------------------------------------
     */

    if (
      !book.returned &&
      !book.bookRead
    ) {

      const actionArea =
        document.createElement(
          "div"
        );


      actionArea.id =
        "mark-book-read-area";


      actionArea.style.marginTop =
        "24px";

      actionArea.style.marginBottom =
        "90px";

      actionArea.style.textAlign =
        "center";


      const readButton =
        document.createElement(
          "button"
        );


      readButton.type =
        "button";


      readButton.textContent =
        "MARK BOOK READ";


      readButton.style.padding =
        "14px 24px";

      readButton.style.fontSize =
        "16px";

      readButton.style.fontWeight =
        "700";

      readButton.style.cursor =
        "pointer";


      readButton.onclick =
        function () {

          confirmMarkBookRead(
            book.lendingId
          );

        };


      actionArea.appendChild(
        readButton
      );


      content.appendChild(
        actionArea
      );

    }

  }
  catch (error) {

    console.error(
      "Book Details load failed:",
      error
    );


    /*
     * This is important for the issue we were
     * troubleshooting.
     *
     * Instead of remaining on:
     *
     * Loading...
     *
     * the page now displays the actual API error.
     */

    content.innerHTML =
      `<div class="error-box">
        ${error.message || "Unable to load book details."}
       </div>`;

  }

}


/*
 * ============================================================
 * CONFIRM MARK BOOK READ
 * ============================================================
 */

async function confirmMarkBookRead(
  lendingId
) {

  const confirmed =
    window.confirm(
      "Confirm\n\n" +
      "I Attest that the Kid read the book!!!"
    );


  if (!confirmed) {

    return;

  }


  try {

    const result =
      await markBookRead(
        lendingId
      );


    if (!result.success) {

      throw new Error(
        result.message ||
        "Unable to mark the book as read."
      );

    }


    /*
     * ----------------------------------------------------------
     * UPDATE SCREEN LOCALLY
     * ----------------------------------------------------------
     *
     * Do NOT call loadBookDetails() again.
     *
     * That would create another familyBootstrap
     * request immediately after the write.
     *
     * This is both faster and reduces Apps Script load.
     */


    const readValue =
      document.getElementById(
        "book-read-value"
      );


    if (readValue) {

      readValue.textContent =
        "Read";


      readValue.classList.remove(
        "pending-dot"
      );


      readValue.classList.add(
        "returned-dot"
      );

    }


    /*
     * Remove MARK BOOK READ button.
     */

    const actionArea =
      document.getElementById(
        "mark-book-read-area"
      );


    if (actionArea) {

      actionArea.remove();

    }

  }
  catch (error) {

    console.error(
      "Mark Book Read failed:",
      error
    );


    alert(
      error.message ||
      "Unable to mark the book as read."
    );

  }

}


/*
 * ============================================================
 * START SERVICE WORKER
 * ============================================================
 */

registerServiceWorker();