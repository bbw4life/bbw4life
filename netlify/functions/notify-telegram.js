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

  try {
    const FormData = require('form-data');
    const form = new FormData();

    const media = validPhotos.map((base64, i) => {
      const matches = base64.match(/^data:image\/(\w+);base64,(.+)$/);
      if (!matches) return null;
      const ext    = matches[1] === 'jpeg' ? 'jpg' : matches[1];
      const buffer = Buffer.from(matches[2], 'base64');
      const fieldName = `photo${i}`;
      form.append(fieldName, buffer, { filename: `image${i}.${ext}`, contentType: `image/${matches[1]}` });
      return {
        type: 'photo',
        media: `attach://${fieldName}`,
        ...(i === 0 ? { caption: message, parse_mode: 'HTML' } : {})
      };
    }).filter(Boolean);

    if (!media.length) {
      return notifyTelegram(message);
    }

    form.append('chat_id', process.env.TELEGRAM_CHAT_ID);
    form.append('media', JSON.stringify(media));

    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMediaGroup`, {
      method: 'POST',
      body: form
    });
  } catch (e) {
    console.warn('[Telegram] Photo notification failed, falling back to text:', e.message);
    await notifyTelegram(message);
  }
}

module.exports = { notifyTelegram, notifyTelegramWithPhotos };