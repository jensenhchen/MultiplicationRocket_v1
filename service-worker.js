const CACHE_NAME = "multiplication-rocket-v1.2.0";
const BASE_URL = self.registration.scope;

const REQUIRED_ASSETS = [
  "./",
  "./index.html",
  "./offline.html",
  "./404.html",
  "./manifest.json",
  "./css/style.css",
  "./css/responsive.css",
  "./css/animations.css",
  "./js/utils.js",
  "./js/storage.js",
  "./js/questions.js",
  "./js/audio.js",
  "./js/animation.js",
  "./js/ui.js",
  "./js/game.js",
  "./js/app.js",
  "./assets/images/rocket.svg",
  "./assets/images/smoke.svg",
  "./assets/images/stars.svg",
  "./assets/images/clouds.svg",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/apple-touch-icon.png",
  "./assets/icons/favicon.png"
];

const OPTIONAL_ASSETS = [
  "./assets/images/",
  "./assets/sounds/"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cacheAssets(cache, [...REQUIRED_ASSETS, ...OPTIONAL_ASSETS]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (event.request.mode === "navigate" || acceptsHtml(event.request)) {
    event.respondWith(networkFirstHtml(event.request));
    return;
  }

  event.respondWith(cacheFirst(event.request));
});

function cacheAssets(cache, paths) {
  const urls = paths.map((path) => new URL(path, BASE_URL).toString());

  return Promise.allSettled(
    urls.map((url) => fetch(url, { cache: "no-cache" })
      .then((response) => {
        if (!response.ok) throw new Error(`Could not cache ${url}`);
        return cache.put(url, response);
      }))
  );
}

function acceptsHtml(request) {
  const acceptHeader = request.headers.get("accept");
  return Boolean(acceptHeader && acceptHeader.includes("text/html"));
}

async function networkFirstHtml(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cachedPage = await cache.match(request);
    const appShell = await cache.match(new URL("./index.html", BASE_URL).toString());
    const offlinePage = await cache.match(new URL("./offline.html", BASE_URL).toString());
    return cachedPage || appShell || offlinePage;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return cache.match(new URL("./offline.html", BASE_URL).toString());
  }
}
