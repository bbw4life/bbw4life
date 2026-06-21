process.removeAllListeners('warning');
const { google } = require('googleapis');
const { notifyTelegram } = require('./notify-telegram');

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

function formatDate() {
  const d = new Date();
  return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear().toString().slice(-2)}`;
}

// ── SAVE ──────────────────────────────────────────────────────────────
async function saveStory(body) {
  const {
    firstName, age, email, country,
    bodyPressureDuration, bbwHelped, discoveredWhen,
    selfChange, wordToday, toldBefore,
    story, mentalQuote, rating, photo, anonymous
  } = body;

  if (!firstName || !email || !bodyPressureDuration || !bbwHelped || !story || !selfChange) {
    throw new Error('Required fields missing');
  }

  const auth   = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const values = [[
    firstName.trim(),
    age                  || '',
    email.trim().toLowerCase(),
    country              || '',
    bodyPressureDuration || '',
    bbwHelped            || '',
    discoveredWhen       || '',
    selfChange           || '',
    wordToday            || '',
    toldBefore           || '',
    story.trim(),
    mentalQuote          || '',
    rating               || '5',
    photo                || '',
    anonymous === true || anonymous === 'true' ? 'yes' : 'no',
    'pending',
    formatDate()
  ]];

  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.SHEET_ID_BBW4LIFE_ACCOUNTS,
    range:           `${SHEET_NAME}!A:Q`,
    valueInputOption:'RAW',
    insertDataOption:'INSERT_ROWS',
    resource: { values }
  });

  await notifyTelegram(
    `💕 <b>Waww Pdg Francenel, une personne vient de partager son story, c'est en attente!</b>\n\n` +
    `👤 <b>Prénom:</b> ${firstName}\n` +
    `📧 <b>Email:</b> ${email}\n` +
    `🌍 <b>Pays:</b> ${country || 'N/A'}\n` +
    `⭐ <b>Note:</b> ${rating || '5'}/5`
  );
  return { success: true };
}

// ── FETCH approved stories ─────────────────────────────────────────────
async function fetchStories() {
  const auth   = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SHEET_ID_BBW4LIFE_ACCOUNTS,
    range:         `${SHEET_NAME}!A:Q`
  });

  const rows = res.data.values || [];
  const stories = rows
    .slice(1)
    .filter(r => r[15] && r[15].toString().toLowerCase() === 'approved')
    .map(r => ({
      firstName:           r[14] && r[14].toString().toLowerCase() === 'yes' ? 'Anonymous' : (r[0] || 'Anonymous'),
      age:                 r[1]  || '',
      country:             r[3]  || '',
      bodyPressureDuration:r[4]  || '',
      bbwHelped:           r[5]  || '',
      discoveredWhen:      r[6]  || '',
      selfChange:          r[7]  || '',
      wordToday:           r[8]  || '',
      toldBefore:          r[9]  || '',
      story:               r[10] || '',
      mentalQuote:         r[11] || '',
      rating:              r[12] || '5',
      photo:               r[13] || '',
      date:                r[16] || ''
    }));

  return { success: true, stories };
}

// ── HANDLER ───────────────────────────────────────────────────────────
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const data = await saveStory(body);
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }

    if (event.httpMethod === 'GET') {
      const data = await fetchStories();
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };

  } catch (err) {
    console.error('STORY-SHARE ERROR:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: err.message }) };
  }
};