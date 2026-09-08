// netlify/functions/check-approved-stories.js
// Cron : détecte les stories passées de "pending" à "approved" (édité à la
// main dans la feuille bbw4life-stories, colonne P — story-share.js ne fait
// que LIRE les stories approuvées pour l'affichage, rien ne notifiait le
// client jusqu'ici). Ajoute une colonne R (telegram_notified_at) pour ne
// notifier qu'une seule fois par story — n'affecte pas les colonnes A:Q déjà
// utilisées par saveStory()/fetchStories() dans story-share.js.
process.removeAllListeners('warning');
const { google } = require('googleapis');
const { notifyCustomerTelegram } = require('./_lib/telegram-broadcast');

const SHEET_NAME = 'bbw4life-stories';

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
}

exports.handler = async () => {
  console.log('[check-approved-stories] Starting — ' + new Date().toISOString());
  try {
    const auth   = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.SHEET_ID_BBW4LIFE_ACCOUNTS;

    const res  = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET_NAME}!A:R`
    });
    const rows = res.data.values || [];

    let notified = 0;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const email     = (row[2] || '').trim();
      const status    = (row[15] || '').trim().toLowerCase();
      const notifiedAt = (row[17] || '').trim();

      if (status !== 'approved') continue;
      if (notifiedAt) continue; // déjà notifié
      if (!email || !email.includes('@')) continue;

      const result = await notifyCustomerTelegram(
        email,
        (firstName) =>
          `${firstName}, the wait is over! 🌟\n\n` +
          `<b>Your BBW4LIFE story is live!</b>\n` +
          `Your story just got approved and published on our site — thank you for sharing your journey with the community! 💕\n\n` +
          `Check it out on the site.`
      );

      // Marquer comme notifié qu'il ait été lié à Telegram ou non — sinon
      // cette ligne serait re-scannée à chaque exécution indéfiniment.
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range:            `${SHEET_NAME}!R${i + 1}`,
        valueInputOption: 'RAW',
        resource:         { values: [[new Date().toISOString()]] }
      });

      if (result.sent) {
        notified++;
        console.log(`[check-approved-stories] ✅ Notified ${email}`);
      } else {
        console.log(`[check-approved-stories] ⏭️ ${email} not linked to Telegram, marked as checked`);
      }
    }

    console.log(`[check-approved-stories] Done — notified: ${notified}`);
    return { statusCode: 200, body: JSON.stringify({ success: true, notified }) };

  } catch (error) {
    console.error('[check-approved-stories] ERROR:', error.message);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
  }
};
