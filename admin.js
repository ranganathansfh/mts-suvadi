/*
 * ============================================================
 * MTS SUVADI - ADMIN
 * ============================================================
 */


/*
 * ============================================================
 * HTML SAFETY
 * ============================================================
 */

function adminEscape(value) {

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


/*
 * ============================================================
 * CLASS / STUDENT BOOK COUNTS
 * ============================================================
 *
 * Returns:
 *
 * overdue
 * pending
 * returned
 *
 * ============================================================
 */

function adminBookCounts(lending) {

  let overdue = 0;
  let pending = 0;
  let returned = 0;


  lending.forEach(rawBook => {

    const book =
      normalizeLending(rawBook);


    const status =
      calculateBookStatus(book);


    if (status === "overdue") {

      overdue++;

    }
    else if (status === "pending") {

      pending++;

    }
    else if (status === "returned") {

      returned++;

    }

  });


  return {
    overdue,
    pending,
    returned
  };
}


/*
 * ============================================================
 * BOOK COUNT HTML
 * ============================================================
 *
 * Display order:
 *
 * RED    = Overdue
 * ORANGE = Pending
 * GREEN  = Returned
 *
 * ============================================================
 */

function adminBookCountHtml(counts) {

  return `

    <span class="admin-student-counts">


      <!-- OVERDUE -->

      <span
        class="admin-book-count"
        title="Overdue"
      >

        <span
          class="admin-mini-dot overdue"
        ></span>

        <strong>
          ${counts.overdue}
        </strong>

      </span>



      <!-- PENDING -->

      <span
        class="admin-book-count"
        title="Pending"
      >

        <span
          class="admin-mini-dot pending"
        ></span>

        <strong>
          ${counts.pending}
        </strong>

      </span>



      <!-- RETURNED -->

      <span
        class="admin-book-count"
        title="Returned"
      >

        <span
          class="admin-mini-dot returned"
        ></span>

        <strong>
          ${counts.returned}
        </strong>

      </span>


    </span>

  `;
}


/*
 * ============================================================
 * STUDENT STATUS
 * ============================================================
 *
 * RED:
 * At least one overdue book
 *
 * ORANGE:
 * No overdue books,
 * but at least one pending book
 *
 * GREEN:
 * No overdue and no pending books
 * ============================================================
 */

function adminStudentStatus(
  studentId,
  lending
) {

  const books =
    lending.filter(
      book =>
        String(book.studentId) ===
        String(studentId)
    );


  const counts =
    adminBookCounts(books);


  if (counts.overdue > 0) {

    return "red";

  }


  if (counts.pending > 0) {

    return "orange";

  }


  return "green";
}


/*
 * ============================================================
 * CLASS SORT
 * ============================================================
 */

/*
 * ============================================================
 * CLASS SORT
 * ============================================================
 *
 * Desired order:
 *
 * 1. Preschool
 * 2. Kindergarten
 * 3. Accelerated Grade 1
 * 4. Grade 1
 * 5. Grade 2
 * 6. Grade 3
 * 7. Grade 4
 * 8. Grade 5
 * 9. Grade 6
 * 10. Grade 7
 * 11. Grade 8
 *
 * ============================================================
 */

function adminGradeSort(a, b) {

  const textA =
    String(a).trim();

  const textB =
    String(b).trim();


  /*
   * Convert class name into a sortable value.
   */

  function getSortInfo(text) {

    const lower =
      text.toLowerCase();


    /*
     * --------------------------------------------------------
     * PRESCHOOL
     * --------------------------------------------------------
     */

    if (
      lower.includes("preschool")
    ) {

      const numberMatch =
        text.match(/\d+/);


      const number =
        numberMatch
          ? Number(numberMatch[0])
          : 0;


      return {
        group: 1,
        number: number,
        text: text
      };

    }


    /*
     * --------------------------------------------------------
     * KINDERGARTEN
     * --------------------------------------------------------
     */

    if (
      lower.includes("kindergarten")
    ) {

      const numberMatch =
        text.match(/\d+/);


      const number =
        numberMatch
          ? Number(numberMatch[0])
          : 0;


      return {
        group: 2,
        number: number,
        text: text
      };

    }


    /*
     * --------------------------------------------------------
     * ACCELERATED GRADE
     * --------------------------------------------------------
     *
     * Accelerated Grade 1-A
     * comes BEFORE normal Grade 1.
     * --------------------------------------------------------
     */

    if (
      lower.includes("accelerated")
    ) {

      const numberMatch =
        text.match(/\d+/);


      const number =
        numberMatch
          ? Number(numberMatch[0])
          : 0;


      return {
        group: 3,
        number: number,
        text: text
      };

    }


    /*
     * --------------------------------------------------------
     * NORMAL GRADES
     * --------------------------------------------------------
     *
     * Grade 1
     * Grade 2
     * ...
     * Grade 8
     * --------------------------------------------------------
     */

    if (
      lower.includes("grade")
    ) {

      const numberMatch =
        text.match(/\d+/);


      const number =
        numberMatch
          ? Number(numberMatch[0])
          : 999;


      return {
        group: 4,
        number: number,
        text: text
      };

    }


    /*
     * --------------------------------------------------------
     * ANY UNKNOWN CLASS
     * --------------------------------------------------------
     *
     * Put it at the end.
     * --------------------------------------------------------
     */

    return {
      group: 99,
      number: 999,
      text: text
    };

  }


  const infoA =
    getSortInfo(textA);


  const infoB =
    getSortInfo(textB);


  /*
   * First:
   *
   * Preschool
   * Kindergarten
   * Accelerated
   * Grade
   */

  if (
    infoA.group !==
    infoB.group
  ) {

    return (
      infoA.group -
      infoB.group
    );

  }


  /*
   * Then sort by grade number.
   */

  if (
    infoA.number !==
    infoB.number
  ) {

    return (
      infoA.number -
      infoB.number
    );

  }


  /*
   * Finally:
   *
   * A
   * B
   * C
   * etc.
   */

  return textA.localeCompare(
    textB,
    undefined,
    {
      numeric: true,
      sensitivity: "base"
    }
  );

}


/*
 * ============================================================
 * VERIFY ADMIN
 * ============================================================
 */

async function requireAdminData() {

  const user =
    await waitForFirebaseAuth();


  if (!user) {

    window.location.replace(
      "./index.html"
    );

    return null;

  }


  const data =
    await loadSuvadiData();


  if (
    data.mode !== "admin" ||
    !data.admin?.active
  ) {

    window.location.replace(
      "./index.html"
    );

    return null;

  }


  return data;
}


/*
 * ============================================================
 * PREPARE INDEX.HTML FOR ADMIN
 * ============================================================
 */

function showAdminHomeLayout() {

  const familyHome =
    document.getElementById(
      "family-home"
    );


  const adminHome =
    document.getElementById(
      "admin-home"
    );


  const myBooksNav =
    document.getElementById(
      "my-books-nav"
    );


  /*
   * Hide normal student/family Home.
   */

  if (familyHome) {

    familyHome.hidden = true;

  }


  /*
   * Show Admin class list.
   */

  if (adminHome) {

    adminHome.hidden = false;

  }


  /*
   * Admin does not use My Books.
   */

  if (myBooksNav) {

    myBooksNav.hidden = true;

  }

}


/*
 * ============================================================
 * OPEN CLASS
 * ============================================================
 */

function openAdminGrade(
  grade
) {

  /*
   * ALL students.
   */

  if (
    grade === "__ALL__"
  ) {

    window.location.href =
      "./admin-students.html";

    return;

  }


  /*
   * Selected class.
   */

  window.location.href =
    "./admin-students.html?grade=" +
    encodeURIComponent(grade);

}


/*
 * ============================================================
 * ADMIN HOME - CLASS LIST
 * ============================================================
 */

async function loadAdminHome() {

  const container =
    document.getElementById(
      "admin-class-list"
    );


  const schoolLabel =
    document.getElementById(
      "admin-school"
    );


  try {

    const data =
      await requireAdminData();


    if (!data) {

      return;

    }


    /*
     * Switch index.html into Admin mode.
     */

    showAdminHomeLayout();


    /*
     * Example:
     *
     * SCC Admin
     */

    if (schoolLabel) {

      schoolLabel.textContent =
        data.admin.school +
        " Admin";

    }


    const students =
      data.students.map(
        normalizeStudent
      );


    const lending =
      data.lending.map(
        normalizeLending
      );


    /*
     * ======================================================
     * UNIQUE CLASSES
     * ======================================================
     */

    const grades =
      [
        ...new Set(

          students
            .map(
              student =>
                student.grade
            )
            .filter(Boolean)

        )
      ];


    grades.sort(
      adminGradeSort
    );


    const rows = [];


    /*
     * ======================================================
     * ALL STUDENTS
     * ======================================================
     *
     * Counts include ALL books available
     * to this Admin's school.
     * ======================================================
     */

    const allBookCounts =
      adminBookCounts(
        lending
      );


    rows.push(`

      <button
        class="admin-list-row admin-class-row"
        type="button"
        onclick="openAdminGrade('__ALL__')"
      >


        <span
          class="admin-class-info"
        >

          <span
            class="admin-row-name"
          >
            All
          </span>


          ${adminBookCountHtml(
            allBookCounts
          )}

        </span>


        <span
          class="admin-row-right"
        >

          <span
            class="admin-count"
            title="Students"
          >
            ${students.length}
          </span>


          <span
            class="admin-chevron"
          >
            ›
          </span>

        </span>


      </button>

    `);


    /*
     * ======================================================
     * INDIVIDUAL CLASSES
     * ======================================================
     */

    for (const grade of grades) {


      /*
       * Students in this class.
       */

      const gradeStudents =
        students.filter(
          student =>
            student.grade ===
            grade
        );


      /*
       * Student IDs in this class.
       */

      const gradeStudentIds =
        new Set(
          gradeStudents.map(
            student =>
              String(
                student.studentId
              )
          )
        );


      /*
       * Books belonging to students
       * in this class.
       */

      const gradeLending =
        lending.filter(
          book =>
            gradeStudentIds.has(
              String(
                book.studentId
              )
            )
        );


      /*
       * Calculate:
       *
       * overdue
       * pending
       * returned
       */

      const gradeBookCounts =
        adminBookCounts(
          gradeLending
        );


      rows.push(`

        <button
          class="admin-list-row admin-class-row"
          type="button"
          onclick='openAdminGrade(${JSON.stringify(grade)})'
        >


          <span
            class="admin-class-info"
          >

            <span
              class="admin-row-name"
            >
              ${adminEscape(grade)}
            </span>


            ${adminBookCountHtml(
              gradeBookCounts
            )}

          </span>


          <span
            class="admin-row-right"
          >

            <span
              class="admin-count"
              title="Students"
            >
              ${gradeStudents.length}
            </span>


            <span
              class="admin-chevron"
            >
              ›
            </span>

          </span>


        </button>

      `);

    }


    /*
     * ======================================================
     * DISPLAY CLASS LIST
     * ======================================================
     */

    if (!container) {

      throw new Error(
        "Admin class list container was not found."
      );

    }


    if (
      rows.length > 0
    ) {

      container.innerHTML =
        rows.join("");

    }
    else {

      container.innerHTML = `

        <div
          class="admin-empty"
        >
          No classes found.
        </div>

      `;

    }

  }
  catch (error) {

    console.error(
      "Unable to load Admin home:",
      error
    );


    if (container) {

      container.innerHTML = `

        <div
          class="admin-error"
        >
          ${adminEscape(
            error.message
          )}
        </div>

      `;

    }

  }

}


/*
 * ============================================================
 * OPEN STUDENT
 * ============================================================
 */

function openAdminStudent(
  studentId
) {

  /*
   * Store selected student.
   */

  setSelectedStudent(
    studentId
  );


  /*
   * Reuse student-books screen.
   */

  window.location.href =
    "./student-books.html?student=" +
    encodeURIComponent(studentId) +
    "&mode=admin";

}


/*
 * ============================================================
 * ADMIN STUDENT LIST
 * ============================================================
 */

async function loadAdminStudents() {

  const container =
    document.getElementById(
      "admin-student-list"
    );


  const title =
    document.getElementById(
      "admin-students-title"
    );


  const schoolLabel =
    document.getElementById(
      "admin-school"
    );


  try {

    const data =
      await requireAdminData();


    if (!data) {

      return;

    }


    /*
     * ======================================================
     * SCHOOL
     * ======================================================
     */

    if (schoolLabel) {

      schoolLabel.textContent =
        data.admin.school +
        " Admin";

    }


    /*
     * ======================================================
     * SELECTED CLASS
     * ======================================================
     */

    const params =
      new URLSearchParams(
        window.location.search
      );


    const grade =
      params.get(
        "grade"
      );


    /*
     * Page title.
     */

    if (title) {

      title.textContent =
        grade ||
        "All Students";

    }


    /*
     * ======================================================
     * STUDENTS
     * ======================================================
     */

    let students =
      data.students.map(
        normalizeStudent
      );


    const lending =
      data.lending.map(
        normalizeLending
      );


    /*
     * Filter selected class.
     */

    if (grade) {

      students =
        students.filter(
          student =>
            student.grade ===
            grade
        );

    }


    /*
     * Sort students alphabetically.
     */

    students.sort(
      (a, b) =>

        a.studentName.localeCompare(
          b.studentName,
          undefined,
          {
            sensitivity:
              "base"
          }
        )

    );


    /*
     * ======================================================
     * NO STUDENTS
     * ======================================================
     */

    if (
      students.length === 0
    ) {

      if (container) {

        container.innerHTML = `

          <div
            class="admin-empty"
          >
            No students found.
          </div>

        `;

      }


      return;

    }


    /*
     * ======================================================
     * BUILD STUDENT ROWS
     * ======================================================
     */

    const rows =
      students.map(
        student => {


          /*
           * Student's books.
           */

          const studentBooks =
            lending.filter(
              book =>
                String(
                  book.studentId
                ) ===
                String(
                  student.studentId
                )
            );


          /*
           * Counts.
           */

          const counts =
            adminBookCounts(
              studentBooks
            );


          /*
           * Overall student status.
           */

          let status =
            "green";


          if (
            counts.overdue > 0
          ) {

            status =
              "red";

          }
          else if (
            counts.pending > 0
          ) {

            status =
              "orange";

          }


          /*
           * Student row.
           */

          return `

            <button
              class="admin-list-row admin-student-row"
              type="button"
              onclick='openAdminStudent(${JSON.stringify(student.studentId)})'
            >


              <span
                class="admin-student-info"
              >


                <!-- Student Name -->

                <span
                  class="admin-student-name ${status}"
                >
                  ${adminEscape(
                    student.studentName
                  )}
                </span>


                <!--
                  RED    = Overdue
                  ORANGE = Pending
                  GREEN  = Returned
                -->

                ${adminBookCountHtml(
                  counts
                )}


              </span>



              <!-- Arrow -->

              <span
                class="admin-chevron"
              >
                ›
              </span>


            </button>

          `;

        }
      );


    /*
     * ======================================================
     * DISPLAY STUDENTS
     * ======================================================
     */

    if (container) {

      container.innerHTML =
        rows.join("");

    }

  }
  catch (error) {

    console.error(
      "Unable to load Admin students:",
      error
    );


    if (container) {

      container.innerHTML = `

        <div
          class="admin-error"
        >
          ${adminEscape(
            error.message
          )}
        </div>

      `;

    }

  }

}


/*
 * ============================================================
 * ADMIN SIGN OUT
 * ============================================================
 */

async function adminSignOut() {

  await signOutSuvadi();

}