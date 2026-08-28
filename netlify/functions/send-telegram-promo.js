/* ══════════════════════════════════════════════════════
   TELEGRAM — Notification "Promotion" tous les 6 jours
   Envoyée à chaque client ayant lié son compte BBW4LIFE à
   Telegram. Contient tous les codes promo actifs (settings.promos)
   accompagnés de quelques produits, et un bouton vers la page
   "Tous les produits".
══════════════════════════════════════════════════════ */
process.removeAllListeners('warning');
const {
  BASE_URL,
  getSettings,
  getTelegramSubscribers,
  sendTelegramPhoto,
  sendTelegramMessage
} = require('./_lib/telegram-broadcast');

const ALL_PRODUCTS_URL = `${BASE_URL}/collections/bbw4life-all-product.html`;
const SHOWCASE_COUNT = 3;

function pickRandomProducts(products, count) {
  const pool = [...products];
  const picked = [];
  while (picked.length < count && pool.length) {
    const idx = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked;
}

exports.handler = async () => {
  try {
    const { settings, products } = await getSettings();

    const promos = settings.promos || [];
    if (!promos.length) return { statusCode: 200, body: 'no promos' };

    const subscribers = await getTelegramSubscribers();
    if (!subscribers.length) return { statusCode: 200, body: 'no subscribers' };

    const showcaseProducts = pickRandomProducts(products, SHOWCASE_COUNT);

    const promoLines = promos
      .map(p => `🎁 <b>${p.code}</b> — ${p.percent}% off`)
      .join('\n');

    for (const sub of subscribers) {
      const intro =
        `Hey ${sub.firstName} 💛\n\n` +
        `It's promo time! Here are our current codes just for you:\n\n${promoLines}`;
      await sendTelegramMessage(sub.chatId, intro);

      for (const prod of showcaseProducts) {
        const caption = `<b>${prod.title}</b>\n$${Number(prod.price).toFixed(2)}`;
        await sendTelegramPhoto(sub.chatId, prod.image, caption);
      }

      await sendTelegramMessage(
        sub.chatId,
        `Treat yourself, Queen 👑 Don't let these deals pass you by.`,
        { inline_keyboard: [[{ text: 'Shop All Products', url: ALL_PRODUCTS_URL }]] }
      );
    }

    console.log(`[telegram-promo] Sent to ${subscribers.length} subscriber(s)`);
    return { statusCode: 200, body: 'ok' };
  } catch (e) {
    console.error('[telegram-promo] FAILED:', e.message);
    return { statusCode: 200, body: 'error' };
  }
};
