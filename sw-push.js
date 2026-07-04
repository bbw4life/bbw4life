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
  const targetUrl = (notification.data && notification.data.url) || '/';
  const hasCart   = (notification.data && notification.data.hasCart) || false;

  notification.close();

  if (action === 'dismiss') return;

  const wantsCart = (action === 'open_cart' || (action === '' && hasCart));
  const finalUrl = wantsCart ? targetUrl : targetUrl;

  event.waitUntil(
    clients.openWindow(finalUrl)
      .then(function (windowClient) {
        // Une fois la fenêtre ouverte, on peut envoyer le message
        // pour ouvrir le drawer panier si nécessaire.
        if (wantsCart && windowClient) {
          // Petit délai pour laisser la page charger le script.js
          // qui écoute ce message.
          setTimeout(function () {
            windowClient.postMessage({ type: 'OPEN_CART', url: finalUrl });
          }, 1500);
        }
        return windowClient;
      })
      .catch(function (err) {
        console.error('[SW] openWindow failed:', err);
      })
  );
});