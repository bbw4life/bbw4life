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
const START_PATTERN = /^\/start(?:\s+(.*))?$/s;
const BASE_URL = process.env.BASE_URL || 'https://bbw4life.com';

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

async function sendTelegramMessage(chatId, text, replyMarkup) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) { console.warn('[telegram-webhook] TELEGRAM_BOT_TOKEN missing'); return; }
  const payload = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true
  };
  if (replyMarkup) payload.reply_markup = replyMarkup;
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    console.warn('[telegram-webhook] sendMessage failed:', res.status, await res.text().catch(() => ''));
  }
}

function decodeAccountPayload(payload) {
  try {
    let b64 = payload.slice('acct_'.length).replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const email = Buffer.from(b64, 'base64').toString('utf8').trim();
    return email.includes('@') ? email : null;
  } catch (e) {
    return null;
  }
}

async function handleStart(telegramChatId, payload) {
  if (payload && payload.startsWith('acct_')) {
    const email = decodeAccountPayload(payload);
    if (!email) {
      await sendTelegramMessage(telegramChatId, "Sorry, that link seems invalid. Please try the “Add me on Telegram” button again from the BBW4LIFE menu.");
      return;
    }
    try {
      const res = await fetch(`${BASE_URL}/.netlify/functions/save-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'link_telegram', email, telegramChatId: String(telegramChatId) })
      });
      const data = await res.json().catch(() => ({}));
      if (data && data.success) {
        await sendTelegramMessage(telegramChatId, "✅ You're all set! Your BBW4LIFE account is now linked to Telegram — order confirmations, tracking numbers, new arrivals and exclusive promos will be sent here.");
      } else {
        await sendTelegramMessage(telegramChatId, "We couldn't find a BBW4LIFE account for you just yet. Please make sure you're logged in on the site, then try the button again.");
      }
    } catch (e) {
      console.error('[telegram-webhook] link_telegram failed:', e.message);
      await sendTelegramMessage(telegramChatId, "Something went wrong linking your account. Please try again in a moment.");
    }
    return;
  }

  // payload === 'new' (ou tout autre cas non reconnu) — le client n'a pas
  // encore de compte BBW4LIFE, on lui propose de le créer via un formulaire
  // ouvert en Web App directement dans Telegram (pas de redirection externe).
  const signupUrl = `${BASE_URL}/telegram-signup.html?chat_id=${telegramChatId}`;
  await sendTelegramMessage(
    telegramChatId,
    "Welcome to BBW4LIFE! 💛\n\nYou don't have a BBW4LIFE account linked yet, so we can't send you order confirmations, tracking numbers, new arrivals or promo codes here.\n\nTap the button below to create your account in a few seconds — right here in Telegram.",
    {
      inline_keyboard: [[
        { text: 'Create my BBW4LIFE account', web_app: { url: signupUrl } }
      ]]
    }
  );
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const update = JSON.parse(event.body || '{}');
    const text = (update.message && update.message.text) || '';
    const telegramChatId = update.message && update.message.chat && update.message.chat.id;
    if (!text) return { statusCode: 200, body: 'ok' };

    const startMatch = text.match(START_PATTERN);
    if (startMatch && telegramChatId) {
      await handleStart(telegramChatId, (startMatch[1] || '').trim());
      return { statusCode: 200, body: 'ok' };
    }

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
