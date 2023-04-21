// NB the service worker will re-install if it has changed in any way!
// Therefore, the important thing is not the cache name itself but the fact it has changed!
// Plus, giving the cache a new name, is a sensible way to avoid any confusion with an out of date cache.
// Also note that, by default, the new service worker will install but remain inactive until any
// pages using an old version of the service worker have been unloaded.
const cacheName = 'cache-v1.2.128'; // Change this whenever the version of the app changes, or NO changes will be recached!
const precacheResources = [
  '/',
  'index.html',
  'styles/main.css',
  'showsnapsfragment.html',
  'configfragment.html',
  'applogfragment.html',
  'offline.html',
  'js/lib/idb.js',
  'js/lib/piexif.js',
  'js/lib/vue.global.prod.js',
  'js/lib/vue-router.global.prod.js',
  'js/main.js',
  'js/index.js',
  'js/applog.js',
  'js/config.js',
  'js/showsnaps.js',
  'manifest.json',
  'favicon.ico',
  'images/touch/icon-128x128.png',
  'images/touch/icon-192x192.png',
  'images/touch/icon-256x256.png',
  'images/touch/icon-384x384.png',
  'images/touch/icon-512x512.png'
];

// NB a service worker has no access to the window scope, hence 'self'
self.addEventListener('install', event => {
  console.log('Service worker install event!');
  // Don't finish installing until the caches of the cached resources has been repopulated with the new pages, css and scripts

  event.waitUntil(
    /* caches.open(cacheName) Not using cache.addAll as we need to ensure we bypass the browser cache
      .then(cache => { Why bypassing the browser cache isn't the default behaviour of cache.addAll is beyond me!
        return cache.addAll(precacheResources);
      }) */
    /* IMPORTANT the skipWaiting here, and the clients.claim in the activate event, are both
      needed to ensure that the service worker starts to intercept fetches for/control all app resources immediately.
      Without those two methods the default PWA design assumption is that the resources initially picked
      up when a user opens the app (which won't have been fetched by a service worker because then the service worker
      won't as yet even have been registered) are out of date, and should therefore carry on being controlled by
      any already running service workers until the user does their first page refresh or navigate.
      That assumption essentially forces the user to ALWAYS refresh the app after a new install on a Single Page
      style app (SPA) as there aren't any navigations, and so the service worker won't start fetching resources
      from the application cache until the user refreshes, meaning the SPA can't work properly offline until the
      user refreshes (so links don't do anything and appear broken, with errors logged about refused or unavailable
      connections because the given resources aren't yet available offline), which is horrid!
      (Especially as you are likely to be forced to adopt an SPA pattern for a variety of reasons, such as fairly long
        lasting indexeddb or other offline cache associated javascript processes that run asynchronously but
        will be terminated by a real page transition!)
      */
    self.skipWaiting().then(function () {
      self.caches.open(cacheName).then(function (cache) {
        var cachePromises = precacheResources.map(function (precacheResource) {
          // This constructs a new URL object using the service worker's script location as the base
          // for relative URLs.
          var url = new URL(precacheResource, self.location.href);

          // The cache: no-store header here is key
          // It means we are fetching resouces into the application cache bypassing the browser's own http cache.
          // If we don't do this then, in aggressively caching browsers such as Chrome, the
          // service worker will normally re-cache out of date content from the browser cache.
          return self.fetch(url, { cache: 'no-store' }).then(function (response) {
            if (response.status >= 400) {
              throw new Error('request for ' + precacheResource +
                ' failed with status ' + response.statusText);
            }

            return cache.put(precacheResource, response);
          }).catch(function (error) {
            console.error('Not caching ' + precacheResource + ' due to ' + error);
          }); // End of fetch for a resource
        }); // End of calling a function for each entry in a map created from the precacheResources array
        return Promise.all(cachePromises).then(function () {
          console.log('Pre-fetching complete.');
        });
      }).catch(function (error) {
        console.error('Pre-fetching failed:', error);
      }); // end of the caches.open
    }) // end of the promise chain that starts with skipWaiting
  ); // End of the wait until
}); // End of the addEventListener call

self.addEventListener('activate', event => {
  self.clients.claim(); // This is needed, along with the skipWaiting in the install event (see comment there) to make the service worker intercept fetches immediately.
  console.log('Service worker activate event!');
});

self.addEventListener('fetch', event => {
  console.log('Fetch intercepted for:', event.request.url);

  // Fetch from the specific named cache to avoid any risk of retrieving old content from an old cache
  event.respondWith(self.caches.open(cacheName).then(
    function (cache) {
      return cache.match(event.request)
        .then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return self.fetch(event.request);
        }).catch(error => {
          console.log('Error, ', error);
          return cache.match('offline.html');
        }); // end catch
    }) // end of the matching/fetching function
  ); // end of the respondswith
}); // end addEventListener
