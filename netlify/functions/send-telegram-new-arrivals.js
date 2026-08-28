/* ══════════════════════════════════════════════════════
   TELEGRAM — Notification "New Arrivals" tous les 3 jours
   Envoyée à chaque client ayant lié son compte BBW4LIFE à
   Telegram (colonne AK, cf. _lib/telegram-broadcast.js).

   Fait tourner un curseur sur la collection "bbw4life-new-arrivals" :
   3 produits par envoi, on avance de 3 à chaque exécution, et on
   reboucle sur le début une fois la collection épuisée.
══════════════════════════════════════════════════════ */
process.removeAllListeners('warning');
const {
  BASE_URL,
  getSettings,
  getTelegramSubscribers,
  getNextNewArrivalsBatch,
  sendTelegramPhoto,
  sendTelegramMessage
} = require('./_lib/telegram-broadcast');

const NEW_ARRIVALS_COLLECTION_ID = 'bbw4life-new-arrivals';
const NEW_ARRIVALS_URL = `${BASE_URL}/collections/bbw4life-new-arrivals.html`;

function pickPromo(settings) {
  const promos = settings.promos || [];
  if (!promos.length) return null;
  return promos[Math.floor(Math.random() * promos.length)];
}

exports.handler = async () => {
  try {
    const { settings, products } = await getSettings();

    const collections = (settings.jrgq_collections && settings.jrgq_collections.collections) || [];
    const collection = collections.find(c => c.id === NEW_ARRIVALS_COLLECTION_ID);
    if (!collection) {
      console.warn('[telegram-new-arrivals] Collection not found:', NEW_ARRIVALS_COLLECTION_ID);
      return { statusCode: 200, body: 'no collection' };
    }

    const productIds = (collection.product_ids || []).filter(id => !id.startsWith('--'));
    if (!productIds.length) return { statusCode: 200, body: 'no products' };

    const batchIds = await getNextNewArrivalsBatch(productIds, 3);
    const batchProducts = batchIds
      .map(id => products.find(p => p.id === id))
      .filter(Boolean);

    if (!batchProducts.length) return { statusCode: 200, body: 'no matching products' };

    const subscribers = await getTelegramSubscribers();
    if (!subscribers.length) return { statusCode: 200, body: 'no subscribers' };

    const promo = pickPromo(settings);

    for (const sub of subscribers) {
      const intro =
        `Hey ${sub.firstName} 💛\n\n` +
        `We just dropped fresh new pieces for our plus size Queens and Kings — ` +
        `quality, comfort and style made for you.`;
      await sendTelegramMessage(sub.chatId, intro);

      for (const prod of batchProducts) {
        const caption =
          `<b>${prod.title}</b>\n$${Number(prod.price).toFixed(2)}`;
        await sendTelegramPhoto(sub.chatId, prod.image, caption);
      }

      const promoLine = promo
        ? `\n\n🎁 Use code <b>${promo.code}</b> for ${promo.percent}% off your order.`
        : '';
      await sendTelegramMessage(
        sub.chatId,
        `Don't miss out on what's new.${promoLine}`,
        { inline_keyboard: [[{ text: 'See New Collection', url: NEW_ARRIVALS_URL }]] }
      );
    }

    console.log(`[telegram-new-arrivals] Sent to ${subscribers.length} subscriber(s), batch: ${batchIds.join(', ')}`);
    return { statusCode: 200, body: 'ok' };
  } catch (e) {
    console.error('[telegram-new-arrivals] FAILED:', e.message);
    return { statusCode: 200, body: 'error' };
  }
};
