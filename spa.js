let deferredInstallPrompt = null;

function spaNavigate(view="home", params={}, replace=false) {
  const u = new URL(location.href);

  u.search = "";

  if (view && view !== "home") {
    u.searchParams.set("view", view);
  }

  Object.entries(params).forEach(([k,v]) => {
    if (v !== undefined && v !== null && v !== "") {
      u.searchParams.set(k,v);
    }
  });

  history[replace ? "replaceState" : "pushState"](
    {view},
    "",
    u.pathname + u.search + u.hash
  );

  renderSpaRoute();
}


function showSpaScreen(id) {

  document
    .querySelectorAll(".spa-screen")
    .forEach(el => el.hidden = true);

  const el = document.getElementById(id);

  if (el) {
    el.hidden = false;
  }
}


function updateTopbar(view) {

  const title =
    document.getElementById("spa-page-title");

  if (title) {
    title.innerHTML =
      '<img src="icons/suvadi-header.png" class="suvadi-header-logo" alt="MTS சுவடி">';
  }


  /*
   * Back is contextual and lives only
   * in the bottom navigation.
   */

  const showBack =
    !["home", "books"].includes(view);

  const familyBack =
    document.getElementById("family-nav-back");

  const adminBack =
    document.getElementById("admin-nav-back");


  if (familyBack) {
    familyBack.hidden = !showBack;
  }

  if (adminBack) {
    adminBack.hidden = !showBack;
  }


  updateBottomNavSelection(view);
}


function updateBottomNavSelection(view) {

  /*
   * =========================================================
   * FAMILY NAVIGATION
   * =========================================================
   */

  const home =
    document.getElementById("family-nav-home");

  const books =
    document.getElementById("family-nav-books");


  if (home && books) {

    home.classList.remove("active");
    books.classList.remove("active");


    const myBooksViews = [
      "books",
      "student-books",
      "book-details"
    ];


    if (myBooksViews.includes(view)) {

      books.classList.add("active");

    } else {

      home.classList.add("active");

    }
  }


  /*
   * =========================================================
   * ADMIN NAVIGATION
   * =========================================================
   */

  const adminHome = document.getElementById("admin-nav-home");
  const adminReaders = document.getElementById("admin-nav-readers");
  const adminUsage = document.getElementById("admin-nav-usage");
  const adminActivity = document.getElementById("admin-nav-activity");

  if (adminHome && adminReaders && adminUsage && adminActivity) {
    [adminHome, adminReaders, adminUsage, adminActivity]
      .forEach(el => el.classList.remove("active"));

    const readersViews = ["admin-readers", "admin-reader-books"];
    if (readersViews.includes(view)) adminReaders.classList.add("active");
    else if (view === "admin-usage") adminUsage.classList.add("active");
    else if (view === "admin-activity") adminActivity.classList.add("active");
    else adminHome.classList.add("active");
  }
}


function showDataLoading(
  message = "Retrieving the latest library data"
) {

  const overlay =
    document.getElementById("suvadi-data-loading");

  const text =
    overlay?.querySelector(".suvadi-loading-message");


  if (text) {
    text.textContent = message;
  }

  if (overlay) {
    overlay.hidden = false;
  }
}


function hideDataLoading() {

  const overlay =
    document.getElementById("suvadi-data-loading");

  if (overlay) {
    overlay.hidden = true;
  }
}


async function renderSpaRoute(force=false) {

  const user =
    await waitForFirebaseAuth();

  const login =
    document.getElementById("suvadi-login-panel");

  const shell =
    document.getElementById("suvadi-app-panel");


  /*
   * =========================================================
   * NOT SIGNED IN
   * =========================================================
   */

  if (!user) {

    hideDataLoading();

    login.hidden = false;
    shell.hidden = true;

    return;
  }


  showDataLoading(
    force
      ? "Refreshing library data..."
      : "Loading library data..."
  );


  try {

    /*
     * Force refresh if Refresh button was pressed.
     */

    if (force) {
      clearSuvadiDataCache();
    }


    /*
     * Load Firestore data.
     */

    const data =
      await loadSuvadiData();


    login.hidden = true;
    shell.hidden = false;


    /*
     * Determine current SPA view.
     */

    const p =
      new URLSearchParams(location.search);

    let view =
      p.get("view") || "home";


    /*
     * Admin does not use the family Books root.
     */

    if (
      data.mode === "admin" &&
      view === "books"
    ) {
      view = "home";
    }


    /*
     * Update header / bottom navigation.
     */

    updateTopbar(view);


    document
      .getElementById("family-bottom-nav")
      .hidden =
        data.mode === "admin";


    document
      .getElementById("admin-bottom-nav")
      .hidden =
        data.mode !== "admin";


    /*
     * =========================================================
     * HOME
     * =========================================================
     */

    if (view === "home") {

      if (data.mode === "admin") {

        showSpaScreen(
          "screen-admin-home"
        );

        await loadAdminHome();

      } else {

        showSpaScreen(
          "screen-home"
        );

        await loadHome();

      }
    }


    /*
     * =========================================================
     * STUDENT DETAILS
     * =========================================================
     */

    else if (view === "details") {

      showSpaScreen(
        "screen-details"
      );

      await loadDetails();

    }


    /*
     * =========================================================
     * FAMILY - MY BOOKS
     * =========================================================
     */

    else if (view === "books") {

      showSpaScreen(
        "screen-books"
      );

      await loadMyBooksStudents();

    }


    /*
     * =========================================================
     * STUDENT BOOKS
     * =========================================================
     */

    else if (view === "student-books") {

      showSpaScreen(
        "screen-student-books"
      );

      await loadStudentBooks();

    }


    /*
     * =========================================================
     * BOOK DETAILS
     * =========================================================
     */

    else if (view === "book-details") {

      showSpaScreen(
        "screen-book-details"
      );

      await loadBookDetails();


      /*
       * Admin is read-only.
       *
       * Hide MARK READ / MARK UNREAD
       * controls when Admin is viewing
       * Book Details.
       */

      if (
        data.mode === "admin" ||
        p.get("mode") === "admin"
      ) {

        document.querySelectorAll(
          "#screen-book-details button, " +
          "#screen-book-details .action-button, " +
          "#screen-book-details .read-button"
        )
        .forEach(btn => {

          const text =
            (btn.textContent || "")
              .toUpperCase();

          if (
            text.includes("MARK") ||
            text.includes("READ") ||
            text.includes("UNREAD")
          ) {
            btn.hidden = true;
          }

        });
      }
    }


    /*
     * =========================================================
     * ADMIN - STUDENTS
     * =========================================================
     */

    else if (view === "admin-students") {

      showSpaScreen(
        "screen-admin-students"
      );

      await loadAdminStudents();

    }


    /*
     * =========================================================
     * ADMIN - READERS LIST
     * =========================================================
     */

    else if (view === "admin-readers") {

      showSpaScreen(
        "screen-admin-readers"
      );

      await loadAdminReaders();

    }
else if (view === "admin-reader-books") {

  showSpaScreen(
    "screen-admin-reader-books"
  );

  await loadAdminReaderBooks();

}

    else if (view === "admin-usage" && data.mode === "admin") {
      showSpaScreen("screen-admin-usage");
      await loadAdminUsage();
    }

    else if (view === "admin-activity" && data.mode === "admin") {
      showSpaScreen("screen-admin-activity");
      await loadAdminActivity();
    }

    /*
     * =========================================================
     * UNKNOWN VIEW
     * =========================================================
     */

    else {

      hideDataLoading();

      spaNavigate(
        "home",
        {},
        true
      );

      return;
    }

  }


  /*
   * =========================================================
   * ERROR
   * =========================================================
   */

  catch (e) {

    console.error(e);

    if (e.code === "SUVADI_ACCESS_DENIED") {
      await showSuvadiAccessDenied(e.loginEmail);
      return;
    }

    const status = document.getElementById("google-signin-status");
    if (status) status.textContent = e.message || "Unable to load MTS Suvadi.";

    login.hidden = false;
    shell.hidden = true;

  }


  /*
   * =========================================================
   * FINISHED
   * =========================================================
   */

  finally {

    hideDataLoading();

  }
}


async function showSuvadiAccessDenied(email) {
  const login = document.getElementById("suvadi-login-panel");
  const shell = document.getElementById("suvadi-app-panel");
  const denied = document.getElementById("suvadi-access-denied");
  const emailElement = document.getElementById("suvadi-denied-email");
  if (login) login.hidden = true;
  if (shell) shell.hidden = true;
  if (emailElement) emailElement.textContent = email || "";
  if (denied) denied.hidden = false;
  await suvadiAuth.signOut();
  clearSuvadiDataCache();
}

async function retrySuvadiSignIn() {
  const denied = document.getElementById("suvadi-access-denied");
  const login = document.getElementById("suvadi-login-panel");
  const status = document.getElementById("google-signin-status");
  if (denied) denied.hidden = true;
  if (login) login.hidden = false;
  if (status) status.textContent = "";
  await handleFirebaseSignIn();
}


async function handleFirebaseSignIn() {

  const status =
    document.getElementById(
      "google-signin-status"
    );

  try {

    status.textContent =
      "Signing in...";

    await signInSuvadi();

    await renderSpaRoute(true);

  }

  catch(e) {

    console.error(e);

    status.textContent =
      e.message ||
      "Unable to sign in.";

  }
}


function installSuvadiApp() {

  /*
   * Already installed.
   */

  if (
    window.matchMedia(
      "(display-mode: standalone)"
    ).matches ||
    navigator.standalone
  ) {

    alert(
      "MTS Suvadi is already installed on this device."
    );

    return;
  }


  /*
   * Browser supplied installation prompt.
   */

  if (deferredInstallPrompt) {

    deferredInstallPrompt.prompt();

    deferredInstallPrompt
      .userChoice
      .finally(() =>
        deferredInstallPrompt = null
      );

    return;
  }


  /*
   * iPhone / iPad instructions.
   */

  const ios =
    /iphone|ipad|ipod/i
      .test(navigator.userAgent);


  if (ios) {

    alert(
      "On iPhone/iPad: open this page in Safari, tap Share, then tap Add to Home Screen."
    );

  } else {

    alert(
      "Use your browser menu and choose Install app or Add to Home screen."
    );

  }
}


window.addEventListener(
  "beforeinstallprompt",
  e => {

    e.preventDefault();

    deferredInstallPrompt = e;

  }
);


window.addEventListener(
  "appinstalled",
  () => {

    deferredInstallPrompt = null;

  }
);


window.addEventListener(
  "popstate",
  () => renderSpaRoute()
);


window.addEventListener(
  "load",
  () => renderSpaRoute()
);
