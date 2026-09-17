const ALLOWED_LOGIN_DOMAIN = "mitamilsangam.org";

let suvadiDataCache = null;

/*
 * Derived in-memory cache.
 *
 * Firestore data is normalized only once after download, then indexed
 * for instant lookups by Student ID and Lending ID.
 */
let suvadiOptimizedCache = null;

function buildSuvadiOptimizedCache() {

  if (!suvadiDataCache) {
    suvadiOptimizedCache = null;
    return null;
  }

  const students =
    suvadiDataCache.students.map(normalizeStudent);

  const lending =
    suvadiDataCache.lending.map(normalizeLending);

  const studentById = new Map();

  students.forEach(student => {
    studentById.set(
      String(student.studentId),
      student
    );
  });

  const lendingByStudent = new Map();
  const lendingById = new Map();

  lending.forEach(book => {

    const studentKey =
      String(book.studentId);

    if (!lendingByStudent.has(studentKey)) {
      lendingByStudent.set(studentKey, []);
    }

    lendingByStudent
      .get(studentKey)
      .push(book);

    lendingById.set(
      String(book.lendingId),
      book
    );
  });

  suvadiOptimizedCache = {
    students,
    lending,
    studentById,
    lendingByStudent,
    lendingById
  };

  return suvadiOptimizedCache;
}

function getSuvadiOptimizedCache() {

  if (!suvadiOptimizedCache) {
    return buildSuvadiOptimizedCache();
  }

  return suvadiOptimizedCache;
}


/*
 * ============================================================
 * COMMON HELPERS
 * ============================================================
 */

function normalizeText(value) {
  return String(value ?? "").trim();
}


function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}


function toBoolean(value) {

  const text =
    normalizeText(value).toLowerCase();

  return (
    text === "yes" ||
    text === "true" ||
    text === "1" ||
    text === "y"
  );
}


function isAllowedLoginEmail(email) {

  return normalizeEmail(email)
    .endsWith(
      "@" + ALLOWED_LOGIN_DOMAIN
    );
}


/*
 * ============================================================
 * DATE HELPERS
 * ============================================================
 *
 * IMPORTANT:
 *
 * Firestore calendar dates are stored as:
 *
 * YYYY-MM-DD
 *
 * Example:
 *
 * 2026-09-12
 *
 * We deliberately construct a LOCAL JavaScript Date.
 * This prevents 9/12 from appearing as 9/11 in US time zones.
 * ============================================================
 */

function parseLocalDate(value) {

  if (!value) {
    return null;
  }


  /*
   * Firestore Timestamp
   */

  if (
    value &&
    typeof value.toDate === "function"
  ) {

    return value.toDate();

  }


  /*
   * Already a JavaScript Date
   */

  if (value instanceof Date) {

    return value;

  }


  const text =
    normalizeText(value);


  /*
   * ========================================================
   * YYYY-MM-DD
   * ========================================================
   */

  let match =
    text.match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );


  if (match) {

    return new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3])
    );

  }


  /*
   * ========================================================
   * MM/DD/YYYY
   * ========================================================
   */

  match =
    text.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
    );


  if (match) {

    return new Date(
      Number(match[3]),
      Number(match[1]) - 1,
      Number(match[2])
    );

  }


  /*
   * Other valid date/time formats
   */

  const parsed =
    new Date(text);


  return Number.isNaN(
    parsed.getTime()
  )
    ? null
    : parsed;
}


function displayDateValue(value) {

  if (!value) {
    return "";
  }


  const date =
    parseLocalDate(value);


  if (!date) {

    return normalizeText(
      value
    );

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
 * ============================================================
 * FIREBASE AUTH
 * ============================================================
 */

function waitForFirebaseAuth() {

  return new Promise(
    resolve => {

      const unsubscribe =
        suvadiAuth.onAuthStateChanged(
          user => {

            unsubscribe();

            resolve(user);

          }
        );

    }
  );
}


/*
 * ============================================================
 * NORMALIZE STUDENT
 * ============================================================
 */

function normalizeStudent(row) {

  const teachers = [];


  if (
    normalizeText(
      row.teacher
    )
  ) {

    teachers.push(
      normalizeText(
        row.teacher
      )
    );

  }


  const parents = [];


  if (
    normalizeText(
      row.parent1
    )
  ) {

    parents.push(
      normalizeText(
        row.parent1
      )
    );

  }


  if (
    normalizeText(
      row.parent2
    )
  ) {

    parents.push(
      normalizeText(
        row.parent2
      )
    );

  }


  return {

    studentId:
      normalizeText(
        row.studentId
      ),

    studentName:
      normalizeText(
        row.studentName
      ),

    grade:
      normalizeText(
        row.grade
      ),

    parentEmail:
      normalizeText(
        row.parentEmail
      ),

    school:
      normalizeText(
        row.school
      ).toUpperCase(),

    teachers,

    parents,

    studentEmail:
      normalizeEmail(
        row.studentEmail
      ),

    status:
      "green",

    raw:
      row
  };
}


/*
 * ============================================================
 * NORMALIZE LENDING
 * ============================================================
 */

function normalizeLending(row) {

  return {

    studentId:
      normalizeText(
        row.studentId
      ),

    studentName:
      normalizeText(
        row.studentName
      ),

    grade:
      normalizeText(
        row.grade
      ),

    school:
      normalizeText(
        row.school
      ).toUpperCase(),

    bookId:
      normalizeText(
        row.bookId
      ),

    bookTitle:
      normalizeText(
        row.bookTitle
      ),

    checkedOutDate:
      displayDateValue(
        row.checkedOutDate
      ),

    dateToReturn:
      displayDateValue(
        row.dateToReturn
      ),

    dateReturned:
      displayDateValue(
        row.dateReturned
      ),

    returned:
      toBoolean(
        row.returned
      ),

    due:
      normalizeText(
        row.due
      ),

    lateReturn:
      normalizeText(
        row.lateReturn
      ),

    numberOfDays:
      normalizeText(
        row.numberOfDays
      ),

    parentEmail:
      normalizeText(
        row.parentEmail
      ),

    lendingId:
      normalizeText(
        row.lendingId
      ),

    recordUpdatedDateTime:
      displayDateValue(
        row.recordUpdatedDateTime
      ),

    bookRead:
      toBoolean(
        row.bookRead
      ),

    bookReadUpdateTime:
      displayDateValue(
        row.bookReadUpdateTime
      ),

    raw:
      row
  };
}


/*
 * ============================================================
 * ADMIN LOOKUP
 * ============================================================
 */

async function getAdminForLoginEmail(
  loginEmail
) {

  const adminDoc =
    await suvadiDb
      .collection("admins")
      .doc(loginEmail)
      .get();


  if (!adminDoc.exists) {

    return null;

  }


  const row =
    adminDoc.data() || {};


  const active =
    toBoolean(
      row.active
    );


  const role =
    normalizeText(
      row.role
    );


  const school =
    normalizeText(
      row.school
    ).toUpperCase();


  if (
    !active ||
    role !== "Admin" ||
    !school
  ) {

    return null;

  }


  return {

    email:
      loginEmail,

    active:
      true,

    role,

    school
  };
}


async function getCurrentAdmin() {

  const user =
    await waitForFirebaseAuth();


  if (
    !user ||
    !user.email
  ) {

    return null;

  }


  const loginEmail =
    normalizeEmail(
      user.email
    );


  if (
    !isAllowedLoginEmail(
      loginEmail
    )
  ) {

    return null;

  }


  return getAdminForLoginEmail(
    loginEmail
  );
}


/*
 * ============================================================
 * LOAD SUVADI DATA
 * ============================================================
 */

async function loadSuvadiData(
  forceRefresh = false
) {

  if (
    suvadiDataCache &&
    !forceRefresh
  ) {

    return suvadiDataCache;

  }


  const user =
    await waitForFirebaseAuth();


  if (
    !user ||
    !user.email
  ) {

    throw new Error(
      "Please sign in with your MTS school Google account."
    );

  }


  const loginEmail =
    normalizeEmail(
      user.email
    );


  if (
    !isAllowedLoginEmail(
      loginEmail
    )
  ) {

    await suvadiAuth.signOut();


    throw new Error(
      "Please use your @mitamilsangam.org school Google account."
    );

  }


  /*
   * ========================================================
   * CHECK ADMIN FIRST
   * ========================================================
   */

  const admin =
    await getAdminForLoginEmail(
      loginEmail
    );


  /*
   * ========================================================
   * ADMIN LOGIN
   * ========================================================
   */

  if (admin) {

    /*
     * Firestore Rules are NOT filters.
     *
     * Therefore Admin queries MUST explicitly
     * contain the Admin's school.
     */

    const [
      studentSnap,
      lendingSnap
    ] =
      await Promise.all([

        suvadiDb
          .collection("students")
          .where(
            "school",
            "==",
            admin.school
          )
          .get(),

        suvadiDb
          .collection("lending")
          .where(
            "school",
            "==",
            admin.school
          )
          .get()

      ]);


    const students =
      studentSnap.docs.map(
        doc => ({

          ...doc.data(),

          _documentId:
            doc.id

        })
      );


    const lending =
      lendingSnap.docs.map(
        doc => ({

          ...doc.data(),

          _documentId:
            doc.id

        })
      );


    suvadiDataCache = {

      authenticated:
        true,

      mode:
        "admin",

      loginEmail,

      admin,

      school:
        admin.school,

      parentEmail:
        "",

      students,

      lending
    };


    buildSuvadiOptimizedCache();

    return suvadiDataCache;
  }


  /*
   * ========================================================
   * STUDENT / FAMILY LOGIN
   * ========================================================
   */

  const accessDoc =
    await suvadiDb
      .collection("userAccess")
      .doc(loginEmail)
      .get();


  if (!accessDoc.exists) {

    throw new Error(
      "This school account is not registered for MTS Suvadi."
    );

  }


  const parentEmail =
    normalizeEmail(
      accessDoc.data()
        .parentEmail
    );


  if (!parentEmail) {

    throw new Error(
      "Family access is not configured for this account."
    );

  }


  const [
    studentSnap,
    lendingSnap
  ] =
    await Promise.all([

      suvadiDb
        .collection("students")
        .where(
          "parentEmail",
          "==",
          parentEmail
        )
        .get(),

      suvadiDb
        .collection("lending")
        .where(
          "parentEmail",
          "==",
          parentEmail
        )
        .get()

    ]);


  const students =
    studentSnap.docs.map(
      doc => ({

        ...doc.data(),

        _documentId:
          doc.id

      })
    );


  const lending =
    lendingSnap.docs.map(
      doc => ({

        ...doc.data(),

        _documentId:
          doc.id

      })
    );


  suvadiDataCache = {

    authenticated:
      true,

    mode:
      "family",

    loginEmail,

    parentEmail,

    students,

    lending
  };


  buildSuvadiOptimizedCache();

  return suvadiDataCache;
}


/*
 * ============================================================
 * CURRENT USER
 * ============================================================
 */

async function getCurrentUser() {

  const data =
    await loadSuvadiData();


  if (
    data.mode === "admin"
  ) {

    return {

      email:
        data.loginEmail,

      displayName:
        "Admin",

      role:
        "Admin",

      school:
        data.admin.school

    };

  }


  const students =
    await getStudentsForCurrentUser();


  const parentNames = [];


  students.forEach(
    student => {

      student.parents.forEach(
        parent => {

          if (
            parent &&
            !parentNames.includes(
              parent
            )
          ) {

            parentNames.push(
              parent
            );

          }

        }
      );

    }
  );


  return {

    email:
      data.loginEmail,

    displayName:
      parentNames.join(" & ") ||
      students[0]?.studentName ||
      data.loginEmail
  };
}


/*
 * ============================================================
 * STUDENTS
 * ============================================================
 */

async function getStudentsForCurrentUser() {

  await loadSuvadiData();

  const cache =
    getSuvadiOptimizedCache();

  return cache
    ? cache.students
    : [];
}


async function getStudentById(
  studentId
) {

  await loadSuvadiData();

  const cache =
    getSuvadiOptimizedCache();

  if (!cache) {
    return null;
  }

  return (
    cache.studentById.get(
      String(studentId)
    ) ||
    null
  );
}


/*
 * ============================================================
 * LENDING
 * ============================================================
 */

async function getAllLendingForCurrentUser() {

  await loadSuvadiData();

  const cache =
    getSuvadiOptimizedCache();

  return cache
    ? cache.lending
    : [];
}


async function getLendingForStudent(
  studentId
) {

  await loadSuvadiData();

  const cache =
    getSuvadiOptimizedCache();

  if (!cache) {
    return [];
  }

  return (
    cache.lendingByStudent.get(
      String(studentId)
    ) ||
    []
  );
}


async function getLendingById(
  lendingId
) {

  await loadSuvadiData();

  const cache =
    getSuvadiOptimizedCache();

  if (!cache) {
    return null;
  }

  return (
    cache.lendingById.get(
      String(lendingId)
    ) ||
    null
  );
}


/*
 * ============================================================
 * BOOK STATUS
 * ============================================================
 */

function calculateBookStatus(
  book
) {

  if (
    book.returned
  ) {

    return "returned";

  }


  const due =
    parseLocalDate(
      book.dateToReturn
    );


  if (!due) {

    return "pending";

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


  return (
    due < today
      ? "overdue"
      : "pending"
  );
}


/*
 * ============================================================
 * STUDENT SUMMARY
 * ============================================================
 */

async function getStudentSummary(studentId) {

  const books =
    await getLendingForStudent(
      studentId
    );

  const summary = {
    totalBooks: books.length,
    booksRead:  0,
    returned:   0,
    pending:    0,
    overdue:    0
  };

  books.forEach(
    book => {

      const status = calculateBookStatus(book);
      summary[status]++;

      // Count books marked as READ by the student
      if (book.bookRead === true) {
        summary.booksRead++;
      }

    }
  );

  return summary;
}


/*
 * ============================================================
 * MARK BOOK READ
 * ============================================================
 */

async function markBookRead(
  lendingId
) {

  const data =
    await loadSuvadiData();


  /*
   * Admin is read-only.
   */

  if (
    data.mode === "admin"
  ) {

    throw new Error(
      "Admin access is read-only."
    );

  }


  const raw =
    data.lending.find(
      row =>
        normalizeText(
          row.lendingId
        ) ===
        normalizeText(
          lendingId
        )
    );


  if (!raw) {

    throw new Error(
      "Book lending record was not found."
    );

  }


  if (
    toBoolean(
      raw.returned
    )
  ) {

    throw new Error(
      "Returned books cannot be marked as read."
    );

  }


  if (
    toBoolean(
      raw.bookRead
    )
  ) {

    return {

      success:
        true,

      alreadyRead:
        true

    };

  }


  const docId =
    raw._documentId ||
    normalizeText(
      raw.lendingId
    );


  await suvadiDb
    .collection("lending")
    .doc(docId)
    .update({

      bookRead:
        true,

      bookReadUpdateTime:
        firebase.firestore
          .FieldValue
          .serverTimestamp()

    });


  raw.bookRead =
    true;


  raw.bookReadUpdateTime =
    new Date();


  /*
   * Rebuild only the in-memory derived indexes.
   * No additional Firestore read is performed.
   */
  buildSuvadiOptimizedCache();


  return {

    success:
      true

  };
}



/*
 * ============================================================
 * SET BOOK READ / UNREAD
 * ============================================================
 */
async function setBookReadStatus(lendingId, isRead) {
  const data = await loadSuvadiData();

  if (data.mode === "admin") {
    throw new Error("Admin access is read-only.");
  }

  const raw = data.lending.find(
    row => normalizeText(row.lendingId) === normalizeText(lendingId)
  );

  if (!raw) {
    throw new Error("Book lending record was not found.");
  }

  if (toBoolean(raw.returned)) {
    throw new Error("Returned books cannot be changed.");
  }

  const newValue = Boolean(isRead);

  if (toBoolean(raw.bookRead) === newValue) {
    return { success: true, unchanged: true };
  }

  const docId = raw._documentId || normalizeText(raw.lendingId);

  const updateData = {
    bookRead: newValue,
    bookReadUpdateTime: newValue
      ? firebase.firestore.FieldValue.serverTimestamp()
      : firebase.firestore.FieldValue.delete()
  };

  await suvadiDb
    .collection("lending")
    .doc(docId)
    .update(updateData);

  raw.bookRead = newValue;
  if (newValue) {
    raw.bookReadUpdateTime = new Date();
  } else {
    delete raw.bookReadUpdateTime;
  }

  buildSuvadiOptimizedCache();

  return { success: true };
}

/*
 * ============================================================
 * SIGN IN
 * ============================================================
 */

async function signInSuvadi() {

  const provider =
    new firebase.auth
      .GoogleAuthProvider();


  provider.setCustomParameters({

    hd:
      ALLOWED_LOGIN_DOMAIN,

    prompt:
      "select_account"

  });


  const result =
    await suvadiAuth
      .signInWithPopup(
        provider
      );


  if (
    !result.user?.email ||
    !isAllowedLoginEmail(
      result.user.email
    )
  ) {

    await suvadiAuth.signOut();


    throw new Error(
      "Please use your @mitamilsangam.org school Google account."
    );

  }


  clearSuvadiDataCache();


  return result.user;
}


/*
 * ============================================================
 * SIGN OUT
 * ============================================================
 */

async function signOutSuvadi() {

  await suvadiAuth.signOut();


  clearSuvadiDataCache();


  localStorage.removeItem(
    "suvadiSelectedStudentId"
  );


  window.location.href =
    "./index.html";
}


/*
 * ============================================================
 * CACHE
 * ============================================================
 */

function clearSuvadiDataCache() {

  suvadiDataCache =
    null;

  suvadiOptimizedCache =
    null;
}


/*
 * ============================================================
 * MENU
 * ============================================================
 */

function toggleSuvadiMenu() {

  const menu =
    document.getElementById(
      "suvadi-menu"
    );


  if (menu) {

    menu.hidden =
      !menu.hidden;

  }
}


/*
 * ============================================================
 * INITIALIZE MTS SUVADI HOME
 * ============================================================
 *
 * FAMILY:
 *
 *   index.html
 *       ↓
 *   existing student home
 *
 * ADMIN:
 *
 *   index.html
 *       ↓
 *   class list
 *
 * There is NO redirect to admin.html.
 * ============================================================
 */

async function initializeSuvadiHome() {

  const loginPanel =
    document.getElementById(
      "suvadi-login-panel"
    );


  const appPanel =
    document.getElementById(
      "suvadi-app-panel"
    );


  const status =
    document.getElementById(
      "google-signin-status"
    );


  const user =
    await waitForFirebaseAuth();


  /*
   * Not logged in
   */

  if (!user) {

    if (loginPanel) {

      loginPanel.hidden =
        false;

    }


    if (appPanel) {

      appPanel.hidden =
        true;

    }


    return;
  }


  try {

    if (status) {

      status.textContent =
        "Loading your library...";

    }


    const data =
      await loadSuvadiData();


    /*
     * Hide Login
     */

    if (loginPanel) {

      loginPanel.hidden =
        true;

    }


    /*
     * Show App
     */

    if (appPanel) {

      appPanel.hidden =
        false;

    }


    /*
     * ======================================================
     * ADMIN HOME
     * ======================================================
     */

    if (
      data.mode === "admin"
    ) {

      if (
        typeof loadAdminHome ===
        "function"
      ) {

        await loadAdminHome();

      }
      else {

        throw new Error(
          "Admin screen could not be loaded."
        );

      }


      return;
    }


    /*
     * ======================================================
     * FAMILY HOME
     * ======================================================
     */

    await loadHome();

  }
  catch (error) {

    console.error(
      error
    );


    if (loginPanel) {

      loginPanel.hidden =
        false;

    }


    if (appPanel) {

      appPanel.hidden =
        true;

    }


    if (status) {

      status.textContent =
        error.message;

    }

  }
}
function updateShortcutButtonVisibility() {
  const button = document.getElementById("suvadi-shortcut-button");
  if (!button) return;

  // This reliably tells us that THIS page was launched from an installed
  // PWA/home-screen shortcut. Browsers intentionally do not expose a general
  // "is this app installed somewhere on the device?" API to normal web pages.
  const launchedFromHomeScreen =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.navigator.standalone === true;

  button.hidden = launchedFromHomeScreen;
}


window.addEventListener("DOMContentLoaded", updateShortcutButtonVisibility);
window.addEventListener("appinstalled", updateShortcutButtonVisibility);
