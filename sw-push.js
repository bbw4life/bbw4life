self.addEventListener('install', function (event) {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(clients.claim());
});

self.addEventListener('push', function (event) {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {}

  const title   = data.title || 'BBW4LIFE';
  const hasCart = data.hasCart === true;

  const actions = hasCart
    ? [
        { action: 'open_cart', title: '🛒 View Cart' },
        { action: 'dismiss',   title: 'Dismiss' }
      ]
    : [
        { action: 'open_url', title: '👑 Shop Now' },
        { action: 'dismiss',  title: 'Dismiss' }
      ];

  const options = {
    body: data.body || 'You have items waiting in your cart 🛍️',
    icon: data.icon || 'https://bbw4life.com/public/bbw4life%20favicon.png',
    badge: data.badge || 'https://bbw4life.com/public/bbw4life%20favicon.png',
    image: data.image || undefined,
    tag: 'bbw4life-cart-reminder',
    renotify: true,
    requireInteraction: false,
    silent: false,
    timestamp: Date.now(),
    vibrate: [100, 50, 100],
    data: { url: data.url || '/', hasCart: hasCart },
    actions: actions
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};
  const targetUrl = data.url || '/';
  const hasCart = data.hasCart || false;

  notification.close();

  if (action === 'dismiss') return;

  const wantsCart = (action === 'open_cart' || (action === '' && hasCart));

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windowClients) {
      // Cherche un onglet déjà ouvert sur le même site
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          return client.focus().then(function (focusedClient) {
            if (wantsCart) {
              focusedClient.postMessage({ type: 'OPEN_CART', url: targetUrl });
            } else if ('navigate' in focusedClient) {
              focusedClient.navigate(targetUrl);
            }
            return focusedClient;
          });
        }
      }
      // Sinon on ouvre une nouvelle fenêtre
      return clients.openWindow(targetUrl).then(function (windowClient) {
        if (wantsCart && windowClient) {
          setTimeout(function () {
            windowClient.postMessage({ type: 'OPEN_CART', url: targetUrl });
          }, 1500);
        }
        return windowClient;
      });
    }).catch(function (err) {
      console.error('[SW] notificationclick failed:', err);
    })
  );
});