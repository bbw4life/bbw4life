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

  // ── Actions dynamiques selon le type de notification ──
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

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function (windowClients) {
        let target = null;
        for (let i = 0; i < windowClients.length; i++) {
          const c = windowClients[i];
          if (c.url && c.url.indexOf(self.location.origin) === 0) {
            target = c;
            break;
          }
        }

        if (target) {
          if (wantsCart) {
            // Onglet déjà ouvert → juste ouvrir le drawer, pas besoin de navigation
            target.postMessage({ type: 'OPEN_CART', url: targetUrl });
            return target.focus();
          }
          // "Shop Now" ou clic sur le corps (hors panier) → navigue réellement l'onglet
          if ('navigate' in target) {
            return target.navigate(targetUrl)
              .then(function (navigated) {
                return navigated ? navigated.focus() : target.focus();
              })
              .catch(function () {
                return clients.openWindow(targetUrl);
              });
          }
          return clients.openWindow(targetUrl);
        }

        // Aucun onglet ouvert → nouvelle fenêtre directement sur l'URL cible
        return clients.openWindow(targetUrl);
      })
      .catch(function (err) {
        console.error('[SW] notificationclick failed, forcing openWindow:', err);
        return clients.openWindow(targetUrl);
      })
  );
});