async function notifyTelegram(message) {
  try {
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML'
      })
    });
  } catch (e) {
    console.warn('[Telegram] Notification failed:', e.message);
  }
}

async function notifyTelegramWithPhotos(message, photos = []) {
  const validPhotos = (photos || []).filter(p => p && typeof p === 'string' && p.startsWith('data:image'));

  if (!validPhotos.length) {
    return notifyTelegram(message);
  }

  // Envoyer le texte d'abord
  await notifyTelegram(message);

  // Envoyer chaque photo séparément via FormData natif (Node 18+)
  for (let i = 0; i < validPhotos.length; i++) {
    try {
      const base64 = validPhotos[i];
      const matches = base64.match(/^data:image\/(\w+);base64,(.+)$/);
      if (!matches) continue;

      const mimeType = `image/${matches[1]}`;
      const buffer   = Buffer.from(matches[2], 'base64');
      const blob     = new Blob([buffer], { type: mimeType });

      const form = new FormData();
      form.append('chat_id', process.env.TELEGRAM_CHAT_ID);
      form.append('photo', blob, `photo${i}.jpg`);

      const res = await fetch(
        `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendPhoto`,
        { method: 'POST', body: form }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        console.warn(`[Telegram] sendPhoto ${i} failed:`, JSON.stringify(data));
      }

    } catch (e) {
      console.warn(`[Telegram] sendPhoto ${i} error:`, e.message);
    }
  }
}

module.exports = { notifyTelegram, notifyTelegramWithPhotos };