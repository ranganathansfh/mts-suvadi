
let deferredInstallPrompt = null;
function spaNavigate(view="home", params={}, replace=false) {
  const u=new URL(location.href);
  u.search="";
  if(view && view!=="home") u.searchParams.set("view",view);
  Object.entries(params).forEach(([k,v])=>{ if(v!==undefined && v!==null && v!=="") u.searchParams.set(k,v); });
  history[replace?"replaceState":"pushState"]({view},"",u.pathname+u.search+u.hash);
  renderSpaRoute();
}
function showSpaScreen(id) {
  document.querySelectorAll(".spa-screen").forEach(el=>el.hidden=true);
  const el=document.getElementById(id); if(el) el.hidden=false;
}
function updateTopbar(view) {
  const title = document.getElementById("spa-page-title");
  const back = document.getElementById("spa-back");
  const leftSpacer = document.getElementById("spa-menu-button");

  const titles = {
    "home": "MTS சுவடி",
    "details": "Details",
    "books": "My Books",
    "student-books": "My Books",
    "book-details": "Details",
    "admin-students": "Students"
  };

  title.textContent = titles[view] || "MTS சுவடி";

  const root = view === "home" || view === "books";
  back.hidden = root;
  if (leftSpacer) leftSpacer.hidden = !root;

  updateBottomNavSelection(view);
}

function updateBottomNavSelection(view) {
  const home = document.getElementById("family-nav-home");
  const books = document.getElementById("family-nav-books");
  if (!home || !books) return;

  home.classList.remove("active");
  books.classList.remove("active");

  // Student list and book details are descendants of My Books.
  const myBooksViews = ["books", "student-books", "book-details"];

  if (myBooksViews.includes(view)) {
    books.classList.add("active");
  } else {
    home.classList.add("active");
  }
}
function showDataLoading(message = "Retrieving the latest library data") {
  const overlay = document.getElementById("suvadi-data-loading");
  const text = overlay?.querySelector(".suvadi-loading-message");
  if (text) text.textContent = message;
  if (overlay) overlay.hidden = false;
}

function hideDataLoading() {
  const overlay = document.getElementById("suvadi-data-loading");
  if (overlay) overlay.hidden = true;
}

async function renderSpaRoute(force=false) {
  const user = await waitForFirebaseAuth();
  const login = document.getElementById("suvadi-login-panel");
  const shell = document.getElementById("suvadi-app-panel");

  if (!user) {
    hideDataLoading();
    login.hidden = false;
    shell.hidden = true;
    return;
  }

  showDataLoading(force ? "Refreshing library data..." : "Loading library data...");

  try {
    if (force) clearSuvadiDataCache();

    const data = await loadSuvadiData();

    login.hidden = true;
    shell.hidden = false;

    const p = new URLSearchParams(location.search);
    let view = p.get("view") || "home";

    if (data.mode === "admin" && view === "books") view = "home";

    updateTopbar(view);

    document.getElementById("family-bottom-nav").hidden = data.mode === "admin";
    document.getElementById("admin-bottom-nav").hidden = data.mode !== "admin";

    if (view === "home") {
      if (data.mode === "admin") {
        showSpaScreen("screen-admin-home");
        await loadAdminHome();
      } else {
        showSpaScreen("screen-home");
        await loadHome();
      }
    } else if (view === "details") {
      showSpaScreen("screen-details");
      await loadDetails();
    } else if (view === "books") {
      showSpaScreen("screen-books");
      await loadMyBooksStudents();
    } else if (view === "student-books") {
      showSpaScreen("screen-student-books");
      await loadStudentBooks();
    } else if (view === "book-details") {
      showSpaScreen("screen-book-details");
      await loadBookDetails();

      if (data.mode === "admin" || p.get("mode") === "admin") {
        document.querySelectorAll(
          "#screen-book-details button, #screen-book-details .action-button, #screen-book-details .read-button"
        ).forEach(btn => {
          const text = (btn.textContent || "").toUpperCase();
          if (text.includes("MARK") || text.includes("READ") || text.includes("UNREAD")) {
            btn.hidden = true;
          }
        });
      }
    } else if (view === "admin-students") {
      showSpaScreen("screen-admin-students");
      await loadAdminStudents();
    } else {
      hideDataLoading();
      spaNavigate("home", {}, true);
      return;
    }
  } catch (e) {
    console.error(e);
    document.getElementById("google-signin-status").textContent =
      e.message || "Unable to load MTS Suvadi.";
    login.hidden = false;
    shell.hidden = true;
  } finally {
    hideDataLoading();
  }
}
async function handleFirebaseSignIn(){
  const status=document.getElementById("google-signin-status");
  try{ status.textContent="Signing in..."; await signInSuvadi(); await renderSpaRoute(true); }
  catch(e){ console.error(e); status.textContent=e.message||"Unable to sign in."; }
}
function installSuvadiApp(){
  if(window.matchMedia("(display-mode: standalone)").matches || navigator.standalone){
    alert("MTS Suvadi is already installed on this device."); return;
  }
  if(deferredInstallPrompt){
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.finally(()=>deferredInstallPrompt=null);
    return;
  }
  const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);
  if(ios) alert("On iPhone/iPad: open this page in Safari, tap Share, then tap Add to Home Screen.");
  else alert("Use your browser menu and choose Install app or Add to Home screen.");
}
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredInstallPrompt=e;});
window.addEventListener("appinstalled",()=>{deferredInstallPrompt=null;});
window.addEventListener("popstate",()=>renderSpaRoute());
window.addEventListener("load",()=>renderSpaRoute());
