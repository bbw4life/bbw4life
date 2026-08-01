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
  // Toute la logique est protégée par try/catch et le close() est
  // rendu sans risque : si une exception synchrone survenait ici sans
  // protection, event.waitUntil() ne serait jamais appelé et la
  // notification se contenterait de se fermer sans jamais rediriger
  // (exactement le bug rapporté).
  let notification, action, data, targetUrl, hasCart;
  try {
    notification = event.notification;
    action = event.action || '';
    data = notification.data || {};
    targetUrl = data.url || '/';
    hasCart = data.hasCart || false;
    notification.close();
  } catch (err) {
    console.error('[SW] notificationclick: erreur pendant la lecture des données', err);
    return;
  }

  if (action === 'dismiss') return;

  const wantsCart = (action === 'open_cart' || (action === '' && hasCart));

  // IMPORTANT : le "user activation" transitoire accordé par le clic sur la
  // notification n'autorise qu'UN SEUL appel consommateur (focus() OU
  // openWindow()) — enchaîner matchAll() → focus() → postMessage()/navigate()
  // peut faire expirer cette activation avant le bon appel et provoquer
  // "Not allowed to focus a window." silencieusement avalé par le catch,
  // ce qui correspondait exactement au bug rapporté (clic = notification
  // fermée, aucune action). On tente donc focus() en tout premier, sans
  // rien attendre avant, et on retombe sur openWindow() en tout dernier
  // recours si ça échoue.
  event.waitUntil(
    (async function () {
      try {
        const windowClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
        const existingClient = windowClients.find(function (client) {
          return client.url.startsWith(self.location.origin) && 'focus' in client;
        });

        if (existingClient) {
          try {
            const focusedClient = await existingClient.focus();
            if (wantsCart) {
              focusedClient.postMessage({ type: 'OPEN_CART', url: targetUrl });
            } else if ('navigate' in focusedClient) {
              await focusedClient.navigate(targetUrl);
            }
            return;
          } catch (focusErr) {
            console.warn('[SW] notificationclick: focus() a échoué, fallback openWindow', focusErr);
            // On continue vers openWindow ci-dessous plutôt que d'abandonner.
          }
        }

        await clients.openWindow(targetUrl);
      } catch (err) {
        console.error('[SW] notificationclick: échec de la redirection', err);
      }
    })()
  );
});