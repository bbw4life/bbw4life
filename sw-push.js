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
  notification.close();

  if (action === 'dismiss') return;

  const url = (notification.data && notification.data.url) || '/';

  event.waitUntil(
    (async () => {
      const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });

      for (const client of allClients) {
        try {
          const clientOrigin = new URL(client.url).origin;
          const targetOrigin = new URL(url, self.location.origin).origin;
          if (clientOrigin === targetOrigin && 'navigate' in client) {
            const navigatedClient = await client.navigate(url);
            return navigatedClient.focus ? navigatedClient.focus() : client.focus();
          }
        } catch (e) {}
      }

      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })()
  );
});