// netlify/functions/send-email-auto.js
process.removeAllListeners('warning');

const { Resend } = require('resend');
const { google } = require('googleapis');
const crypto = require('crypto');

// ════════════════════════════════════════════════════════════════
//  ENVIRONMENT
// ════════════════════════════════════════════════════════════════
const BASE_URL   = process.env.BASE_URL   || 'https://bbw4life.com';
const FROM_EMAIL = process.env.FROM_EMAIL || 'BBW4LIFE <bbw4life@bbw4life.com>';

// ════════════════════════════════════════════════════════════════
//  EMAIL TYPE CONSTANTS
// ════════════════════════════════════════════════════════════════
const T = {
  WELCOME:            'welcome',
  ORDER_CONFIRM:      'order_confirm',
  ORDER_TRACKING:     'order_tracking',
  NEWSLETTER_1:       'newsletter_1',
  NEWSLETTER_2:       'newsletter_2',
  NEWSLETTER_3:       'newsletter_3',
  NEWSLETTER_4_BUYER: 'newsletter_4_buyer',
  NEWSLETTER_4_NEW:   'newsletter_4_new',
  CONTACT_REPLY:      'contact_reply',
  PLAN_REQUEST:       'plan_request',
  CUSTOM_PRODUCT:     'custom_product',
  CART_ABANDONED:     'cart_abandoned',
};

// ════════════════════════════════════════════════════════════════
//  GROQ AI — MODELS & HELPERS
// ════════════════════════════════════════════════════════════════
const GROQ_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-70b-versatile',
  'mixtral-8x7b-32768',
  'gemma2-9b-it',
  'llama3-70b-8192',
  'llama3-8b-8192',
  'llama-3.1-8b-instant',
];
let modelIdx = 0;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const BBW_SYSTEM_PROMPT = `You are the senior email copywriter for BBW4LIFE — a premium plus-size fashion and lifestyle brand built for curvy women with the tagline "Beauty Has No Sizes".

BRAND VOICE:
- Warm, empowering, deeply human — like a best friend who genuinely believes in every woman
- Celebrates real bodies, real beauty, real confidence
- Never condescending, never generic, never robotic
- Confident, aspirational, inclusive without being pushy

WRITING RULES:
1. Write ONLY the requested content — no subject lines unless asked
2. NO bullet points, NO markdown, NO asterisks, NO hashtags
3. Maximum 3 sentences per paragraph
4. Every sentence must feel intentional — no filler phrases
5. NEVER use: "embark on", "unleash", "game-changer", "journey to success"
6. ALWAYS use: conversational contractions (you're, we're, it's), emotional truth
7. Output: Plain text only. Separate paragraphs with a blank line.
8. ALWAYS reflect: Beauty Has No Sizes — every woman deserves to feel beautiful`;

async function callGroq(userPrompt) {
  for (let attempt = 0; attempt < GROQ_MODELS.length; attempt++) {
    const idx   = (modelIdx + attempt) % GROQ_MODELS.length;
    const model = GROQ_MODELS[idx];
    for (let retry = 1; retry <= 2; retry++) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method:  'POST',
          headers: {
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type':  'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: BBW_SYSTEM_PROMPT },
              { role: 'user',   content: userPrompt },
            ],
            max_tokens:  500,
            temperature: 0.70,
            top_p:       0.92,
          }),
        });
        if (res.status === 429) {
          if (retry < 2) { await sleep(1800); continue; }
          modelIdx = (idx + 1) % GROQ_MODELS.length;
          break;
        }
        if (!res.ok) { console.warn(`[Groq] HTTP ${res.status} on ${model}`); break; }
        const data    = await res.json();
        const content = data.choices?.[0]?.message?.content?.trim() || '';
        if (content.length < 20) break;
        modelIdx = idx;
        return content;
      } catch (e) {
        console.warn(`[Groq] Error on ${model} retry ${retry}:`, e.message);
        if (retry < 2) { await sleep(900); continue; }
        break;
      }
    }
  }
  return null;
}

// ════════════════════════════════════════════════════════════════
//  SETTINGS LOADER
// ════════════════════════════════════════════════════════════════
let _cachedSettings = null;

async function loadSettings() {
  if (_cachedSettings) return _cachedSettings;
  try {
    const res  = await fetch(`${BASE_URL}/products.data.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const arr  = Array.isArray(data) ? data : [];
    _cachedSettings = arr.find(p => p.type === 'settings') || {};
    return _cachedSettings;
  } catch (e) {
    console.warn('[Settings] Failed to load:', e.message);
    return {};
  }
}

// ════════════════════════════════════════════════════════════════
//  GOOGLE SHEETS HELPERS
// ════════════════════════════════════════════════════════════════
function getSheets() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key:  (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

async function sheetRead(sheets, spreadsheetId, range) {
  if (!spreadsheetId) return [];
  try {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    return res.data.values || [];
  } catch (e) {
    console.warn(`[Sheets] Read failed (${range}):`, e.message);
    return [];
  }
}

async function sheetAppend(sheets, spreadsheetId, range, values) {
  if (!spreadsheetId) return;
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId, range,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: { values: [values] },
    });
  } catch (e) {
    console.warn(`[Sheets] Append failed (${range}):`, e.message);
  }
}

// ── Email Log — anti-duplicate ────────────────────────────────
const EMAIL_LOG_SHEET = 'bbw4life-email-log';

async function loadEmailLog(sheets) {
  const rows = await sheetRead(sheets, process.env.SHEET_ID_BBW4LIFE_ACCOUNTS, `${EMAIL_LOG_SHEET}!A:C`);
  const set  = new Set();
  rows.forEach(r => { if (r[0] && r[1]) set.add(`${r[0].toLowerCase()}||${r[1]}`); });
  console.log(`[EmailLog] ${set.size} sent records loaded`);
  return set;
}

async function markEmailSent(sheets, email, type) {
  await sheetAppend(
    sheets,
    process.env.SHEET_ID_BBW4LIFE_ACCOUNTS,
    `${EMAIL_LOG_SHEET}!A:C`,
    [email.toLowerCase(), type, new Date().toISOString().slice(0, 10)]
  );
}

function wasEmailSent(log, email, type) {
  return log.has(`${email.toLowerCase()}||${type}`);
}

// ════════════════════════════════════════════════════════════════
//  RESEND DELIVERY
// ════════════════════════════════════════════════════════════════
async function deliver(to, subject, html) {
  if (!process.env.RESEND_API_KEY) {
    console.error('[Resend] Missing RESEND_API_KEY');
    return false;
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  try {
    const { data, error } = await resend.emails.send({
      from:    FROM_EMAIL,
      to:      [to],
      subject,
      html,
    });
    if (error) { console.error(`[Resend] ✗ ${to}:`, JSON.stringify(error)); return false; }
    console.log(`[Resend] ✓ Sent to ${to} | ID: ${data?.id}`);
    return true;
  } catch (e) {
    console.error(`[Resend] ✗ ${to}:`, e.message);
    return false;
  }
}

// ════════════════════════════════════════════════════════════════
//  EPROLO — TRACKING CHECKER
// ════════════════════════════════════════════════════════════════
function buildEproloSign() {
  const apiKey    = process.env.EPROLO_API_KEY;
  const apiSecret = process.env.EPROLO_API_SECRET;
  const timestamp = Date.now();
  const sign      = crypto.createHash('md5').update(apiKey + timestamp + apiSecret).digest('hex');
  return { apiKey, timestamp, sign };
}

async function getEproloOrderTracking(internalOrderId) {
  try {
    const { apiKey, timestamp, sign } = buildEproloSign();
    const url = `https://openapi.eprolo.com/order_list.html?sign=${sign}&timestamp=${timestamp}&order_id=${encodeURIComponent(internalOrderId)}&status=0&page_size=1`;
    const res  = await fetch(url, { method: 'GET', headers: { 'apiKey': apiKey } });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { return null; }
    if (data.code !== '0' && data.code !== 0) return null;
    const list  = (data.data && data.data.list) || [];
    const order = list[0];
    if (!order) return null;
    const logistics = (order.logistics || [])[0];
    if (!logistics || !logistics.tracking_number) return null;
    return {
      trackingNumber: logistics.tracking_number,
      carrier:        logistics.tracking_company || null,
      trackingUrl:    logistics.tracking_url     || null
    };
  } catch (e) {
    console.warn('[EPROLO Tracking] Error:', e.message);
    return null;
  }
}

// ════════════════════════════════════════════════════════════════
//  TRACKING SCHEDULER — cron toutes les 12h
// ════════════════════════════════════════════════════════════════
async function runTrackingChecker(sheets, settings) {
  console.log('[Tracking] Starting tracking check...');
  const rows = await sheetRead(
    sheets,
    process.env.SHEET_ID_BBW4LIFE_PENDING_ORDERS,
    'bbw4life-pending-orders!A:S'
  );
  if (rows.length <= 1) { console.log('[Tracking] No orders found'); return { checked: 0, found: 0 }; }

  const now       = new Date();
  let checked     = 0;
  let found       = 0;
  const processed = new Set();

  for (let i = 1; i < rows.length; i++) {
    const row             = rows[i];
    const internalOrderId = row[0]  || '';
    const paymentId       = row[2]  || '';
    const fullName        = row[3]  || '';
    const email           = row[4]  || '';
    const status          = (row[14] || '').toLowerCase();
    const orderDateStr    = row[16] || '';
    const trackingCol     = row[18] || '';

    if (trackingCol)                   continue;
    if (status !== 'successful')       continue;
    if (!email || !email.includes('@')) continue;
    if (processed.has(paymentId))      continue;

    if (orderDateStr) {
      const orderDate    = new Date(orderDateStr);
      const hoursElapsed = (now - orderDate) / (1000 * 60 * 60);
      if (hoursElapsed < 24) continue;
    }

    checked++;
    processed.add(paymentId);

    const result = await getEproloOrderTracking(internalOrderId);

    if (result && result.trackingNumber) {
      found++;
      try {
        await sheets.spreadsheets.values.update({
          spreadsheetId:    process.env.SHEET_ID_BBW4LIFE_PENDING_ORDERS,
          range:            `bbw4life-pending-orders!S${i + 1}`,
          valueInputOption: 'RAW',
          resource:         { values: [[result.trackingNumber]] }
        });
      } catch (e) { console.warn('[Tracking] Failed to save tracking:', e.message); }

      const nameParts = fullName.split(' ');
      const firstName = nameParts[0] || '';
      const lastName  = nameParts.slice(1).join(' ') || '';

      await trySendDirect(email, T.ORDER_TRACKING, async () => {
        return await composeOrderTracking({
          firstName,
          lastName,
          orderId:        internalOrderId,
          trackingNumber: result.trackingNumber,
          carrier:        result.carrier || '',
          trackingUrl:    result.trackingUrl || ''
        }, settings);
      });

      try {
        await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            chat_id:    process.env.TELEGRAM_CHAT_ID,
            text:       `📦 <b>Tracking trouvé!</b>\n\n👤 <b>Client:</b> ${fullName}\n📧 <b>Email:</b> ${email}\n🔢 <b>Tracking:</b> ${result.trackingNumber}\n🚚 <b>Carrier:</b> ${result.carrier || 'N/A'}`,
            parse_mode: 'HTML'
          })
        });
      } catch (e) { console.warn('[Tracking] Telegram notify failed:', e.message); }
    }

    await sleep(800);
  }

  console.log(`[Tracking] Done — checked: ${checked} | found: ${found}`);
  return { checked, found };
}

async function trySendDirect(email, type, composeFn) {
  if (!email || !email.includes('@')) return false;
  try {
    const { subject, html } = await composeFn();
    return await deliver(email, subject, html);
  } catch (e) {
    console.error(`[trySendDirect] Error ${email}/${type}:`, e.message);
    return false;
  }
}

// ════════════════════════════════════════════════════════════════
//  BRAND COLORS
// ════════════════════════════════════════════════════════════════
const BBW = {
  rose:      '#c0385e',
  rose2:     '#e8245a',
  gold:      '#c9963e',
  goldL:     '#e8bc6a',
  plum:      '#7b3f6e',
  dark:      '#0d0d0d',
  dark2:     '#1a0812',
  white:     '#ffffff',
  offWhite:  '#fdf8f3',
  textDark:  '#1a1618',
  textMid:   '#42383e',
  textLight: '#9e8e96',
};

const BASE_CSS = `
  body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
  table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}
  img{-ms-interpolation-mode:bicubic;border:0;height:auto;line-height:100%;outline:none;text-decoration:none}
  body{margin:0!important;padding:0!important;background-color:#f9f0f5}
  a{color:inherit}
  @media only screen and (max-width:620px){
    .ew{width:100%!important;border-radius:0!important}
    .ep{padding:24px 16px!important}
    .eh1{font-size:24px!important}
    .egrid td{display:block!important;width:100%!important;padding:0 0 12px!important}
    .hide-mobile{display:none!important}
  }
`;

// ════════════════════════════════════════════════════════════════
//  SVG SOCIAL ICONS
// ════════════════════════════════════════════════════════════════
const SOCIAL_SVGS = {
  facebook: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 509.64" width="28" height="28"><rect fill="#0866FF" width="512" height="509.64" rx="115.612" ry="115.612"/><path fill="#fff" d="M287.015 509.64h-92.858V332.805h-52.79v-78.229h52.79v-33.709c0-87.134 39.432-127.522 124.977-127.522 16.217 0 44.203 3.181 55.651 6.361v70.915c-6.043-.636-16.536-.953-29.576-.953-41.976 0-58.194 15.9-58.194 57.241v27.667h83.618l-14.365 78.229h-69.253V509.64z"/></svg>`,
  instagram: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="28" height="28"><defs><radialGradient id="ig" cx="30%" cy="107%" r="150%"><stop offset="0%" stop-color="#fdf497"/><stop offset="5%" stop-color="#fdf497"/><stop offset="45%" stop-color="#fd5949"/><stop offset="60%" stop-color="#d6249f"/><stop offset="90%" stop-color="#285AEB"/></radialGradient></defs><rect width="512" height="512" rx="115" fill="url(#ig)"/><path fill="#fff" fill-rule="nonzero" d="M170.663 256.157c-.083-47.121 38.055-85.4 85.167-85.482 47.121-.092 85.407 38.029 85.499 85.159.091 47.13-38.047 85.4-85.176 85.492-47.112.09-85.399-38.039-85.49-85.169zm-46.108.092c.141 72.602 59.106 131.327 131.69 131.185 72.592-.14 131.35-59.089 131.209-131.691-.141-72.577-59.114-131.336-131.715-131.194-72.585.141-131.325 59.114-131.184 131.7zm237.104-137.092c.033 16.954 13.817 30.682 30.772 30.649 16.961-.034 30.689-13.811 30.664-30.765-.033-16.954-13.818-30.69-30.78-30.656-16.962.033-30.689 13.818-30.656 30.772zm-208.696 345.4c-24.958-1.086-38.511-5.234-47.543-8.709-11.961-4.628-20.496-10.177-29.479-19.093-8.966-8.951-14.532-17.461-19.202-29.397-3.508-9.033-7.73-22.569-8.9-47.527-1.269-26.983-1.559-35.078-1.683-103.433-.133-68.338.116-76.434 1.294-103.441 1.069-24.941 5.242-38.512 8.709-47.536 4.628-11.977 10.161-20.496 19.094-29.478 8.949-8.983 17.459-14.532 29.403-19.202 9.025-3.526 22.561-7.715 47.511-8.9 26.998-1.278 35.085-1.551 103.423-1.684 68.353-.133 76.448.108 103.456 1.294 24.94 1.086 38.51 5.217 47.527 8.709 11.968 4.628 20.503 10.145 29.478 19.094 8.974 8.95 14.54 17.443 19.21 29.413 3.524 8.999 7.714 22.552 8.892 47.494 1.285 26.998 1.576 35.094 1.7 103.432.132 68.355-.117 76.451-1.302 103.442-1.087 24.957-5.226 38.52-8.709 47.56-4.629 11.953-10.161 20.488-19.103 29.471-8.941 8.949-17.451 14.531-29.403 19.201-9.009 3.517-22.561 7.714-47.494 8.9-26.998 1.269-35.086 1.56-103.448 1.684-68.338.133-76.424-.124-103.431-1.294z"/></svg>`,
  twitter: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="28" height="28"><rect width="512" height="512" rx="256" fill="#000"/><path fill="#fff" fill-rule="nonzero" d="M318.64 157.549h33.401l-72.973 83.407 85.85 113.495h-67.222l-52.647-68.836-60.242 68.836h-33.423l78.052-89.212-82.354-107.69h68.924l47.59 62.917 55.044-62.917zm-11.724 176.908h18.51L205.95 176.493h-19.86l120.826 157.964z"/></svg>`,
  pinterest: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="28" height="28"><rect width="512" height="512" rx="256" fill="#E60019"/><path fill="#fff" fill-rule="nonzero" d="M256 96c-88.41 0-160 71.59-160 160 0 67.74 41.45 126.04 100.53 150.78-1.39-12.55-2.64-31.81.55-45.5 3.05-12.43 20.38-86.36 20.38-86.36s-5.2-10.4-5.2-25.79c0-24.16 14.01-42.23 31.46-42.23 14.85 0 22.01 11.14 22.01 24.5 0 14.93-9.5 37.29-14.42 58.01-4.1 17.32 8.7 31.44 25.76 31.44 30.9 0 54.68-32.62 54.68-79.69 0-41.68-29.95-70.79-72.71-70.79-49.51 0-78.55 37.12-78.55 75.51 0 14.96 5.75 30.99 12.94 39.76.53.65.6 1.21.44 1.87-1.33 5.51-4.28 17.32-4.83 19.74-.77 3.18-2.52 3.87-5.83 2.32-21.72-10.11-35.29-41.87-35.29-67.38 0-54.9 39.87-105.3 114.93-105.3 60.32 0 107.22 43.01 107.22 100.48 0 59.96-37.79 108.18-90.26 108.18-17.64 0-34.21-9.18-39.85-20.01 0 0-8.72 33.24-10.84 41.37-4.1 15.79-15.49 35.74-22.55 47.1 16.27 5.02 33.54 7.71 51.46 7.71 88.41 0 160-71.59 160-160S344.41 96 256 96z"/></svg>`,
  tiktok: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="28" height="28"><rect width="512" height="512" rx="256" fill="#000"/><path fill="#fff" d="M384 196.8c-28.8 0-55.68-9.6-77.44-25.6v116.48C306.56 356.48 265.6 396.8 214.4 396.8c-51.84 0-93.44-41.6-93.44-93.44 0-51.84 41.6-93.44 93.44-93.44 7.04 0 14.08.96 20.48 2.56v68.48c-6.4-3.2-13.44-4.48-20.48-4.48-27.52 0-49.92 22.4-49.92 49.92 0 27.52 22.4 49.92 49.92 49.92 27.52 0 50.56-22.08 50.56-49.92V115.2h64c6.4 36.48 36.48 64 70.72 67.2v64l-.48-.64z"/></svg>`,
  whatsapp: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="28" height="28"><rect width="512" height="512" rx="256" fill="#25D366"/><path fill="#fff" d="M256 96C167.6 96 96 167.6 96 256c0 30.8 8.4 59.6 23.2 84.4L96 416l77.2-23c23.8 13.2 51.2 20.8 82.8 20.8 88.4 0 160-71.6 160-160S344.4 96 256 96zm87.6 218.4c-3.6 10-21.2 19.2-29.2 20.4-7.6 1.2-17.2 1.6-27.6-2.8-6.4-2.8-14.4-6.4-24.8-12.4-43.6-24.4-71.6-68.4-73.6-71.6-2-2.8-16-21.2-16-40.4 0-19.2 10-28.4 13.6-32.4 3.6-4 7.6-5 10-5s5 0 7.2.4c2.4.4 5.6-.4 8.4 6.4 2.8 7.2 9.6 26.4 10.4 28.4.8 2 1.6 4.4.4 7.2-1.2 2.8-2 4.4-4 6.8-2 2.4-4.4 5.2-6 7.2-2 2.4-4.4 4.8-1.6 9.6 2.8 4.4 12 19.6 26 31.6 17.6 16 32.8 20.8 37.2 23.2 4.4 2.4 7.2 2 9.6-.8 2.8-2.8 11.6-13.6 14.8-18 3.2-4.4 6-3.6 10-2 4 1.6 25.2 12 29.6 14 4.4 2.4 7.2 3.2 8.4 5.2 1.2 2.4 1.2 12 -2.4 22z"/></svg>`,
  youtube: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="28" height="28"><rect width="512" height="512" rx="115" fill="#FF0000"/><path fill="#fff" d="M415 195.2s-3.6-25.4-14.8-36.6c-14.2-14.8-30-14.8-37.4-15.8-52.2-3.8-130.6-3.8-130.6-3.8h-.4s-78.4 0-130.6 3.8c-7.4.8-23.2 1-37.4 15.8C52.4 169.8 48.8 195.2 48.8 195.2S45 224.8 45 254.4v27.8c0 29.6 3.8 59.2 3.8 59.2s3.6 25.4 14.8 36.6c14.2 14.8 32.8 14.4 41.2 15.8C134 397 232 397.8 232 397.8s78.4-.2 130.6-3.8c7.4-1 23.2-1 37.4-15.8 11.2-11.2 14.8-36.6 14.8-36.6s3.8-29.6 3.8-59.2v-27.8c0-29.6-3.6-59.2-3.6-59.2zM210 312V200l102 56.2L210 312z"/></svg>`,
};

// ════════════════════════════════════════════════════════════════
//  SETTINGS-DRIVEN COMPONENTS
// ════════════════════════════════════════════════════════════════
function buildLogoComponent(settings) {
  const logoUrl  = settings.logo_url || settings.logo || '';
  const siteName = 'BBW4LIFE';
  if (logoUrl) {
    return `<a href="${BASE_URL}" target="_blank" style="display:inline-block;text-decoration:none;margin-bottom:20px;">
      <img src="${logoUrl}" alt="${siteName}" height="60" style="height:60px;width:auto;max-width:200px;display:block;">
    </a>`;
  }
  return `<a href="${BASE_URL}" target="_blank" style="text-decoration:none;display:inline-block;margin-bottom:20px;">
    <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto;">
      <tr>
        <td style="border:1.5px solid rgba(255,255,255,0.35);border-radius:12px;padding:10px 28px;background:rgba(255,255,255,0.12);">
          <span style="font-family:Georgia,serif;font-size:20px;font-weight:700;color:#fff;letter-spacing:0.15em;">BBW<span style="color:${BBW.goldL};">4LIFE</span></span>
        </td>
      </tr>
    </table>
  </a>`;
}

function buildSocialFooter(settings) {
  const social = settings.social_links || {};
  const links  = [
    { key: 'facebook',  label: 'Facebook',  svg: SOCIAL_SVGS.facebook },
    { key: 'instagram', label: 'Instagram', svg: SOCIAL_SVGS.instagram },
    { key: 'tiktok',    label: 'TikTok',    svg: SOCIAL_SVGS.tiktok },
    { key: 'youtube',   label: 'YouTube',   svg: SOCIAL_SVGS.youtube },
    { key: 'pinterest', label: 'Pinterest', svg: SOCIAL_SVGS.pinterest },
    { key: 'twitter',   label: 'X',         svg: SOCIAL_SVGS.twitter },
    { key: 'whatsapp',  label: 'WhatsApp',  svg: SOCIAL_SVGS.whatsapp },
  ].filter(l => social[l.key]);

  if (!links.length) return '';

  return `
<table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto 16px;">
  <tr>
    ${links.map(l => `
    <td style="padding:0 6px;">
      <a href="${social[l.key]}" target="_blank" aria-label="${l.label}"
         style="display:inline-block;width:40px;height:40px;border-radius:10px;
                text-decoration:none;overflow:hidden;vertical-align:middle;">
        ${l.svg}
      </a>
    </td>`).join('')}
  </tr>
</table>`;
}

function buildCEOSignature(settings) {
  const ceo = settings.ceo || settings.founder || {};
  if (!ceo.name) return '';
  const photoHTML = ceo.photo
    ? `<img src="${ceo.photo}" alt="${ceo.name}" width="48" height="48"
           style="width:48px;height:48px;border-radius:50%;object-fit:cover;
                  border:2px solid ${BBW.gold};display:inline-block;vertical-align:middle;margin-right:12px;">`
    : '';
  return `
<table width="100%" cellpadding="0" cellspacing="0" role="presentation"
       style="margin-top:28px;padding-top:20px;border-top:1px solid rgba(192,56,94,0.15);">
  <tr>
    <td>
      ${photoHTML}
      <span style="display:inline-block;vertical-align:middle;">
        <span style="display:block;font-family:Georgia,serif;font-size:14px;font-weight:700;color:${BBW.dark};">${ceo.name}</span>
        <span style="display:block;font-family:Arial,sans-serif;font-size:12px;color:${BBW.textLight};">${ceo.title || 'Founder & CEO, BBW4LIFE'}</span>
      </span>
    </td>
  </tr>
</table>`;
}

// ── Master template ──────────────────────────────────────────
function masterTemplate({ preheader, headerGrad, topBadge, headline, subHeadline, bodyHTML, settings, showCEO = false }) {
  const logoHTML   = buildLogoComponent(settings);
  const socialHTML = buildSocialFooter(settings);
  const ceoHTML    = showCEO ? buildCEOSignature(settings) : '';
  const support    = (settings.contact_emails || {}).general || (settings.contact || {}).email || 'support@bbw4life.com';
  const whatsapp   = (settings.contact || {}).whatsapp_url || 'https://wa.me/18292677434';
  const grad       = headerGrad || `background:linear-gradient(145deg,${BBW.dark2} 0%,${BBW.rose} 50%,${BBW.gold} 100%)`;

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>BBW4LIFE</title>
  <style>${BASE_CSS}</style>
</head>
<body style="margin:0;padding:0;background-color:#f9f0f5;">

<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:#f9f0f5;line-height:1px;">
  ${preheader}&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;
</div>

<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f9f0f5;padding:32px 16px;">
  <tr><td align="center">
    <table class="ew" width="600" cellpadding="0" cellspacing="0" role="presentation"
           style="max-width:600px;width:100%;border-radius:20px;overflow:hidden;
                  box-shadow:0 20px 60px rgba(192,56,94,0.18);">

      <!-- HEADER -->
      <tr>
        <td style="${grad};">
          <div style="height:3px;background:linear-gradient(90deg,${BBW.gold},${BBW.rose},${BBW.goldL},${BBW.rose},${BBW.gold});"></div>
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td style="padding:36px 40px 32px;text-align:center;">
                ${logoHTML}
                ${topBadge ? `<div style="display:inline-block;padding:5px 18px;border-radius:20px;
                  background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.28);
                  font-family:Arial,sans-serif;font-size:11px;font-weight:700;
                  color:rgba(255,255,255,0.88);letter-spacing:0.12em;text-transform:uppercase;
                  margin-bottom:14px;">${topBadge}</div><br>` : ''}
                <h1 class="eh1" style="margin:0;font-family:Georgia,serif;font-size:28px;
                    font-weight:700;color:#fff;line-height:1.2;letter-spacing:0.02em;">${headline}</h1>
                ${subHeadline ? `<p style="margin:10px 0 0;font-family:Arial,sans-serif;
                    font-size:14px;color:rgba(255,255,255,0.78);line-height:1.5;">${subHeadline}</p>` : ''}
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- BODY -->
      <tr>
        <td class="ep" style="background:#fff;padding:36px 40px;">
          ${bodyHTML}
          ${ceoHTML}
        </td>
      </tr>

      <!-- SOCIAL FOOTER -->
      <tr>
        <td style="background:#fdf8f3;padding:20px 40px;text-align:center;border-top:1px solid rgba(192,56,94,0.12);">
          <p style="margin:0 0 12px;font-family:Arial,sans-serif;font-size:11px;
              color:${BBW.textLight};letter-spacing:0.10em;text-transform:uppercase;">
            Follow our community
          </p>
          ${socialHTML}
          <p style="margin:8px 0 0;font-family:Arial,sans-serif;font-size:12px;color:${BBW.textLight};">
            Need help?
            <a href="mailto:${support}" style="color:${BBW.rose};text-decoration:none;font-weight:600;">${support}</a>
            &nbsp;·&nbsp;
            <a href="${whatsapp}" target="_blank" style="color:${BBW.rose};text-decoration:none;font-weight:600;">WhatsApp</a>
          </p>
        </td>
      </tr>

      <!-- BOTTOM FOOTER -->
      <tr>
        <td style="background:${BBW.dark2};padding:20px 40px;text-align:center;">
          <p style="margin:0 0 8px;font-family:Georgia,serif;font-size:11px;
              color:rgba(255,255,255,0.40);letter-spacing:0.15em;">BBW4LIFE</p>
          <p style="margin:0 0 10px;font-family:Arial,sans-serif;font-size:11px;
              color:rgba(255,255,255,0.30);font-style:italic;">Beauty Has No Sizes 👑</p>
          <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto;">
            <tr>
              <td style="padding:0 8px;">
                <a href="${BASE_URL}/collections/bbw4life-all-product.html" target="_blank"
                   style="font-family:Arial,sans-serif;font-size:10px;color:${BBW.goldL};text-decoration:none;">Shop</a>
              </td>
              <td style="padding:0 8px;border-left:1px solid rgba(255,255,255,0.10);">
                <a href="${BASE_URL}/policies/privacy.html" target="_blank"
                   style="font-family:Arial,sans-serif;font-size:10px;color:${BBW.goldL};text-decoration:none;">Privacy</a>
              </td>
              <td style="padding:0 8px;border-left:1px solid rgba(255,255,255,0.10);">
                <a href="${BASE_URL}/page/contact.html" target="_blank"
                   style="font-family:Arial,sans-serif;font-size:10px;color:${BBW.goldL};text-decoration:none;">Contact</a>
              </td>
              <td style="padding:0 8px;border-left:1px solid rgba(255,255,255,0.10);">
                <a href="${BASE_URL}/policies/refund.html" target="_blank"
                   style="font-family:Arial,sans-serif;font-size:10px;color:${BBW.goldL};text-decoration:none;">Refunds</a>
              </td>
            </tr>
          </table>
          <p style="margin:12px 0 0;font-family:Arial,sans-serif;font-size:10px;color:rgba(255,255,255,0.18);">
            &copy; ${new Date().getFullYear()} BBW4LIFE — Built for every curve.
          </p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

// ── HTML components ───────────────────────────────────────────
function cParagraphs(text) {
  if (!text) return '';
  return text.split('\n').filter(p => p.trim()).map(p =>
    `<p style="margin:0 0 18px;font-family:Arial,sans-serif;font-size:15px;
        color:${BBW.textMid};line-height:1.75;">${p}</p>`
  ).join('');
}

function cCTA(label, url, color) {
  const bg = color || `linear-gradient(135deg,${BBW.rose} 0%,${BBW.plum} 100%)`;
  return `
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:28px 0 8px;">
  <tr>
    <td align="center">
      <a href="${url}" target="_blank"
         style="display:inline-block;padding:16px 48px;border-radius:50px;
                background:${bg};font-family:Arial,sans-serif;font-size:15px;
                font-weight:700;color:#fff;text-decoration:none;letter-spacing:0.04em;
                box-shadow:0 6px 24px rgba(192,56,94,0.38);">
        ${label}
      </a>
    </td>
  </tr>
</table>`;
}

function cDivider() {
  return `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:24px 0;">
  <tr>
    <td style="height:1px;background:linear-gradient(90deg,transparent,rgba(192,56,94,0.25),rgba(201,150,62,0.25),transparent);"></td>
  </tr>
</table>`;
}

function cHighlightBox(icon, title, text, color) {
  const bg = color || '#fdf0f3';
  return `
<table width="100%" cellpadding="0" cellspacing="0" role="presentation"
       style="margin:0 0 14px;border-radius:14px;overflow:hidden;background:${bg};border:1px solid rgba(192,56,94,0.18);">
  <tr>
    <td style="padding:18px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td width="36" style="vertical-align:top;padding-top:2px;font-size:22px;">${icon}</td>
          <td style="padding-left:12px;">
            <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:13px;font-weight:700;color:${BBW.dark};">${title}</p>
            <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:${BBW.textMid};line-height:1.55;">${text}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

function cOrderItem(item) {
  return `
<table width="100%" cellpadding="0" cellspacing="0" role="presentation"
       style="margin-bottom:10px;border-radius:12px;overflow:hidden;
              background:#fdf8f3;border:1px solid rgba(201,150,62,0.18);">
  <tr>
    ${item.image ? `
    <td width="70" style="padding:0;vertical-align:top;">
      <img src="${item.image}" width="70" height="70"
           style="display:block;width:70px;height:70px;object-fit:cover;border-radius:12px 0 0 12px;"
           alt="${item.title || 'Product'}">
    </td>` : ''}
    <td style="padding:14px 16px;vertical-align:middle;">
      <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:13px;font-weight:700;color:${BBW.dark};">${item.title || ''}</p>
      ${item.size  ? `<p style="margin:0 0 2px;font-family:Arial,sans-serif;font-size:12px;color:${BBW.textLight};">Size: ${item.size}</p>`  : ''}
      ${item.color ? `<p style="margin:0 0 2px;font-family:Arial,sans-serif;font-size:12px;color:${BBW.textLight};">Color: ${item.color}</p>` : ''}
      <p style="margin:4px 0 0;font-family:Arial,sans-serif;font-size:12px;color:${BBW.textLight};">
        Qty: ${item.quantity || 1} &nbsp;·&nbsp;
        <span style="color:${BBW.rose};font-weight:700;">$${parseFloat((item.price || 0) * (item.quantity || 1)).toFixed(2)}</span>
      </p>
    </td>
  </tr>
</table>`;
}

// ════════════════════════════════════════════════════════════════
//  AI COPY GENERATORS — avec fallbacks robustes
// ════════════════════════════════════════════════════════════════

async function genWelcomeCopy(name) {
  const copy = await callGroq(
    `EMAIL TYPE: Welcome — new BBW4LIFE customer created their account.
RECIPIENT: ${name}
Write 2 short paragraphs (blank line between):
- Para 1 (2 sentences): Make her feel genuinely seen. BBW4LIFE was built for her body right now.
- Para 2 (2 sentences): What's waiting for her on the site. One warm personal closing line.
Plain text only, no greeting, no sign-off.`
  );
  return copy || `You just made a decision that matters — creating your BBW4LIFE account is the first step toward a shopping experience that was built with you in mind. Every curve, every size, every woman belongs here.\n\nYour account gives you access to exclusive deals, your order history, and a wishlist to save the pieces you love. We're so glad you're here — and we can't wait to show you what's waiting for you.`;
}

async function genOrderConfirmCopy(name) {
  const copy = await callGroq(
    `EMAIL TYPE: Order confirmation for BBW4LIFE.
RECIPIENT: ${name}
Write 1 paragraph (2-3 sentences): Thank her for the order. Express genuine excitement. Mention order is being prepared with care.
Plain text only.`
  );
  return copy || `Thank you so much for your order — this means the world to us and we're already excited for you to receive it. Your items are being carefully prepared and will be on their way very soon. We'll send you a tracking number as soon as your package ships.`;
}

async function genTrackingCopy(name) {
  const copy = await callGroq(
    `EMAIL TYPE: Shipping notification with tracking number — BBW4LIFE.
RECIPIENT: ${name}
Write 1 paragraph (2 sentences): Great news, order is on the way. Warm, excited tone.
Plain text only.`
  );
  return copy || `Great news — your BBW4LIFE order is officially on its way to you! We've packed it with care and it's now in the hands of the carrier heading straight to your door.`;
}

async function genNewsletter1Copy(name) {
  const copy = await callGroq(
    `EMAIL TYPE: Newsletter welcome #1 — BBW4LIFE subscriber confirmation.
RECIPIENT: ${name || 'Beautiful'}
Write 2 paragraphs: Welcome to the family, explain what they'll receive (deals, new arrivals, stories, tips). Warm and excited.
Plain text only.`
  );
  return copy || `Welcome to the BBW4LIFE family — you just joined a community of women who believe beauty truly has no sizes. We're so happy you're here and we promise to make every email worth opening.\n\nAs a subscriber, you'll be the first to know about new arrivals, exclusive discount codes, and real stories from women just like you. Good things are already on their way to your inbox.`;
}

async function genNewsletter2Copy(name) {
  const copy = await callGroq(
    `EMAIL TYPE: Newsletter follow-up day 3 — BBW4LIFE. Emotional connection email.
RECIPIENT: ${name || 'Beautiful'}
Write 2 paragraphs: Check in warmly. Ask about their browsing experience. Invite feedback. Create genuine conversation.
Plain text only.`
  );
  return copy || `Hey, it's been a few days since you joined the BBW4LIFE family and we've been thinking about you. Have you had a chance to browse the shop yet? We'd love to know what caught your eye.\n\nYour feedback genuinely shapes what we do — if there's something you'd love to see on the site, a style, a size, a product, please just reply to this email and tell us. We actually read every message.`;
}

async function genNewsletter3Copy(name) {
  const copy = await callGroq(
    `EMAIL TYPE: Newsletter day 5 — BBW4LIFE bundle & favorites email.
RECIPIENT: ${name || 'Beautiful'}
Write 2 paragraphs: Make her feel valued. Highlight that BBW4LIFE has bundles and customer favorites. Encourage first purchase warmly.
Plain text only.`
  );
  return copy || `You matter to us — and that's not something we say lightly. BBW4LIFE was built specifically for women who've been overlooked by fashion for too long, and every product in our shop was chosen with real women in mind.\n\nOur customers' favorites and bundle deals are live right now, and some of them move really fast. If you've been waiting for the right moment to treat yourself, this is it.`;
}

async function genNewsletter4BuyerCopy(name) {
  const copy = await callGroq(
    `EMAIL TYPE: Newsletter day 10 — BBW4LIFE appreciation email for existing buyer.
RECIPIENT: ${name || 'Beautiful'}
Write 2 paragraphs: Thank her for her purchase. Ask about experience. Invite to share feedback. Recommend exploring more.
Plain text only.`
  );
  return copy || `You've already trusted us with your order and that means everything to us. We hope your items have arrived safely and that you love every piece as much as we loved choosing them for you.\n\nWe'd genuinely love to hear how your experience was — your honest feedback helps us improve and helps other women make confident decisions. And whenever you're ready to shop again, we'll have something special waiting for you.`;
}

async function genNewsletter4NewCopy(name) {
  const copy = await callGroq(
    `EMAIL TYPE: Newsletter day 10 — BBW4LIFE conversion email for non-buyer.
RECIPIENT: ${name || 'Beautiful'}
Write 2 paragraphs: Encourage first purchase gently. Mention exclusive discount below. Create soft urgency without pressure.
Plain text only.`
  );
  return copy || `You've been part of the BBW4LIFE family for a little while now and we've noticed you haven't placed your first order yet — and that's completely okay. We just wanted to make sure nothing was holding you back.\n\nAs a thank-you for your patience and loyalty, we've prepared an exclusive discount just for you. It's our way of saying we'd love to welcome you as a customer, not just a subscriber.`;
}

async function genContactReplyCopy(name) {
  const copy = await callGroq(
    `EMAIL TYPE: Contact form auto-reply — BBW4LIFE.
RECIPIENT: ${name || 'Beautiful'}
Write 1 paragraph (2-3 sentences): Confirm message received. Reassure them. Team will respond within 24-48 hours. Professional and caring.
Plain text only.`
  );
  return copy || `We've received your message and we're so glad you reached out to us. Our support team will review your request carefully and get back to you within 24 to 48 hours. Thank you for trusting BBW4LIFE — we take every message seriously.`;
}

async function genPlanRequestCopy(name, program) {
  const copy = await callGroq(
    `EMAIL TYPE: Product reservation/plan request confirmation — BBW4LIFE.
RECIPIENT: ${name || 'Beautiful'} PRODUCT: ${program}
Write 2 paragraphs: Confirm request received for ${program}. Make her feel great. Team will review and contact her soon.
Plain text only.`
  );
  return copy || `We've received your reservation request for ${program} and we're genuinely excited for you. This tells us you're serious about treating yourself, and that's something we celebrate here at BBW4LIFE.\n\nOur team will review your request and reach out to you very soon with the next steps. In the meantime, feel free to continue browsing the shop — there's so much more waiting for you.`;
}

async function genCustomProductCopy(name, productTitle) {
  const copy = await callGroq(
    `EMAIL TYPE: Custom/personalized product request confirmation — BBW4LIFE.
RECIPIENT: ${name || 'Beautiful'} PRODUCT: ${productTitle}
Write 2 paragraphs: Confirm receipt of personalized product request. Excite them. Design team will review. BBW4LIFE evaluating possibility.
Plain text only.`
  );
  return copy || `Your personalized product request has been received and we are genuinely impressed by your vision for ${productTitle}. At BBW4LIFE, we believe every woman deserves something made just for her.\n\nOur design team will carefully review your request and evaluate the possibility of bringing your idea to life on the website. We'll keep you posted — and whether or not it becomes a product, the fact that you shared your idea with us means a lot.`;
}

async function genCartAbandonedCopy(name) {
  const copy = await callGroq(
    `EMAIL TYPE: Abandoned cart recovery — BBW4LIFE.
RECIPIENT: ${name}
Write 2 short paragraphs (blank line between):
- Para 1 (2 sentences): Notice she left something behind in her cart. Warm, curious tone, not guilt-tripping.
- Para 2 (2 sentences): Reassure her items are saved and waiting. Mention a special gift below.
Plain text only, no greeting, no sign-off.`
  );
  return copy || `We noticed you left something behind in your cart — and we just wanted to check in. Sometimes life gets busy, and we'd genuinely love to know if there's anything we can help with.\n\nYour items are safely saved and waiting for you, exactly where you left them. To make it even easier to come back, we've added a little gift below just for you.`;
}

// ════════════════════════════════════════════════════════════════
//  EMAIL COMPOSERS
// ════════════════════════════════════════════════════════════════

// ── 1. Welcome (après création de compte) ────────────────────
async function composeWelcome(firstName, settings) {
  const name = firstName || 'Beautiful';
  const copy = await genWelcomeCopy(name);

  const bodyHTML = `
    <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:12px;font-weight:700;
        color:${BBW.rose};letter-spacing:0.08em;text-transform:uppercase;">Hey ${name} 👋</p>
    ${cParagraphs(copy)}
    ${cDivider()}
    <p style="margin:0 0 14px;font-family:Georgia,serif;font-size:15px;font-weight:700;color:${BBW.dark};">
      What's waiting for you:
    </p>
    ${cHighlightBox('👗', 'Plus-Size Fashion', 'Hundreds of styles designed with your body in mind — dresses, tops, shoes, and more.')}
    ${cHighlightBox('💄', 'Beauty & Lifestyle', 'Products that make you feel as beautiful as you are.', '#fdf8f0')}
    ${cHighlightBox('❤️', 'A Community That Gets It', 'Real women, real stories, real support.', '#f0f8fd')}
    ${cCTA('Explore the Shop →', `${BASE_URL}/collections/bbw4life-all-product.html`)}`;

  return {
    subject: `Welcome to BBW4LIFE, ${name}! Beauty Has No Sizes 👑`,
    html: masterTemplate({
      preheader:   `You're officially part of the BBW4LIFE family — and we built this for exactly you.`,
      headerGrad:  `background:linear-gradient(145deg,${BBW.dark2} 0%,${BBW.plum} 40%,${BBW.rose} 80%,${BBW.gold} 100%)`,
      topBadge:    'Welcome to the family',
      headline:    'You made it. 👑',
      subHeadline: 'BBW4LIFE was built for women exactly like you.',
      bodyHTML,
      settings,
      showCEO:     true,
    }),
  };
}

// ── 2. Order Confirmation (après paiement) ───────────────────
async function composeOrderConfirm(data, settings) {
  const { firstName, lastName, email, orderId, items = [], total, shippingAddress } = data;
  const name = firstName || lastName || 'Beautiful';
  const copy = await genOrderConfirmCopy(name);
  const itemsHTML = (items || []).map(item => cOrderItem(item)).join('');

  const bodyHTML = `
    <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:12px;font-weight:700;
        color:${BBW.rose};letter-spacing:0.08em;text-transform:uppercase;">Order Confirmed ✅</p>
    ${cParagraphs(copy)}
    ${cDivider()}
    <p style="margin:0 0 14px;font-family:Georgia,serif;font-size:15px;font-weight:700;color:${BBW.dark};">
      Your Order — <span style="color:${BBW.rose};">#${orderId || 'BBW4LIFE'}</span>
    </p>
    ${itemsHTML}
    ${total ? `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="margin-top:14px;padding:14px;background:#fdf8f3;border-radius:10px;border:1px solid rgba(201,150,62,0.18);">
      <tr>
        <td style="font-family:Georgia,serif;font-size:15px;font-weight:700;color:${BBW.dark};">Total</td>
        <td style="text-align:right;font-family:Georgia,serif;font-size:17px;font-weight:700;color:${BBW.rose};">$${parseFloat(total).toFixed(2)}</td>
      </tr>
    </table>` : ''}
    ${shippingAddress ? `
    ${cDivider()}
    <p style="margin:0 0 8px;font-family:Georgia,serif;font-size:13px;font-weight:700;color:${BBW.dark};">Shipping to:</p>
    <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:${BBW.textMid};line-height:1.6;">${shippingAddress}</p>` : ''}
    ${cDivider()}
    <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:${BBW.textLight};text-align:center;line-height:1.6;">
      You'll receive a tracking number by email as soon as your order ships.<br>
      Questions? Reply to this email — we're always here.
    </p>`;

  return {
    subject: `Order Confirmed! Your BBW4LIFE order is being prepared 🛍️`,
    html: masterTemplate({
      preheader:   `Your order has been confirmed — we're already preparing it with care.`,
      headerGrad:  `background:linear-gradient(145deg,${BBW.dark2} 0%,${BBW.rose} 60%,${BBW.gold} 100%)`,
      topBadge:    'Order Confirmed',
      headline:    'Thank you for your order! 🛍️',
      subHeadline: "We're preparing your package with love.",
      bodyHTML,
      settings,
    }),
  };
}

// ── 3. Order Tracking (quand EPROLO fournit le numéro) ───────
async function composeOrderTracking(data, settings) {
  const { firstName, lastName, orderId, trackingNumber, carrier, trackingUrl } = data;
  const name = firstName || lastName || 'Beautiful';
  const copy = await genTrackingCopy(name);

  const bodyHTML = `
    <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:12px;font-weight:700;
        color:${BBW.rose};letter-spacing:0.08em;text-transform:uppercase;">Your Order Is On Its Way 🚚</p>
    ${cParagraphs(copy)}
    ${cDivider()}
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="margin:0 0 20px;border-radius:16px;overflow:hidden;
                  background:linear-gradient(135deg,${BBW.dark2},${BBW.plum});
                  border:1px solid rgba(201,150,62,0.28);">
      <tr>
        <td style="padding:28px;text-align:center;">
          <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:11px;
              color:rgba(255,255,255,0.55);text-transform:uppercase;letter-spacing:0.12em;">
            Tracking Number
          </p>
          <p style="margin:0 0 10px;font-family:Georgia,serif;font-size:28px;font-weight:700;
              color:${BBW.goldL};letter-spacing:0.10em;">${trackingNumber}</p>
          ${carrier ? `<p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:rgba(255,255,255,0.65);">Carrier: ${carrier}</p>` : ''}
        </td>
      </tr>
    </table>
    ${cCTA('Track My Order →', trackingUrl || `${BASE_URL}/page/order-tracking.html`)}
    ${cDivider()}
    <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:${BBW.textLight};text-align:center;">
      Order: <strong style="color:${BBW.dark};">#${orderId || 'BBW4LIFE'}</strong>
    </p>`;

  return {
    subject: `Your BBW4LIFE order is on its way! 🚚 Tracking: ${trackingNumber}`,
    html: masterTemplate({
      preheader:   `Your order has shipped — here's your tracking number: ${trackingNumber}`,
      headerGrad:  `background:linear-gradient(145deg,${BBW.dark2} 0%,${BBW.plum} 50%,${BBW.rose} 100%)`,
      topBadge:    'Order Shipped',
      headline:    'Your order is on its way! 🚚',
      subHeadline: 'Track your package and watch the magic happen.',
      bodyHTML,
      settings,
    }),
  };
}

// ── 4. Newsletter #1 — Immédiat après subscription ───────────
async function composeNewsletter1(firstName, settings) {
  const name  = firstName || 'Beautiful';
  const copy  = await genNewsletter1Copy(name);
  const promo = (settings.promos || [])[0];

  const bodyHTML = `
    <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:12px;font-weight:700;
        color:${BBW.rose};letter-spacing:0.08em;text-transform:uppercase;">Subscription Confirmed ✓</p>
    ${cParagraphs(copy)}
    ${cDivider()}
    <p style="margin:0 0 14px;font-family:Georgia,serif;font-size:15px;font-weight:700;color:${BBW.dark};">
      Here's what's coming your way:
    </p>
    ${cHighlightBox('💡', 'Weekly Tips', 'Style and wellness tips built for real curvy women.')}
    ${cHighlightBox('🎁', 'Exclusive Deals', 'Subscriber-only discount codes before they go public.', '#fdf8f0')}
    ${cHighlightBox('✨', 'New Arrivals First', "You'll always be the first to know.", '#f0f8fd')}
    ${cHighlightBox('💪', 'Real Stories', 'Success stories from women in our community.', '#f0fff4')}
    ${promo ? `
    ${cDivider()}
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="border-radius:16px;overflow:hidden;background:linear-gradient(135deg,${BBW.dark2},${BBW.rose});">
      <tr>
        <td style="padding:24px;text-align:center;">
          <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:11px;
              color:rgba(255,255,255,0.60);text-transform:uppercase;letter-spacing:0.12em;">🎁 Welcome Gift</p>
          <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:32px;font-weight:700;
              color:${BBW.goldL};letter-spacing:0.10em;">${promo.code}</p>
          <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:rgba(255,255,255,0.75);">
            ${promo.percent}% off — ${promo.items} items or more
          </p>
        </td>
      </tr>
    </table>` : ''}
    ${cCTA('Discover the Shop →', `${BASE_URL}/collections/bbw4life-all-product.html`)}`;

  return {
    subject: `You're in! Welcome to the BBW4LIFE family 💕`,
    html: masterTemplate({
      preheader:   `Your subscription is confirmed — exclusive tips, deals, and real stories incoming.`,
      headerGrad:  `background:linear-gradient(145deg,${BBW.dark2} 0%,${BBW.rose} 55%,${BBW.gold} 100%)`,
      topBadge:    'Newsletter Confirmed',
      headline:    "You're officially inside. 💕",
      subHeadline: 'The best of BBW4LIFE, delivered to your inbox.',
      bodyHTML,
      settings,
      showCEO:     true,
    }),
  };
}

// ── 5. Newsletter #2 — Jour 3 ─────────────────────────────────
async function composeNewsletter2(firstName, settings) {
  const name    = firstName || 'Beautiful';
  const copy    = await genNewsletter2Copy(name);
  const support = (settings.contact_emails || {}).general || 'support@bbw4life.com';

  const bodyHTML = `
    <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:12px;font-weight:700;
        color:${BBW.rose};letter-spacing:0.08em;text-transform:uppercase;">Checking In 💬</p>
    ${cParagraphs(copy)}
    ${cDivider()}
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="border-radius:14px;overflow:hidden;background:#fdf0f3;border:1px solid rgba(192,56,94,0.15);">
      <tr>
        <td style="padding:22px;text-align:center;">
          <p style="margin:0 0 6px;font-size:28px;">💬</p>
          <p style="margin:0 0 8px;font-family:Georgia,serif;font-size:14px;font-weight:700;color:${BBW.dark};">
            We'd love to hear from you
          </p>
          <p style="margin:0 0 14px;font-family:Arial,sans-serif;font-size:13px;color:${BBW.textMid};">
            Simply reply to this email or contact us anytime.
          </p>
          <a href="mailto:${support}" style="display:inline-block;padding:10px 28px;border-radius:40px;
             background:${BBW.rose};font-family:Arial,sans-serif;font-size:13px;
             font-weight:700;color:#fff;text-decoration:none;">
            Reply Now →
          </a>
        </td>
      </tr>
    </table>
    ${cCTA('Browse the Shop →', `${BASE_URL}/collections/bbw4life-all-product.html`)}`;

  return {
    subject: `Hey ${name}, how's your BBW4LIFE experience so far? 💬`,
    html: masterTemplate({
      preheader:   `We'd love to hear from you — your feedback shapes everything we do.`,
      headerGrad:  `background:linear-gradient(145deg,${BBW.dark2} 0%,${BBW.plum} 50%,${BBW.rose} 100%)`,
      topBadge:    'Just Checking In',
      headline:    "How's it going? 💬",
      subHeadline: 'Your feedback genuinely shapes what we do.',
      bodyHTML,
      settings,
      showCEO:     true,
    }),
  };
}

// ── 6. Newsletter #3 — Jour 5 ─────────────────────────────────
async function composeNewsletter3(firstName, settings) {
  const name  = firstName || 'Beautiful';
  const copy  = await genNewsletter3Copy(name);
  const promo = (settings.promos || [])[1] || (settings.promos || [])[0];

  const bodyHTML = `
    <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:12px;font-weight:700;
        color:${BBW.rose};letter-spacing:0.08em;text-transform:uppercase;">Special For You 💕</p>
    ${cParagraphs(copy)}
    ${cDivider()}
    ${cHighlightBox('🛍️', 'Bundle Deals', 'Buy multiple items and save more — designed to reward women who shop smart.')}
    ${cHighlightBox('⭐', 'Customer Favorites', 'The pieces our community loves most, voted by real women.', '#fdf8f0')}
    ${cHighlightBox('🔥', 'Limited Promotions', 'Flash deals that come and go — stay subscribed to never miss one.', '#f0f8fd')}
    ${promo ? `
    ${cDivider()}
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="border-radius:16px;overflow:hidden;background:linear-gradient(135deg,${BBW.plum},${BBW.rose});">
      <tr>
        <td style="padding:22px;text-align:center;">
          <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:11px;
              color:rgba(255,255,255,0.60);text-transform:uppercase;letter-spacing:0.12em;">💕 For Our Subscribers</p>
          <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:28px;font-weight:700;
              color:${BBW.goldL};letter-spacing:0.10em;">${promo.code}</p>
          <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:rgba(255,255,255,0.75);">
            ${promo.percent}% off — ${promo.items} items or more
          </p>
        </td>
      </tr>
    </table>` : ''}
    ${cCTA('Shop Our Favorites →', `${BASE_URL}/collections/most-popular.html`)}`;

  return {
    subject: `${name}, these are our customers' favorites 🔥`,
    html: masterTemplate({
      preheader:   `Bundles, favorites, and exclusive promotions — all waiting for you.`,
      headerGrad:  `background:linear-gradient(145deg,${BBW.dark2} 0%,${BBW.rose} 45%,${BBW.plum} 100%)`,
      topBadge:    'Community Favorites',
      headline:    'You deserve the best. 🔥',
      subHeadline: "Bundles, promotions, and our community's top picks.",
      bodyHTML,
      settings,
    }),
  };
}

// ── 7. Newsletter #4 — Jour 10 (Buyer) ───────────────────────
async function composeNewsletter4Buyer(firstName, settings) {
  const name = firstName || 'Beautiful';
  const copy = await genNewsletter4BuyerCopy(name);

  const bodyHTML = `
    <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:12px;font-weight:700;
        color:${BBW.rose};letter-spacing:0.08em;text-transform:uppercase;">Thank You 💕</p>
    ${cParagraphs(copy)}
    ${cDivider()}
    ${cHighlightBox('⭐', 'Share Your Experience', 'Your review helps other women feel confident in their choices.')}
    ${cHighlightBox('🛍️', 'Shop More', 'New arrivals added regularly — there\'s always something new waiting for you.', '#fdf8f0')}
    ${cCTA('Leave a Review →', `${BASE_URL}/collections/bbw4life-all-product.html`)}
    ${cCTA('Shop New Arrivals →', `${BASE_URL}/collections/bbw4life-all-product.html`, `linear-gradient(135deg,${BBW.gold},${BBW.rose})`)}`;

  return {
    subject: `Thank you for your trust, ${name} 💕`,
    html: masterTemplate({
      preheader:   `We appreciate you and we'd love to hear about your experience.`,
      headerGrad:  `background:linear-gradient(145deg,${BBW.dark2} 0%,${BBW.gold} 50%,${BBW.rose} 100%)`,
      topBadge:    'Customer Appreciation',
      headline:    'Thank you for trusting us. 💕',
      subHeadline: 'Your experience matters to us more than anything.',
      bodyHTML,
      settings,
      showCEO:     true,
    }),
  };
}

// ── 8. Newsletter #4 — Jour 10 (Non-Buyer) ───────────────────
async function composeNewsletter4New(firstName, settings) {
  const name  = firstName || 'Beautiful';
  const copy  = await genNewsletter4NewCopy(name);
  const promo = (settings.promos || [])[0];

  const bodyHTML = `
    <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:12px;font-weight:700;
        color:${BBW.rose};letter-spacing:0.08em;text-transform:uppercase;">A Special Gift For You 🎁</p>
    ${cParagraphs(copy)}
    ${promo ? `
    ${cDivider()}
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="border-radius:16px;overflow:hidden;
                  background:linear-gradient(135deg,${BBW.dark2},${BBW.rose},${BBW.gold});">
      <tr>
        <td style="padding:28px;text-align:center;">
          <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:11px;
              color:rgba(255,255,255,0.60);text-transform:uppercase;letter-spacing:0.12em;">🎁 Exclusive Subscriber Offer</p>
          <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:34px;font-weight:700;
              color:${BBW.goldL};letter-spacing:0.12em;">${promo.code}</p>
          <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:rgba(255,255,255,0.78);">
            ${promo.percent}% off — ${promo.items} items or more
          </p>
        </td>
      </tr>
    </table>` : ''}
    ${cCTA('Use My Discount →', `${BASE_URL}/collections/bbw4life-all-product.html`)}
    ${cDivider()}
    <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:${BBW.textLight};text-align:center;">
      Beauty Has No Sizes — and neither does this offer. 👑
    </p>`;

  return {
    subject: `${name}, here's an exclusive gift just for you 🎁`,
    html: masterTemplate({
      preheader:   `We prepared something special for you — an exclusive discount waiting inside.`,
      headerGrad:  `background:linear-gradient(145deg,${BBW.dark2} 0%,${BBW.rose} 50%,${BBW.gold} 100%)`,
      topBadge:    'Exclusive Offer',
      headline:    'This is just for you. 🎁',
      subHeadline: 'A special gift from the BBW4LIFE family.',
      bodyHTML,
      settings,
      showCEO:     true,
    }),
  };
}

// ── 9. Contact Auto-Reply ─────────────────────────────────────
async function composeContactReply(data, settings) {
  const { firstName, lastName, subject: msgSubject, category } = data;
  const name    = firstName || lastName || 'Beautiful';
  const copy    = await genContactReplyCopy(name);
  const support = (settings.contact_emails || {}).general || 'support@bbw4life.com';
  const whatsapp = (settings.contact || {}).whatsapp_url || 'https://wa.me/18292677434';

  const bodyHTML = `
    <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:12px;font-weight:700;
        color:${BBW.rose};letter-spacing:0.08em;text-transform:uppercase;">Message Received ✅</p>
    ${cParagraphs(copy)}
    ${cDivider()}
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="border-radius:14px;overflow:hidden;background:#fdf0f3;border:1px solid rgba(192,56,94,0.15);">
      <tr>
        <td style="padding:20px;">
          <p style="margin:0 0 8px;font-family:Georgia,serif;font-size:14px;font-weight:700;color:${BBW.dark};">
            Your message details:
          </p>
          ${msgSubject ? `<p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:13px;color:${BBW.textMid};"><strong>Subject:</strong> ${msgSubject}</p>` : ''}
          ${category   ? `<p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:${BBW.textMid};"><strong>Category:</strong> ${category}</p>` : ''}
        </td>
      </tr>
    </table>
    ${cDivider()}
    <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:${BBW.textLight};text-align:center;line-height:1.7;">
      Need urgent help?<br>
      <a href="mailto:${support}" style="color:${BBW.rose};font-weight:700;text-decoration:none;">${support}</a>
      &nbsp;·&nbsp;
      <a href="${whatsapp}" target="_blank" style="color:${BBW.rose};font-weight:700;text-decoration:none;">WhatsApp Us</a>
    </p>`;

  return {
    subject: `We received your message — BBW4LIFE Support ✅`,
    html: masterTemplate({
      preheader:   `Your message has been received — our team will respond within 24-48 hours.`,
      headerGrad:  `background:linear-gradient(145deg,${BBW.dark2} 0%,${BBW.plum} 50%,${BBW.rose} 100%)`,
      topBadge:    'Support',
      headline:    'Message received! ✅',
      subHeadline: 'Our team will respond within 24 to 48 hours.',
      bodyHTML,
      settings,
    }),
  };
}

// ── 10. Plan/Product Request ──────────────────────────────────
async function composePlanRequest(data, settings) {
  const { firstName, lastName, program, size, color } = data;
  const name = firstName || lastName || 'Beautiful';
  const copy = await genPlanRequestCopy(name, program);

  const bodyHTML = `
    <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:12px;font-weight:700;
        color:${BBW.rose};letter-spacing:0.08em;text-transform:uppercase;">Request Received ✅</p>
    ${cParagraphs(copy)}
    ${cDivider()}
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="border-radius:14px;overflow:hidden;
                  background:linear-gradient(135deg,${BBW.dark2},${BBW.plum});
                  border:1px solid rgba(201,150,62,0.28);">
      <tr>
        <td style="padding:24px;text-align:center;">
          <p style="margin:0 0 6px;font-size:32px;">⏳</p>
          <p style="margin:0 0 6px;font-family:Georgia,serif;font-size:15px;font-weight:700;color:#fff;">${program || 'Your Product Request'}</p>
          ${size  ? `<p style="margin:0 0 2px;font-family:Arial,sans-serif;font-size:13px;color:rgba(255,255,255,0.65);">Size: ${size}</p>` : ''}
          ${color ? `<p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:rgba(255,255,255,0.65);">Color: ${color}</p>` : ''}
          <p style="margin:12px 0 0;font-family:Arial,sans-serif;font-size:12px;color:${BBW.goldL};">
            Our team will be in touch soon.
          </p>
        </td>
      </tr>
    </table>
    ${cCTA('Browse the Shop →', `${BASE_URL}/collections/bbw4life-all-product.html`)}`;

  return {
    subject: `Your BBW4LIFE product request has been received! ⏳`,
    html: masterTemplate({
      preheader:   `We've received your request for ${program} — our team will review it soon.`,
      headerGrad:  `background:linear-gradient(145deg,${BBW.dark2} 0%,${BBW.plum} 50%,${BBW.gold} 100%)`,
      topBadge:    'Request Confirmed',
      headline:    "We've got your request! ⏳",
      subHeadline: "Our team is on it — we'll be in touch very soon.",
      bodyHTML,
      settings,
    }),
  };
}

// ── 11. Custom Product Request ────────────────────────────────
async function composeCustomProduct(data, settings) {
  // Accepte firstname/lastname OU firstName/lastName (les deux formats)
  const firstName    = data.firstname    || data.firstName    || '';
  const lastName     = data.lastname     || data.lastName     || '';
  const productTitle = data.product_title || data.productTitle || 'Your Custom Product';
  const productDesc  = data.product_desc  || data.productDesc  || '';
  const name         = firstName || lastName || 'Beautiful';
  const copy         = await genCustomProductCopy(name, productTitle);

  const bodyHTML = `
    <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:12px;font-weight:700;
        color:${BBW.rose};letter-spacing:0.08em;text-transform:uppercase;">Design Request Received 🎨</p>
    ${cParagraphs(copy)}
    ${cDivider()}
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="border-radius:14px;overflow:hidden;
                  background:linear-gradient(135deg,${BBW.dark2},${BBW.rose});
                  border:1px solid rgba(201,150,62,0.28);">
      <tr>
        <td style="padding:24px;text-align:center;">
          <p style="margin:0 0 6px;font-size:32px;">🎨</p>
          <p style="margin:0 0 6px;font-family:Georgia,serif;font-size:15px;font-weight:700;color:#fff;">
            ${productTitle}
          </p>
          ${productDesc ? `<p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:rgba(255,255,255,0.65);line-height:1.5;">${productDesc.substring(0, 100)}${productDesc.length > 100 ? '...' : ''}</p>` : ''}
          <p style="margin:12px 0 0;font-family:Arial,sans-serif;font-size:12px;color:${BBW.goldL};">
            Our design team will review your idea.
          </p>
        </td>
      </tr>
    </table>
    ${cDivider()}
    <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:${BBW.textLight};text-align:center;line-height:1.7;">
      We evaluate every personalized product request carefully.<br>
      If your idea becomes a product, you'll be the first to know. 👑
    </p>
    ${cCTA('Explore Existing Products →', `${BASE_URL}/collections/bbw4life-all-product.html`)}`;

  return {
    subject: `Your personalized product request is with our design team! 🎨`,
    html: masterTemplate({
      preheader:   `Your custom product idea has been received — our design team is reviewing it.`,
      headerGrad:  `background:linear-gradient(145deg,${BBW.dark2} 0%,${BBW.rose} 50%,${BBW.plum} 100%)`,
      topBadge:    'Design Request',
      headline:    'We love your vision! 🎨',
      subHeadline: 'Our design team will review your personalized product idea.',
      bodyHTML,
      settings,
      showCEO:     true,
    }),
  };
}

// ── 12. Abandoned Cart ────────────────────────────────────────
async function composeCartAbandoned(data, settings) {
  const { firstName, lastName, items = [], promoCode, promoPercent, restartLink } = data;
  const name    = firstName || lastName || 'Beautiful';
  const copy    = await genCartAbandonedCopy(name);
  const itemsHTML = (items || []).map(item => cOrderItem(item)).join('');
  const finalLink = restartLink || `${BASE_URL}/checkout.html`;

  const bodyHTML = `
    <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:12px;font-weight:700;
        color:${BBW.rose};letter-spacing:0.08em;text-transform:uppercase;">Your Cart Is Waiting 🛍️</p>
    ${cParagraphs(copy)}
    ${itemsHTML ? `
    ${cDivider()}
    <p style="margin:0 0 14px;font-family:Georgia,serif;font-size:15px;font-weight:700;color:${BBW.dark};">
      Still in your cart:
    </p>
    ${itemsHTML}` : ''}
    ${promoCode ? `
    ${cDivider()}
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="border-radius:16px;overflow:hidden;
                  background:linear-gradient(135deg,${BBW.dark2},${BBW.rose},${BBW.gold});">
      <tr>
        <td style="padding:28px;text-align:center;">
          <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:11px;
              color:rgba(255,255,255,0.60);text-transform:uppercase;letter-spacing:0.12em;">🎁 A Little Gift For You</p>
          <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:34px;font-weight:700;
              color:${BBW.goldL};letter-spacing:0.12em;">${promoCode}</p>
          <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:rgba(255,255,255,0.78);">
            ${promoPercent ? `${promoPercent}% off your order` : 'Exclusive discount'}
          </p>
        </td>
      </tr>
    </table>` : ''}
    ${cCTA('Restart My Order →', finalLink)}
    ${cDivider()}
    <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:${BBW.textLight};text-align:center;">
      Beauty Has No Sizes — and your spot in the BBW4LIFE family is still waiting. 👑
    </p>`;

  return {
    subject: `${name}, you left something beautiful behind 🛍️`,
    html: masterTemplate({
      preheader:   `Your cart is saved and waiting — plus a little gift to welcome you back.`,
      headerGrad:  `background:linear-gradient(145deg,${BBW.dark2} 0%,${BBW.rose} 50%,${BBW.gold} 100%)`,
      topBadge:    'Cart Saved For You',
      headline:    "Don't forget this. 🛍️",
      subHeadline: 'Your items are exactly where you left them.',
      bodyHTML,
      settings,
      showCEO:     true,
    }),
  };
}

// ════════════════════════════════════════════════════════════════
//  SEND HELPERS
// ════════════════════════════════════════════════════════════════

// trySend — avec vérification log anti-doublon
async function trySend(email, type, composeFn, sheets, sentLog, results) {
  if (!email || !email.includes('@')) {
    console.warn(`[trySend] Invalid email: "${email}"`);
    return false;
  }
  if (wasEmailSent(sentLog, email, type)) {
    results.skipped.push({ email, type, reason: 'already sent' });
    console.log(`[trySend] SKIP — already sent: ${email} / ${type}`);
    return false;
  }
  try {
    console.log(`[trySend] Composing ${type} for ${email}`);
    const { subject, html } = await composeFn();
    const ok = await deliver(email, subject, html);
    if (ok) {
      await markEmailSent(sheets, email, type);
      sentLog.add(`${email.toLowerCase()}||${type}`);
      results.sent.push({ email, type });
      console.log(`[trySend] ✅ Sent ${type} to ${email}`);
    } else {
      results.errors.push({ email, type, reason: 'Resend delivery failed' });
    }
    return ok;
  } catch (e) {
    console.error(`[trySend] Error ${email}/${type}:`, e.message);
    results.errors.push({ email, type, reason: e.message });
    return false;
  }
}


async function trySendOnce(email, type, composeFn, results) {
  if (!email || !email.includes('@')) {
    console.warn(`[trySendOnce] Invalid email: "${email}"`);
    return false;
  }
  try {
    console.log(`[trySendOnce] Composing ${type} for ${email}`);
    const { subject, html } = await composeFn();
    const ok = await deliver(email, subject, html);
    if (ok) {
      results.sent.push({ email, type });
      console.log(`[trySendOnce] ✅ Sent ${type} to ${email}`);
    } else {
      results.errors.push({ email, type, reason: 'Resend delivery failed' });
    }
    return ok;
  } catch (e) {
    console.error(`[trySendOnce] Error ${email}/${type}:`, e.message);
    results.errors.push({ email, type, reason: e.message });
    return false;
  }
}

// ════════════════════════════════════════════════════════════════
//  MAIN HANDLER
// ════════════════════════════════════════════════════════════════
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const results = { sent: [], skipped: [], errors: [] };

  try {
    const settings = await loadSettings();
    const sheets   = getSheets();

    // ════════════════════════════════════════════════════
    //  MODE POST — trigger depuis une action client
    // ════════════════════════════════════════════════════
    if (event.httpMethod === 'POST' && event.body) {
      const body    = JSON.parse(event.body);
      const trigger = body.trigger;

      if (!trigger) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'trigger required' }) };
      }

      const email = (body.email || '').trim();
      if (!email || !email.includes('@')) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Valid email required' }) };
      }

      console.log(`[Handler] POST trigger: ${trigger} → ${email}`);

      // ── WELCOME — après création de compte
      // Utilise le log anti-doublon (1 welcome par compte)
      if (trigger === T.WELCOME) {
        const sentLog = await loadEmailLog(sheets);
        await trySend(
          email, T.WELCOME,
          () => composeWelcome(body.firstName || body.firstName || '', settings),
          sheets, sentLog, results
        );
      }

      // ── ORDER CONFIRM — après paiement
      // Email transactionnel : 1 envoi immédiat, pas de log
      else if (trigger === T.ORDER_CONFIRM) {
        await trySendOnce(
          email, T.ORDER_CONFIRM,
          () => composeOrderConfirm({
            firstName:       body.firstName || '',
            lastName:        body.lastName  || '',
            email,
            orderId:         body.orderId,
            items:           body.items || [],
            total:           body.total,
            shippingAddress: body.shippingAddress || ''
          }, settings),
          results
        );
      }

      // ── ORDER TRACKING — envoyé par le cron mais peut être appelé manuellement
      else if (trigger === T.ORDER_TRACKING) {
        await trySendOnce(
          email, T.ORDER_TRACKING,
          () => composeOrderTracking({
            firstName:      body.firstName || '',
            lastName:       body.lastName  || '',
            orderId:        body.orderId,
            trackingNumber: body.trackingNumber,
            carrier:        body.carrier || '',
            trackingUrl:    body.trackingUrl || ''
          }, settings),
          results
        );
      }

      // ── NEWSLETTER #1 — après subscription
      // Utilise le log anti-doublon
      else if (trigger === T.NEWSLETTER_1) {
        const sentLog = await loadEmailLog(sheets);
        await trySend(
          email, T.NEWSLETTER_1,
          () => composeNewsletter1(body.firstName || '', settings),
          sheets, sentLog, results
        );
      }

      // ── CONTACT REPLY — après soumission du formulaire contact
      // Email transactionnel : pas de log anti-doublon
      else if (trigger === T.CONTACT_REPLY) {
        await trySendOnce(
          email, T.CONTACT_REPLY,
          () => composeContactReply({
            firstName: body.firstName || '',
            lastName:  body.lastName  || '',
            subject:   body.subject   || '',
            category:  body.category  || ''
          }, settings),
          results
        );
      }

      // ── PLAN REQUEST — après soumission product request
      // Email transactionnel : pas de log anti-doublon
      else if (trigger === T.PLAN_REQUEST) {
        await trySendOnce(
          email, T.PLAN_REQUEST,
          () => composePlanRequest({
            firstName: body.firstName || '',
            lastName:  body.lastName  || '',
            program:   body.program   || body.productTitle || '',
            size:      body.size      || '',
            color:     body.color     || ''
          }, settings),
          results
        );
      }

      // ── CUSTOM PRODUCT — après soumission produit personnalisé
      // Email transactionnel : pas de log anti-doublon
      else if (trigger === T.CUSTOM_PRODUCT) {
        await trySendOnce(
          email, T.CUSTOM_PRODUCT,
          () => composeCustomProduct({
            firstname:     body.firstname     || body.firstName || '',
            lastname:      body.lastname      || body.lastName  || '',
            product_title: body.product_title || body.productTitle || '',
            product_desc:  body.product_desc  || body.productDesc  || ''
          }, settings),
          results
        );
      }

      // ── CART ABANDONED — relance panier
      else if (trigger === T.CART_ABANDONED) {
        const sentLog = await loadEmailLog(sheets);
        await trySend(
          email, T.CART_ABANDONED,
          () => composeCartAbandoned({
            firstName:   body.firstName   || '',
            lastName:    body.lastName    || '',
            items:       body.items       || [],
            promoCode:   body.promoCode   || '',
            promoPercent: body.promoPercent || '',
            restartLink: body.restartLink || ''
          }, settings),
          sheets, sentLog, results
        );
      }

      else {
        console.warn(`[Handler] Unknown trigger: ${trigger}`);
        return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown trigger: ${trigger}` }) };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, trigger, results }),
      };
    }

    // ════════════════════════════════════════════════════
    //  MODE GET — scheduler / batch
    // ════════════════════════════════════════════════════
    if (event.httpMethod === 'GET') {
      const params = event.queryStringParameters || {};

      // ── Tracking checker (cron toutes les 12h)
      if (params.action === 'tracking') {
        if (params.secret !== process.env.REPORT_SECRET) {
          return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
        }
        const trackResult = await runTrackingChecker(sheets, settings);
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, ...trackResult }) };
      }

      // ── Newsletter batch — séquence jours 3 / 5 / 10
      console.log('[Handler] Batch newsletter sequence mode');

      const sentLog     = await loadEmailLog(sheets);
      const accountRows = await sheetRead(
        sheets,
        process.env.SHEET_ID_BBW4LIFE_ACCOUNTS,
        'bbw4life-accounts!A:I'
      );

      console.log(`[Batch] ${accountRows.length} account rows`);

      for (const row of accountRows) {
        const lastName   = (row[0] || '').trim();
        const firstName  = (row[1] || '').trim();
        const email      = (row[2] || '').trim();
        const newsletter = (row[5] || '').trim().toLowerCase();
        const orders     = parseInt(row[6] || 0, 10);

        if (!email || !email.includes('@')) continue;

        const name = firstName || lastName || 'Beautiful';

        if (newsletter === 'yes') {
          // Newsletter #1 — normalement déjà envoyé au moment de la subscription
          // mais on rattrape ici si pas encore envoyé
          if (!wasEmailSent(sentLog, email, T.NEWSLETTER_1)) {
            await trySend(email, T.NEWSLETTER_1,
              () => composeNewsletter1(name, settings),
              sheets, sentLog, results);
            await sleep(600);
            continue;
          }
          // Newsletter #2 — Jour 3
          if (!wasEmailSent(sentLog, email, T.NEWSLETTER_2)) {
            await trySend(email, T.NEWSLETTER_2,
              () => composeNewsletter2(name, settings),
              sheets, sentLog, results);
            await sleep(600);
            continue;
          }
          // Newsletter #3 — Jour 5
          if (!wasEmailSent(sentLog, email, T.NEWSLETTER_3)) {
            await trySend(email, T.NEWSLETTER_3,
              () => composeNewsletter3(name, settings),
              sheets, sentLog, results);
            await sleep(600);
            continue;
          }
          // Newsletter #4 — Jour 10 (buyer vs non-buyer)
          const alreadySent4 = wasEmailSent(sentLog, email, T.NEWSLETTER_4_BUYER) ||
                               wasEmailSent(sentLog, email, T.NEWSLETTER_4_NEW);
          if (!alreadySent4) {
            if (orders > 0) {
              await trySend(email, T.NEWSLETTER_4_BUYER,
                () => composeNewsletter4Buyer(name, settings),
                sheets, sentLog, results);
            } else {
              await trySend(email, T.NEWSLETTER_4_NEW,
                () => composeNewsletter4New(name, settings),
                sheets, sentLog, results);
            }
            await sleep(600);
          }
        }
      }

      const summary = {
        sent:    results.sent.length,
        skipped: results.skipped.length,
        errors:  results.errors.length,
      };
      console.log(`[Batch] Done — sent:${summary.sent} skipped:${summary.skipped} errors:${summary.errors}`);

      return { statusCode: 200, headers, body: JSON.stringify({ success: true, summary, results }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  } catch (fatal) {
    console.error('[Handler] Fatal error:', fatal.message, fatal.stack);
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: fatal.message }) };
  }
};