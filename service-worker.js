const CACHE_NAME = "mts-suvadi-spa-v14";

const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./firebase-config.js",
  "./data.js",
  "./app.js",
  "./admin.js",
  "./spa.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/mts-logo.png",
  "./icons/suvadi-loading.png"
];


/* =========================================================
   PWA CACHE
   ========================================================= */

self.addEventListener("install", event => {

  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );

});


self.addEventListener("activate", event => {

  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );

});


self.addEventListener("fetch", event => {

  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {

        const copy = response.clone();

        caches
          .open(CACHE_NAME)
          .then(cache =>
            cache.put(event.request, copy)
          );

        return response;
      })
      .catch(() =>
        caches
          .match(event.request)
          .then(response =>
            response ||
            caches.match("./index.html")
          )
      )
  );

});


/* =========================================================
   PUSH NOTIFICATIONS
   ========================================================= */

self.addEventListener("push", event => {

  let payload = {};

  try {
    payload = event.data
      ? event.data.json()
      : {};
  }
  catch (error) {
    payload = {
      notification: {
        body: event.data
          ? event.data.text()
          : ""
      }
    };
  }

  const notification =
    payload.notification || {};

  const data =
    payload.data || {};

  const title =
    notification.title ||
    "MTS சுவடி";

  const options = {

    body:
      notification.body ||
      "You have a new notification.",

    icon:
      "./icons/icon-192.png",

    badge:
      "./icons/icon-192.png",

    data: {
      url:
        data.url ||
        "./"
    }

  };

  event.waitUntil(
    self.registration.showNotification(
      title,
      options
    )
  );

});


/* =========================================================
   NOTIFICATION CLICK
   ========================================================= */

self.addEventListener(
  "notificationclick",
  event => {

    event.notification.close();

    const targetUrl =
      event.notification.data?.url ||
      "./";

    event.waitUntil(

      clients
        .matchAll({
          type: "window",
          includeUncontrolled: true
        })
        .then(windowClients => {

          for (const client of windowClients) {

            if ("focus" in client) {
              client.navigate(targetUrl);
              return client.focus();
            }

          }

          if (clients.openWindow) {
            return clients.openWindow(
              targetUrl
            );
          }

        })

    );

  }
);