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

  // Un seul bouton d'action (pas de "Dismiss") : avec 2+ actions, certains
  // relais de notification natifs (Windows Action Center notamment) ont un
  // historique de bugs d'indexation où le mauvais "action id" est renvoyé
  // au service worker. Un seul bouton, dont l'id correspond à EXACTEMENT
  // la même cible que le clic sur le corps de la notification, élimine
  // toute ambiguïté — voir notificationclick ci-dessous : les deux chemins
  // (bouton et corps) exécutent littéralement la même fonction avec la
  // même cible.
  const actions = hasCart
    ? [{ action: 'open_cart', title: '🛒 View Cart' }]
    : [{ action: 'open_url', title: '👑 Shop Now' }];

  const options = {
    body: data.body || 'You have items waiting in your cart 🛍️',
    icon: data.icon || 'https://bbw4life.com/public/bbw4life-favicon.png',
    badge: data.badge || 'https://bbw4life.com/public/bbw4life-favicon.png',
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
  // (exactement le bug rapporté). Pas de boutons d'action (retirés, peu
  // fiables) : un seul chemin, le clic sur la notification elle-même.
  let notification, data, targetUrl, hasCart, wantsCart;
  try {
    notification = event.notification;
    data = notification.data || {};
    hasCart = data.hasCart || false;
    wantsCart = hasCart;
    // Filet de sécurité : si data.url manque ou est corrompu, retomber sur
    // la vraie page panier pour "View Cart" / la home pour "Shop Now" —
    // plutôt que sur une valeur générique qui pourrait ne mener nulle part.
    targetUrl = data.url || (wantsCart ? '/cart.html' : '/');
    notification.close();
  } catch (err) {
    console.error('[SW] notificationclick: erreur pendant la lecture des données', err);
    return;
  }

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
            // Un seul appel consommateur de l'activation utilisateur
            // transitoire du clic (focus() OU navigate(), jamais les deux
            // en séquence — le second échoue silencieusement sinon, ce qui
            // correspondait exactement au bug "Shop Now ne fait rien").
            // On utilise donc uniquement focus() + postMessage : c'est la
            // page elle-même (script.js) qui décide d'ouvrir le panier ou
            // de naviguer, sans jamais appeler client.navigate() ici.
            const focusedClient = await existingClient.focus();
            if (wantsCart) {
              // postMessage seul ne garantit pas que le panier s'ouvre si la
              // page n'a pas (encore) son listener prêt — on force aussi la
              // query string ?openCart=true en secours : checkOpenCartFromPush()
              // (script.js) la lit indépendamment au chargement/focus de la page.
              focusedClient.postMessage({ type: 'OPEN_CART', url: targetUrl });
            } else {
              focusedClient.postMessage({ type: 'NAVIGATE_TO', url: targetUrl });
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