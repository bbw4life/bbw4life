/* ══════════════════════════════════════════════════════
   LIVE CHAT — Telegram webhook
   Reçoit chaque message entrant du bot Telegram. Si le texte
   commence par "CHAT-xxxxxx:", c'est une réponse de l'agent
   (PDG Francenel) à un client en live chat :
     - écrit la réponse dans bbw4life-live-chat (sender=agent)
     - passe le statut de la session à "answered" (ou "closed"
       si le message est "CLOSE")
     - envoie une push notification au visiteur (uniquement à
       ce moment précis — jamais avant, cf. demande explicite)

   Configuration (one-shot, après déploiement) :
     https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://bbw4life.com/.netlify/functions/telegram-webhook
══════════════════════════════════════════════════════ */
const webpush = require('web-push');
const { google } = require('googleapis');
const {
  appendLiveChatRow,
  setLiveChatStatus,
  getDeviceIdFor
} = require('./_lib/live-chat-sheet');

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const CHAT_ID_PATTERN = /^(CHAT-[A-Z0-9]+):\s*(.*)$/s;

function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

/* Push_Subscriptions vit dans un spreadsheet différent de celui du live
   chat (cf. send-cart-push-reminder.js) — même logique de lookup ici. */
async function findSubscriptionByDeviceId(deviceId) {
  if (!deviceId) return null;
  const sheets = getSheetsClient();
  const spreadsheetId = process.env.SHEET_ID_BBW4LIFE_PENDING_ORDERS;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Push_Subscriptions!A:D'
  });
  const rows = res.data.values || [];
  const row = rows.find(r => r[0] === deviceId);
  if (!row || !row[1]) return null;
  return { endpoint: row[1], keys: { p256dh: row[2], auth: row[3] } };
}

async function notifyClientPush(deviceId, chatId) {
  try {
    const subscription = await findSubscriptionByDeviceId(deviceId);
    if (!subscription) return;

    const payload = JSON.stringify({
      title: 'BBW4LIFE',
      body: 'Un agent vient de vous répondre en direct 💬',
      icon: `${process.env.BASE_URL || 'https://bbw4life.com'}/public/bbw4life-favicon.png`,
      badge: `${process.env.BASE_URL || 'https://bbw4life.com'}/public/bbw4life-favicon.png`,
      url: `${process.env.BASE_URL || 'https://bbw4life.com'}/?openChat=${chatId}`,
      hasCart: false
    });

    await webpush.sendNotification(subscription, payload);
  } catch (e) {
    console.warn('[live-chat] Push notification failed:', e.message);
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const update = JSON.parse(event.body || '{}');
    const text = (update.message && update.message.text) || '';
    if (!text) return { statusCode: 200, body: 'ok' };

    const match = text.match(CHAT_ID_PATTERN);
    if (!match) {
      // Message Telegram normal, sans préfixe CHAT-xxx: — ignoré (pas une
      // réponse de live chat, ne pas casser d'autres usages du bot).
      return { statusCode: 200, body: 'ok' };
    }

    const chatId = match[1];
    const replyText = match[2].trim();

    if (!replyText) return { statusCode: 200, body: 'ok' };

    if (replyText.toUpperCase() === 'CLOSE') {
      await setLiveChatStatus(chatId, 'closed');
      return { statusCode: 200, body: 'ok' };
    }

    await appendLiveChatRow(chatId, 'agent', replyText, '');
    await setLiveChatStatus(chatId, 'answered');

    const deviceId = await getDeviceIdFor(chatId);
    await notifyClientPush(deviceId, chatId);

    return { statusCode: 200, body: 'ok' };
  } catch (e) {
    console.error('[live-chat] telegram-webhook FAILED:', e.message);
    // Toujours renvoyer 200 à Telegram — sinon Telegram réessaie le même
    // update indéfiniment, ce qui dupliquerait la réponse de l'agent.
    return { statusCode: 200, body: 'ok' };
  }
};
