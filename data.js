const SUVADI_API_URL =
  "https://script.google.com/macros/s/AKfycbwNm5UFI6sW84gjVn566gVVmlOYLhSIHy-KK3BuAFp1eMPoCnHv313wbcDcWLPkYJWZ/exec";

const GOOGLE_CLIENT_ID =
  "1089139823866-k7bi58arg84268sqmkm1se1luj9epj1b.apps.googleusercontent.com";

const SUVADI_SESSION_KEY = "suvadiSessionToken";
const SUVADI_DATA_CACHE_KEY = "suvadiFamilyData";
const SUVADI_DATA_CACHE_TIME_KEY = "suvadiFamilyDataTime";

// Browser cache valid for 5 minutes
const SUVADI_DATA_CACHE_MAX_AGE = 5 * 60 * 1000;



let suvadiDataCache = null;


/*
 * ============================================================
 * SESSION
 * ============================================================
 */

function getSuvadiSessionToken() {
  return sessionStorage.getItem(
    SUVADI_SESSION_KEY
  );
}


function saveSuvadiSessionToken(token) {
  sessionStorage.setItem(
    SUVADI_SESSION_KEY,
    token
  );
}


function clearSuvadiSessionToken() {
  sessionStorage.removeItem(
    SUVADI_SESSION_KEY
  );
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


/*
 * Handles Google Sheet display dates such as:
 *
 * 9/26/2026
 * 09/26/2026
 */

function parseLocalDate(dateText) {

  if (!dateText) {
    return null;
  }

  const text =
    normalizeText(dateText);

  const parts =
    text.split("/");

  if (parts.length === 3) {

    const month =
      Number(parts[0]);

    const day =
      Number(parts[1]);

    const year =
      Number(parts[2]);

    if (
      Number.isFinite(month) &&
      Number.isFinite(day) &&
      Number.isFinite(year)
    ) {

      return new Date(
        year,
        month - 1,
        day
      );

    }

  }


  /*
   * Fallback for other valid date formats.
   */

  const parsed =
    new Date(text);

  if (
    Number.isNaN(parsed.getTime())
  ) {
    return null;
  }

  return parsed;
}

/*
 * ============================================================
 * BROWSER FAMILY DATA CACHE
 * ============================================================
 */

function getBrowserSuvadiCache() {

  try {

    const cachedText =
      sessionStorage.getItem(
        SUVADI_DATA_CACHE_KEY
      );

    const cachedTime =
      Number(
        sessionStorage.getItem(
          SUVADI_DATA_CACHE_TIME_KEY
        )
      );


    if (
      !cachedText ||
      !cachedTime
    ) {

      return null;

    }


    const age =
      Date.now() - cachedTime;


    if (
      age > SUVADI_DATA_CACHE_MAX_AGE
    ) {

      clearBrowserSuvadiCache();

      return null;

    }


    return JSON.parse(
      cachedText
    );

  }
  catch (error) {

    console.error(
      "Unable to read Suvadi browser cache:",
      error
    );


    clearBrowserSuvadiCache();

    return null;

  }

}


function saveBrowserSuvadiCache(data) {

  try {

    sessionStorage.setItem(
      SUVADI_DATA_CACHE_KEY,
      JSON.stringify(data)
    );


    sessionStorage.setItem(
      SUVADI_DATA_CACHE_TIME_KEY,
      String(Date.now())
    );

  }
  catch (error) {

    /*
     * Cache failure should never stop the app.
     */

    console.error(
      "Unable to save Suvadi browser cache:",
      error
    );

  }

}


function clearBrowserSuvadiCache() {

  sessionStorage.removeItem(
    SUVADI_DATA_CACHE_KEY
  );


  sessionStorage.removeItem(
    SUVADI_DATA_CACHE_TIME_KEY
  );

}
/*
 * ============================================================
 * API
 * ============================================================
 */

async function loadSuvadiData(forceRefresh = false) {

  /*
   * LEVEL 1 CACHE
   *
   * Current JavaScript page memory.
   */

  if (
    suvadiDataCache &&
    !forceRefresh
  ) {

    return suvadiDataCache;

  }


  /*
   * LEVEL 2 CACHE
   *
   * sessionStorage survives navigation between:
   *
   * index.html
   * books.html
   * student-books.html
   * book-details.html
   * details.html
   */

  if (!forceRefresh) {

    const browserCache =
      getBrowserSuvadiCache();


    if (browserCache) {

      console.log(
        "Suvadi: using browser family cache."
      );


      suvadiDataCache =
        browserCache;


      return browserCache;

    }

  }


  /*
   * No usable browser cache.
   * Contact Apps Script.
   */

  const sessionToken =
    getSuvadiSessionToken();


  if (!sessionToken) {

    throw new Error(
      "Please sign in with your MTS school Google account."
    );

  }


  const url =
    SUVADI_API_URL +
    "?action=sessionFamilyBootstrap" +
    "&session=" +
    encodeURIComponent(
      sessionToken
    );


  /*
   * Try the Apps Script request.
   *
   * If Apps Script temporarily gives us an HTTP
   * error such as the 404 we have been seeing,
   * wait briefly and try ONE more time.
   */

  let response = null;


  for (
    let attempt = 1;
    attempt <= 2;
    attempt++
  ) {

    try {

      response =
        await fetch(
          url,
          {
            cache: "no-store"
          }
        );


      if (response.ok) {

        break;

      }


      console.warn(
        "Suvadi API attempt " +
        attempt +
        " returned HTTP " +
        response.status
      );


      /*
       * Only retry once.
       */

      if (attempt === 1) {

        await new Promise(
          function (resolve) {

            setTimeout(
              resolve,
              750
            );

          }
        );

      }

    }
    catch (error) {

      console.error(
        "Suvadi API attempt " +
        attempt +
        " failed:",
        error
      );


      if (attempt === 1) {

        await new Promise(
          function (resolve) {

            setTimeout(
              resolve,
              750
            );

          }
        );

      }
      else {

        throw new Error(
          "Unable to contact the Suvadi API."
        );

      }

    }

  }


  if (
    !response ||
    !response.ok
  ) {

    const status =
      response
        ? response.status
        : "Unknown";


    throw new Error(
      "Unable to connect to Suvadi API (HTTP " +
      status +
      ")."
    );

  }


  let result;


  try {

    result =
      await response.json();

  }
  catch (error) {

    console.error(
      "Invalid Suvadi API response:",
      error
    );


    throw new Error(
      "Suvadi API returned an invalid response."
    );

  }


  /*
   * Handle server-side errors.
   */

  if (!result.success) {

    if (
      result.authenticationRequired
    ) {

      clearSuvadiSessionToken();

      clearSuvadiDataCache();

    }


    throw new Error(
      result.message ||
      "Unable to load Suvadi data."
    );

  }


  if (!result.authenticated) {

    throw new Error(
      "Suvadi authentication was not verified."
    );

  }


  /*
   * LEVEL 1 CACHE
   */

  suvadiDataCache =
    result;


  /*
   * LEVEL 2 CACHE
   *
   * This is what makes page-to-page navigation fast.
   */

  saveBrowserSuvadiCache(
    result
  );


  console.log(
    "Suvadi: family data downloaded and cached."
  );


  return result;

}

function clearSuvadiDataCache() {

  suvadiDataCache = null;

  clearBrowserSuvadiCache();

}


/*
 * ============================================================
 * STUDENT ADAPTER
 * ============================================================
 *
 * Google Sheet:
 *
 * StudentID
 * Student_Name
 * Grade
 * ParentEmailID
 * Teacher
 * Parent1
 * Parent2
 * StudentEmailID
 *
 * becomes:
 *
 * studentId
 * studentName
 * grade
 * parentEmail
 * teachers
 * parents
 * studentEmail
 * status
 */

function normalizeStudent(row) {

  const teachers = [];

  if (
    normalizeText(row.Teacher)
  ) {

    teachers.push(
      normalizeText(row.Teacher)
    );

  }


  const parents = [];

  if (
    normalizeText(row.Parent1)
  ) {

    parents.push(
      normalizeText(row.Parent1)
    );

  }


  if (
    normalizeText(row.Parent2)
  ) {

    parents.push(
      normalizeText(row.Parent2)
    );

  }


  return {

    studentId:
      normalizeText(
        row.StudentID
      ),

    studentName:
      normalizeText(
        row.Student_Name
      ),

    grade:
      normalizeText(
        row.Grade
      ),

    parentEmail:
      normalizeText(
        row.ParentEmailID
      ),

    teachers:
      teachers,

    parents:
      parents,

    studentEmail:
      normalizeEmail(
        row.StudentEmailID
      ),

    /*
     * Student sheet currently does not have
     * a separate status column.
     */

    status:
      "green",

    /*
     * Keep the original Google Sheet row.
     */

    raw:
      row

  };

}


/*
 * ============================================================
 * LENDING ADAPTER
 * ============================================================
 *
 * Google Sheet:
 *
 * StudentID
 * Student_Name
 * Grade
 * Book_ID
 * Book_Title
 * CheckedOutDate
 * Date_To_Return
 * Date_Returned
 * Returned
 * Due
 * Late_Return
 * NumberofDays
 * ParentEmailID
 * LendingID
 * RecordUpdatedDateTime
 * Book Read
 * BookReadUpdateTime
 */

function normalizeLending(row) {

  return {

    studentId:
      normalizeText(
        row.StudentID
      ),

    studentName:
      normalizeText(
        row.Student_Name
      ),

    grade:
      normalizeText(
        row.Grade
      ),

    bookId:
      normalizeText(
        row.Book_ID
      ),

    bookTitle:
      normalizeText(
        row.Book_Title
      ),

    checkedOutDate:
      normalizeText(
        row.CheckedOutDate
      ),

    dateToReturn:
      normalizeText(
        row.Date_To_Return
      ),

    dateReturned:
      normalizeText(
        row.Date_Returned
      ),

    returned:
      toBoolean(
        row.Returned
      ),

    due:
      normalizeText(
        row.Due
      ),

    lateReturn:
      normalizeText(
        row.Late_Return
      ),

    numberOfDays:
      normalizeText(
        row.NumberofDays
      ),

    parentEmail:
      normalizeText(
        row.ParentEmailID
      ),

    lendingId:
      normalizeText(
        row.LendingID
      ),

    recordUpdatedDateTime:
      normalizeText(
        row.RecordUpdatedDateTime
      ),

    /*
     * IMPORTANT:
     * Google Sheet column contains a space,
     * therefore bracket notation is required.
     */

    bookRead:
      toBoolean(
        row["Book Read"]
      ),

    bookReadUpdateTime:
      normalizeText(
        row.BookReadUpdateTime
      ),

    raw:
      row

  };

}


/*
 * ============================================================
 * CURRENT USER
 * ============================================================
 */

async function getCurrentUser() {

  const data =
    await loadSuvadiData();

  const students =
    await getStudentsForCurrentUser();

  const parentNames = [];


  students.forEach(
    function (student) {

      student.parents.forEach(
        function (parent) {

          if (
            parent &&
            !parentNames.includes(parent)
          ) {

            parentNames.push(parent);

          }

        }
      );

    }
  );


  let displayName =
    parentNames.join(" & ");


  if (!displayName) {

    displayName =
      students.length
        ? students[0].studentName
        : data.loginEmail;

  }


  return {

    email:
      data.loginEmail,

    displayName:
      displayName

  };

}


/*
 * ============================================================
 * STUDENTS
 * ============================================================
 */

async function getStudentsForCurrentUser() {

  const data =
    await loadSuvadiData();


  return (
    data.students || []
  ).map(
    normalizeStudent
  );

}


async function getStudentById(studentId) {

  const students =
    await getStudentsForCurrentUser();


  return (
    students.find(
      function (student) {

        return (
          String(
            student.studentId
          ) ===
          String(
            studentId
          )
        );

      }
    ) || null
  );

}


/*
 * ============================================================
 * LENDING
 * ============================================================
 */

async function getAllLendingForCurrentUser() {

  const data =
    await loadSuvadiData();


  return (
    data.lending || []
  ).map(
    normalizeLending
  );

}


async function getLendingForStudent(studentId) {

  const lending =
    await getAllLendingForCurrentUser();


  return lending.filter(
    function (book) {

      return (
        String(
          book.studentId
        ) ===
        String(
          studentId
        )
      );

    }
  );

}


async function getLendingById(lendingId) {

  const lending =
    await getAllLendingForCurrentUser();


  return (
    lending.find(
      function (book) {

        return (
          String(
            book.lendingId
          ) ===
          String(
            lendingId
          )
        );

      }
    ) || null
  );

}


/*
 * ============================================================
 * BOOK STATUS
 * ============================================================
 */

function calculateBookStatus(book) {

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


  if (
    due < today
  ) {

    return "overdue";

  }


  return "pending";

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

    totalBooks:
      books.length,

    returned:
      0,

    pending:
      0,

    overdue:
      0

  };


  books.forEach(
    function (book) {

      const status =
        calculateBookStatus(
          book
        );


      if (
        status === "returned"
      ) {

        summary.returned++;

      }
      else if (
        status === "overdue"
      ) {

        summary.overdue++;

      }
      else {

        summary.pending++;

      }

    }
  );


  return summary;

}


/*
 * ============================================================
 * GOOGLE SIGN-IN
 * ============================================================
 */

function initializeGoogleSignIn() {

  if (
    typeof google === "undefined" ||
    !google.accounts ||
    !google.accounts.id
  ) {

    console.error(
      "Google Identity Services has not loaded."
    );

    return;

  }


  google.accounts.id.initialize({

    client_id:
      GOOGLE_CLIENT_ID,

    callback:
      handleGoogleSignIn,

    hd:
      "mitamilsangam.org"

  });


  const buttonContainer =
    document.getElementById(
      "google-signin-button"
    );


  if (buttonContainer) {

    /*
     * Prevent duplicate Google buttons if initialization
     * is accidentally called more than once.
     */

    buttonContainer.innerHTML = "";


    google.accounts.id.renderButton(
      buttonContainer,
      {
        type:
          "standard",

        theme:
          "outline",

        size:
          "large",

        text:
          "signin_with",

        shape:
          "rectangular"
      }
    );

  }

}


/*
 * ============================================================
 * GOOGLE SIGN-IN CALLBACK
 * ============================================================
 */

async function handleGoogleSignIn(response) {

  const status =
    document.getElementById(
      "google-signin-status"
    );


  try {

    if (
      !response ||
      !response.credential
    ) {

      throw new Error(
        "Google did not return a credential."
      );

    }


    if (status) {

      status.textContent =
        "Signing in...";

    }


    /*
     * Send Google's credential to Apps Script.
     *
     * Apps Script verifies the Google credential
     * and returns a random Suvadi session token.
     */

    const url =
      SUVADI_API_URL +
      "?action=login" +
      "&credential=" +
      encodeURIComponent(
        response.credential
      );


    let apiResponse;

    try {

      apiResponse =
        await fetch(url);

    }
    catch (error) {

      console.error(
        "Suvadi login network error:",
        error
      );

      throw new Error(
        "Unable to contact the Suvadi API."
      );

    }


    if (!apiResponse.ok) {

      console.error(
        "Suvadi login HTTP error:",
        apiResponse.status,
        apiResponse.statusText
      );

      throw new Error(
        `Unable to connect to Suvadi API (HTTP ${apiResponse.status}).`
      );

    }


    let result;

    try {

      result =
        await apiResponse.json();

    }
    catch (error) {

      console.error(
        "Invalid Suvadi login response:",
        error
      );

      throw new Error(
        "Suvadi API returned an invalid login response."
      );

    }


    if (
      !result.success ||
      !result.sessionToken
    ) {

      throw new Error(
        result.message ||
        "Suvadi login failed."
      );

    }


    /*
     * Save ONLY our random Suvadi session.
     *
     * Google's ID credential is NOT stored.
     */

    saveSuvadiSessionToken(
      result.sessionToken
    );


    /*
     * Remove data belonging to any previous session.
     */

    clearSuvadiDataCache();


    const loginPanel =
      document.getElementById(
        "suvadi-login-panel"
      );

    const appPanel =
      document.getElementById(
        "suvadi-app-panel"
      );


    if (loginPanel) {

      loginPanel.hidden =
        true;

    }


    if (appPanel) {

      appPanel.hidden =
        false;

    }


    /*
     * Load Home using the new server-side
     * Suvadi session.
     */

    await loadHome();


    if (status) {

      status.textContent =
        "Signed in successfully.";

    }

  }
  catch (error) {

    console.error(
      "Suvadi login failed:",
      error
    );


    clearSuvadiSessionToken();

    clearSuvadiDataCache();


    if (status) {

      status.textContent =
        error.message;

    }

  }

}


/*
 * ============================================================
 * HOME INITIALIZATION
 * ============================================================
 *
 * IMPORTANT:
 * There should be ONLY ONE initializeSuvadiHome()
 * function in this file.
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


  const sessionToken =
    getSuvadiSessionToken();


  /*
   * No Suvadi session exists.
   */

  if (!sessionToken) {

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


  /*
   * Existing session:
   * verify it by requesting family data.
   */

  try {

    if (status) {

      status.textContent =
        "Loading your library...";

    }


    await loadSuvadiData();


    /*
     * Session is valid.
     */

    if (loginPanel) {

      loginPanel.hidden =
        true;

    }


    if (appPanel) {

      appPanel.hidden =
        false;

    }


    await loadHome();

  }
  catch (error) {

    console.error(
      "Suvadi session check failed:",
      error
    );


    clearSuvadiSessionToken();

    clearSuvadiDataCache();


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
        "Your session has expired. Please sign in again.";

    }

  }

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


  if (!menu) {

    return;

  }


  menu.hidden =
    !menu.hidden;

}


/*
 * ============================================================
 * SIGN OUT
 * ============================================================
 */

async function signOutSuvadi() {

  const sessionToken =
    getSuvadiSessionToken();


  /*
   * Tell Apps Script to invalidate the server session.
   */

  try {

    if (sessionToken) {

      const url =
        SUVADI_API_URL +
        "?action=logout" +
        "&session=" +
        encodeURIComponent(
          sessionToken
        );


      await fetch(url);

    }

  }
  catch (error) {

    /*
     * Local logout must still continue even if
     * Apps Script cannot be contacted.
     */

    console.error(
      "Server logout failed:",
      error
    );

  }


  /*
   * Always remove local session information.
   */

  clearSuvadiSessionToken();

  clearSuvadiDataCache();


  const menu =
    document.getElementById(
      "suvadi-menu"
    );

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


  if (menu) {

    menu.hidden =
      true;

  }


  if (appPanel) {

    appPanel.hidden =
      true;

  }


  if (loginPanel) {

    loginPanel.hidden =
      false;

  }


  if (status) {

    status.textContent =
      "";

  }


  /*
   * Allow Google account selection again.
   */

  if (
    typeof google !== "undefined" &&
    google.accounts &&
    google.accounts.id
  ) {

    google.accounts.id.disableAutoSelect();

  }

}


/*
 * ============================================================
 * MARK BOOK READ
 * ============================================================
 */

async function markBookRead(lendingId) {

  const sessionToken =
    getSuvadiSessionToken();


  if (!sessionToken) {

    throw new Error(
      "Your session has expired. Please sign in again."
    );

  }


  if (!lendingId) {

    throw new Error(
      "Lending ID was not supplied."
    );

  }


  const url =
    SUVADI_API_URL +
    "?action=markBookRead" +
    "&session=" +
    encodeURIComponent(
      sessionToken
    ) +
    "&lendingId=" +
    encodeURIComponent(
      lendingId
    );


  let response;

  try {

    response =
      await fetch(url);

  }
  catch (error) {

    console.error(
      "Mark Book Read network error:",
      error
    );

    throw new Error(
      "Unable to contact the Suvadi server."
    );

  }


  if (!response.ok) {

    console.error(
      "Mark Book Read HTTP error:",
      response.status,
      response.statusText
    );

    throw new Error(
      `Unable to contact the Suvadi server (HTTP ${response.status}).`
    );

  }


  let result;

  try {

    result =
      await response.json();

  }
  catch (error) {

    console.error(
      "Invalid Mark Book Read response:",
      error
    );

    throw new Error(
      "Suvadi server returned an invalid response."
    );

  }


  if (
    result.authenticationRequired
  ) {

    clearSuvadiSessionToken();

    clearSuvadiDataCache();


    throw new Error(
      "Your session has expired. Please sign in again."
    );

  }


  if (!result.success) {

    throw new Error(
      result.message ||
      "Unable to mark the book as read."
    );

  }


  /*
   * IMPORTANT:
   *
   * The Google Sheet has changed, but we do NOT
   * immediately download the whole family again.
   *
   * app.js updates the current Book Details screen
   * locally after this succeeds.
   *
   * The next page requiring fresh data can retrieve
   * the updated bootstrap.
   */

/*
 * Update the cached Lending record locally.
 *
 * This avoids downloading the complete family
 * again just because one Book Read value changed.
 */

if (
  suvadiDataCache &&
  Array.isArray(
    suvadiDataCache.lending
  )
) {

  const lendingRow =
    suvadiDataCache.lending.find(
      function (row) {

        return (
          String(row.LendingID) ===
          String(lendingId)
        );

      }
    );


  if (lendingRow) {

    lendingRow["Book Read"] =
      true;


    lendingRow.BookReadUpdateTime =
      new Date().toISOString();


    saveBrowserSuvadiCache(
      suvadiDataCache
    );

  }

}


return result;

}