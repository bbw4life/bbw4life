self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'BBW4LIFE';
  const options = {
    body: data.body || '',
    icon: data.icon || '/vrlogo-bbw4life.png',
    badge: data.badge || '/vrlogo-bbw4life.png',
    image: data.icon || '/vrlogo-bbw4life.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : '/';
  event.waitUntil(clients.openWindow(url));
});