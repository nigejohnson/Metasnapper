// NB the service worker will re-install if it has changed in any way!
// Therefore, the important thing is not the cache name itslef but the fact it has changed!
// Plus, giving the cache a new name, is a sensible way to avoid any confusion with an out of date cache.
// Also note that, by default, the new service worker will install but remain inactive until any
// pages using an old version of the service worker have been unloaded.
const cacheName = 'cache-v1.0.2'; // Change this whenever the version of the app changes, or NO changes will be recached!
const precacheResources = [
  '/',
  'index.html',
  'styles/main.css',
  'showsnaps.html',
  'config.html',
  'offline.html',
  'js/idb.js',
  'js/main.js'
];

// NB a service worker has no access to the window scope, hence 'self'
self.addEventListener('install', event => {
  console.log('Service worker install event!');
  // Don't finish installing until the caches of the cached resources has been repopulated with the new pages, css and scripts
  event.waitUntil(
    caches.open(cacheName)
      .then(cache => {
        return cache.addAll(precacheResources);
      })
  );
});

self.addEventListener('activate', event => {
  console.log('Service worker activate event!');
});

self.addEventListener('fetch', event => {
  console.log('Fetch intercepted for:', event.request.url);
  /*  if (event.request.method == 'POST')
  {
    return fetch(event.request);
  } */
  event.respondWith(caches.match(event.request)
    .then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request);
    }).catch(error => {
      console.log('Error, ', error);
      return caches.match('offline.html');
    }));
});
