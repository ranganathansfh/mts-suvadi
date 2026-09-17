// Firebase Web configuration for the separate MTS Suvadi Firebase project.
// These client configuration values are expected to be present in a web app.
const firebaseConfig = {
  apiKey: "AIzaSyB7L8LgJL05_7Qn5AzKI_7Fvw0G9lNPf2A",
  authDomain: "mts-suvadi-cbc08.firebaseapp.com",
  projectId: "mts-suvadi-cbc08",
  storageBucket: "mts-suvadi-cbc08.firebasestorage.app",
  messagingSenderId: "343309019922",
  appId: "1:343309019922:web:8608c393577229cbe1e1cb"
};

firebase.initializeApp(firebaseConfig);
window.suvadiAuth = firebase.auth();
window.suvadiDb = firebase.firestore();
