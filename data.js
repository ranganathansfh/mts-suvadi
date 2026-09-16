/* MTS Suvadi - Firebase/Firestore data provider
 * Separate from the Apps Script version.
 * Keeps the function names expected by app.js.
 */
const ALLOWED_LOGIN_DOMAIN = "mitamilsangam.org";
let suvadiDataCache = null;
 

function normalizeText(value) { return String(value ?? "").trim(); }
function normalizeEmail(value) { return normalizeText(value).toLowerCase(); }
function toBoolean(value) {
  if (typeof value === "boolean") return value;
  return ["yes", "true", "1", "y"].includes(normalizeText(value).toLowerCase());
}
function parseLocalDate(value) {
  if (!value) return null;
  if (value && typeof value.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  const text = normalizeText(value);
  const parts = text.split("/");
  if (parts.length === 3) {
    const m = Number(parts[0]), d = Number(parts[1]), y = Number(parts[2]);
    if (Number.isFinite(m) && Number.isFinite(d) && Number.isFinite(y)) return new Date(y, m - 1, d);
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
function displayDateValue(value) {
  if (!value) return "";
  if (value && typeof value.toDate === "function") {
    const d = value.toDate();
    return `${d.getMonth()+1}/${d.getDate()}/${d.getFullYear()}`;
  }
  return normalizeText(value);
}
function waitForFirebaseAuth() {
  return new Promise(resolve => {
    const unsubscribe = suvadiAuth.onAuthStateChanged(user => {
      unsubscribe();
      resolve(user);
    });
  });
}
function isAllowedLoginEmail(email) {
  return normalizeEmail(email).endsWith("@" + ALLOWED_LOGIN_DOMAIN);
}
function clearSuvadiDataCache() { suvadiDataCache = null; }

function normalizeStudent(row) {
  const teachers = normalizeText(row.teacher) ? [normalizeText(row.teacher)] : [];
  const parents = [];
  if (normalizeText(row.parent1)) parents.push(normalizeText(row.parent1));
  if (normalizeText(row.parent2)) parents.push(normalizeText(row.parent2));
  return {
    studentId: normalizeText(row.studentId), studentName: normalizeText(row.studentName),
    grade: normalizeText(row.grade), parentEmail: normalizeText(row.parentEmail),
    teachers, parents, studentEmail: normalizeEmail(row.studentEmail), status: "green", raw: row
  };
}
function normalizeLending(row) {
  return {
    studentId: normalizeText(row.studentId), studentName: normalizeText(row.studentName),
    grade: normalizeText(row.grade), bookId: normalizeText(row.bookId),
    bookTitle: normalizeText(row.bookTitle), checkedOutDate: displayDateValue(row.checkedOutDate),
    dateToReturn: displayDateValue(row.dateToReturn), dateReturned: displayDateValue(row.dateReturned),
    returned: toBoolean(row.returned), due: normalizeText(row.due), lateReturn: normalizeText(row.lateReturn),
    numberOfDays: normalizeText(row.numberOfDays), parentEmail: normalizeText(row.parentEmail),
    lendingId: normalizeText(row.lendingId), recordUpdatedDateTime: displayDateValue(row.recordUpdatedDateTime),
    bookRead: toBoolean(row.bookRead), bookReadUpdateTime: displayDateValue(row.bookReadUpdateTime), raw: row
  };
}

async function loadSuvadiData(forceRefresh = false) {
  if (suvadiDataCache && !forceRefresh) return suvadiDataCache;
  const user = await waitForFirebaseAuth();
  if (!user || !user.email) throw new Error("Please sign in with your MTS school Google account.");
  const loginEmail = normalizeEmail(user.email);
  if (!isAllowedLoginEmail(loginEmail)) {
    await suvadiAuth.signOut();
    throw new Error("Please use your @mitamilsangam.org school Google account.");
  }

  // userAccess document ID is the lower-case StudentEmailID.
  const accessDoc = await suvadiDb.collection("userAccess").doc(loginEmail).get();
  if (!accessDoc.exists) throw new Error("This school account is not registered for MTS Suvadi.");
  const parentEmail = normalizeEmail(accessDoc.data().parentEmail);
  if (!parentEmail) throw new Error("Family access is not configured for this account.");

  const [studentSnap, lendingSnap] = await Promise.all([
    suvadiDb.collection("students").where("parentEmail", "==", parentEmail).get(),
    suvadiDb.collection("lending").where("parentEmail", "==", parentEmail).get()
  ]);
  const students = studentSnap.docs.map(d => ({ ...d.data(), _documentId: d.id }));
  const lending = lendingSnap.docs.map(d => ({ ...d.data(), _documentId: d.id }));
  suvadiDataCache = { authenticated: true, loginEmail, parentEmail, students, lending };
  return suvadiDataCache;
}

async function getCurrentUser() {
  const data = await loadSuvadiData();
  const students = await getStudentsForCurrentUser();
  const parentNames = [];
  students.forEach(s => s.parents.forEach(p => { if (p && !parentNames.includes(p)) parentNames.push(p); }));
  return { email: data.loginEmail, displayName: parentNames.join(" & ") || (students[0]?.studentName || data.loginEmail) };
}
async function getStudentsForCurrentUser() { return (await loadSuvadiData()).students.map(normalizeStudent); }
async function getStudentById(studentId) { return (await getStudentsForCurrentUser()).find(s => String(s.studentId) === String(studentId)) || null; }
async function getAllLendingForCurrentUser() { return (await loadSuvadiData()).lending.map(normalizeLending); }
async function getLendingForStudent(studentId) { return (await getAllLendingForCurrentUser()).filter(b => String(b.studentId) === String(studentId)); }
async function getLendingById(lendingId) { return (await getAllLendingForCurrentUser()).find(b => String(b.lendingId) === String(lendingId)) || null; }

function calculateBookStatus(book) {
  if (book.returned) return "returned";
  const due = parseLocalDate(book.dateToReturn);
  if (!due) return "pending";
  const today = new Date(); today.setHours(0,0,0,0); due.setHours(0,0,0,0);
  return due < today ? "overdue" : "pending";
}
async function getStudentSummary(studentId) {
  const books = await getLendingForStudent(studentId);
  const summary = { totalBooks: books.length, returned: 0, pending: 0, overdue: 0 };
  books.forEach(book => { const s = calculateBookStatus(book); summary[s]++; });
  return summary;
}

async function markBookRead(lendingId) {
  const data = await loadSuvadiData();
  const raw = data.lending.find(r => normalizeText(r.lendingId) === normalizeText(lendingId));
  if (!raw) throw new Error("Book lending record was not found.");
  if (toBoolean(raw.returned)) throw new Error("Returned books cannot be marked as read.");
  if (toBoolean(raw.bookRead)) return { success: true, alreadyRead: true };
  const docId = raw._documentId || normalizeText(raw.lendingId);
  await suvadiDb.collection("lending").doc(docId).update({
    bookRead: true,
    bookReadUpdateTime: firebase.firestore.FieldValue.serverTimestamp()
  });
  raw.bookRead = true;
  raw.bookReadUpdateTime = new Date();
  return { success: true };
}

async function signInSuvadi() {
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ hd: ALLOWED_LOGIN_DOMAIN, prompt: "select_account" });
  const result = await suvadiAuth.signInWithPopup(provider);
  if (!result.user?.email || !isAllowedLoginEmail(result.user.email)) {
    await suvadiAuth.signOut();
    throw new Error("Please use your @mitamilsangam.org school Google account.");
  }
  clearSuvadiDataCache();
  return result.user;
}
async function signOutSuvadi() {
  await suvadiAuth.signOut();
  clearSuvadiDataCache();
  localStorage.removeItem("suvadiSelectedStudentId");
  window.location.href = "./index.html";
}
function toggleSuvadiMenu() {
  const menu = document.getElementById("suvadi-menu");
  if (menu) menu.hidden = !menu.hidden;
}

async function initializeSuvadiHome() {
  const loginPanel = document.getElementById("suvadi-login-panel");
  const appPanel = document.getElementById("suvadi-app-panel");
  const status = document.getElementById("google-signin-status");
  const user = await waitForFirebaseAuth();
  if (!user) {
    if (loginPanel) loginPanel.hidden = false;
    if (appPanel) appPanel.hidden = true;
    return;
  }
  try {
    if (status) status.textContent = "Loading your library...";
    await loadSuvadiData();
    if (loginPanel) loginPanel.hidden = true;
    if (appPanel) appPanel.hidden = false;
    await loadHome();
  } catch (error) {
    console.error(error);
    if (loginPanel) loginPanel.hidden = false;
    if (appPanel) appPanel.hidden = true;
    if (status) status.textContent = error.message;
  }
}
