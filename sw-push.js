self.addEventListener('install', function (event) {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(clients.claim());
});

self.addEventListener('push', function (event) {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {}

  const title = data.title || 'BBW4LIFE';

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
    data: { url: data.url || '/' },
    actions: [
      { action: 'open_cart', title: '🛒 View Cart' },
      { action: 'dismiss',   title: 'Dismiss' }
    ]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  const notification = event.notification;
  const action = event.action;
  const url = (notification.data && notification.data.url) || '/';
  notification.close();

  if (action === 'dismiss') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windowClients) {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if ('focus' in client) {
          client.postMessage({ type: 'OPEN_CART', url: url });
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});