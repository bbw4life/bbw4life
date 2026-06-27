// netlify/functions/send-email-auto.js
process.removeAllListeners('warning');

const { Resend } = require('resend');
const { google }  = require('googleapis');
const crypto = require('crypto');

// ════════════════════════════════════════════════════════════════
//  ENVIRONMENT
// ════════════════════════════════════════════════════════════════
const BASE_URL   = process.env.BASE_URL   || 'https://bbw4life.com';
const FROM_EMAIL = process.env.FROM_EMAIL || 'BBW4LIFE <hello@bbw4life.com>';

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
  return null; // AI failed — use fallback
}

// ════════════════════════════════════════════════════════════════
//  SETTINGS LOADER — from products.data.json
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
    console.log('[Settings] Loaded from products.data.json');
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
  if (!spreadsheetId) { console.warn(`[Sheets] Missing ID for: ${range}`); return []; }
  try {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    return res.data.values || [];
  } catch (e) {
    console.warn(`[Sheets] Read failed (${range}):`, e.message);
    return [];
  }
}

async function sheetAppend(sheets, spreadsheetId, range, values) {
  if (!spreadsheetId) { console.warn(`[Sheets] Missing ID for append: ${range}`); return; }
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

    const res  = await fetch(url, {
      method:  'GET',
      headers: { 'apiKey': apiKey }
    });

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { return null; }

    if (data.code !== '0' && data.code !== 0) {
      console.warn(`[EPROLO Tracking] API error: ${data.msg}`);
      return null;
    }

    const list  = (data.data && data.data.list) || [];
    const order = list[0];
    if (!order) return null;

    // Tracking est dans logistics[]
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
//  TRACKING SCHEDULER — appelé par cron-job.org toutes les 12h
// ════════════════════════════════════════════════════════════════
async function runTrackingChecker(sheets, settings) {
  console.log('[Tracking] Starting tracking check...');

  const rows = await sheetRead(
    sheets,
    process.env.SHEET_ID_BBW4LIFE_PENDING_ORDERS,
    'bbw4life-pending-orders!A:S'
  );

  if (rows.length <= 1) {
    console.log('[Tracking] No orders found');
    return { checked: 0, found: 0 };
  }

  const now     = new Date();
  let checked   = 0;
  let found     = 0;

  // Regrouper par payment_id pour éviter les doublons
  const processed = new Set();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];

    const internalOrderId = row[0]  || '';
    const paymentId       = row[2]  || '';
    const fullName        = row[3]  || '';
    const email           = row[4]  || '';
    const status          = (row[14] || '').toLowerCase();
    const orderDateStr    = row[16] || '';
    const trackingCol     = row[18] || ''; // Col S = Tracking Number

    // Skip si déjà un tracking ou pas successful
    if (trackingCol)                   continue;
    if (status !== 'successful')       continue;
    if (!email || !email.includes('@')) continue;
    if (processed.has(paymentId))      continue;

    // Vérifier que 24h sont passées depuis la commande
    if (orderDateStr) {
      const orderDate = new Date(orderDateStr);
      const hoursElapsed = (now - orderDate) / (1000 * 60 * 60);
      if (hoursElapsed < 24) {
        console.log(`[Tracking] Order ${internalOrderId} — only ${hoursElapsed.toFixed(1)}h elapsed, skipping`);
        continue;
      }
    }

    checked++;
    processed.add(paymentId);

    // Interroger EPROLO
    const result = await getEproloOrderTracking(internalOrderId);

    if (result && result.trackingNumber) {
      found++;

      // 1. Sauvegarder le tracking dans le sheet (col S = index 18, ligne i+1)
      try {
        await sheets.spreadsheets.values.update({
          spreadsheetId: process.env.SHEET_ID_BBW4LIFE_PENDING_ORDERS,
          range:         `bbw4life-pending-orders!S${i + 1}`,
          valueInputOption: 'RAW',
          resource: { values: [[result.trackingNumber]] }
        });
        console.log(`[Tracking] ✅ Saved tracking ${result.trackingNumber} for order ${internalOrderId}`);
      } catch (e) {
        console.warn('[Tracking] Failed to save tracking:', e.message);
      }

      // 2. Envoyer email tracking au client
      const nameParts = fullName.split(' ');
      const firstName = nameParts[0] || '';
      const lastName  = nameParts.slice(1).join(' ') || '';

      await trySendDirect(email, T.ORDER_TRACKING, async () => {
        return await composeOrderTracking({
          firstName,
          lastName,
          orderId:        internalOrderId,
          trackingNumber: result.trackingNumber,
          carrier:        result.carrier || ''
        }, settings);
      });

      console.log(`[Tracking] ✅ Email sent to ${email}`);

      // Notifier Telegram
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
      } catch (e) {
        console.warn('[Tracking] Telegram notify failed:', e.message);
      }

    } else {
      console.log(`[Tracking] ⏳ No tracking yet for ${internalOrderId}`);
    }

    // Pause entre chaque requête EPROLO
    await sleep(800);
  }

  console.log(`[Tracking] Done — checked: ${checked} | found: ${found}`);
  return { checked, found };
}

// Helper send sans log check (pour tracking — 1 seul envoi par commande grâce au sheet)
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
//  EMAIL DESIGN SYSTEM — BBW4LIFE BRANDED
// ════════════════════════════════════════════════════════════════

// ── Brand colors ──────────────────────────────────────────────
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

// ── Base CSS reset ─────────────────────────────────────────────
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

// ── Settings-driven components ────────────────────────────────
function buildLogoComponent(settings) {
  const logoUrl = (settings.logo_url || settings.logo || '');
  const siteName = 'BBW4LIFE';
  if (logoUrl) {
    return `<a href="${BASE_URL}" target="_blank" style="display:inline-block;text-decoration:none;margin-bottom:20px;">
      <img src="${logoUrl}" alt="${siteName}" height="60" style="height:60px;width:auto;max-width:200px;display:block;">
    </a>`;
  }
  // Text fallback
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

  const SVG = {
    facebook:  `<svg width="20" height="20" viewBox="0 0 512 509.64" xmlns="http://www.w3.org/2000/svg"><rect fill="#0866FF" width="512" height="509.64" rx="115.612" ry="115.612"/><path fill="#fff" d="M287.015 509.64h-92.858V332.805h-52.79v-78.229h52.79v-33.709c0-87.134 39.432-127.522 124.977-127.522 16.217 0 44.203 3.181 55.651 6.361v70.915c-6.043-.636-16.536-.953-29.576-.953-41.976 0-58.194 15.9-58.194 57.241v27.667h83.618l-14.365 78.229h-69.253V509.64z"/></svg>`,
    instagram: `<svg width="20" height="20" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><path fill-rule="nonzero" d="M170.663 256.157c-.083-47.121 38.055-85.4 85.167-85.482 47.121-.092 85.407 38.029 85.499 85.159.091 47.13-38.047 85.4-85.176 85.492-47.112.09-85.399-38.039-85.49-85.169zm-46.108.092c.141 72.602 59.106 131.327 131.69 131.185 72.592-.14 131.35-59.089 131.209-131.691-.141-72.577-59.114-131.336-131.715-131.194-72.585.141-131.325 59.114-131.184 131.7zm237.104-137.092c.033 16.954 13.817 30.682 30.772 30.649 16.961-.034 30.689-13.811 30.664-30.765-.033-16.954-13.818-30.69-30.78-30.656-16.962.033-30.689 13.818-30.656 30.772zm-208.696 345.4c-24.958-1.086-38.511-5.234-47.543-8.709-11.961-4.628-20.496-10.177-29.479-19.093-8.966-8.951-14.532-17.461-19.202-29.397-3.508-9.033-7.73-22.569-8.9-47.527-1.269-26.983-1.559-35.078-1.683-103.433-.133-68.338.116-76.434 1.294-103.441 1.069-24.941 5.242-38.512 8.709-47.536 4.628-11.977 10.161-20.496 19.094-29.478 8.949-8.983 17.459-14.532 29.403-19.202 9.025-3.526 22.561-7.715 47.511-8.9 26.998-1.278 35.085-1.551 103.423-1.684 68.353-.133 76.448.108 103.456 1.294 24.94 1.086 38.51 5.217 47.527 8.709 11.968 4.628 20.503 10.145 29.478 19.094 8.974 8.95 14.54 17.443 19.21 29.413 3.524 8.999 7.714 22.552 8.892 47.494 1.285 26.998 1.576 35.094 1.7 103.432.132 68.355-.117 76.451-1.302 103.442-1.087 24.957-5.226 38.52-8.709 47.56-4.629 11.953-10.161 20.488-19.103 29.471-8.941 8.949-17.451 14.531-29.403 19.201-9.009 3.517-22.561 7.714-47.494 8.9-26.998 1.269-35.086 1.56-103.448 1.684-68.338.133-76.424-.124-103.431-1.294zM149.977 1.773c-27.239 1.286-45.843 5.648-62.101 12.019-16.829 6.561-31.095 15.353-45.286 29.603C28.381 57.653 19.655 71.944 13.144 88.79c-6.303 16.299-10.575 34.912-11.778 62.168C.172 178.264-.102 186.973.031 256.489c.133 69.508.439 78.234 1.741 105.548 1.302 27.231 5.649 45.827 12.019 62.092 6.569 16.83 15.353 31.089 29.611 45.289 14.25 14.2 28.55 22.918 45.404 29.438 16.282 6.294 34.902 10.583 62.15 11.777 27.305 1.203 36.022 1.468 105.521 1.336 69.532-.133 78.25-.44 105.555-1.734 27.239-1.302 45.826-5.664 62.1-12.019 16.829-6.585 31.095-15.353 45.288-29.611 14.191-14.251 22.917-28.55 29.428-45.404 6.304-16.282 10.592-34.904 11.777-62.134 1.195-27.323 1.478-36.049 1.344-105.557-.133-69.516-.447-78.225-1.741-105.522-1.294-27.256-5.657-45.844-12.019-62.118-6.577-16.829-15.352-31.08-29.602-45.288-14.25-14.192-28.55-22.935-45.404-29.429-16.29-6.304-34.903-10.6-62.15-11.778C333.747.164 325.03-.101 255.506.031c-69.507.133-78.224.431-105.529 1.742z" fill="#fff"/></svg>`,
    tiktok:    `<svg width="20" height="20" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><path fill="#2DCCD3" fill-rule="nonzero" d="M344.487 161.312c11.585 11.945 26.033 19.226 40.593 22.539v-8.971c-13.681-.969-27.993-5.274-40.593-13.568zm-83.689-59.166v200.601c0 26.281-18.888 43.185-41.855 43.185-7.619 0-14.854-1.781-21.142-5.071 7.979 10.188 20.578 16.048 34.395 16.048 22.968 0 41.855-16.905 41.855-43.208V113.1h36.401a100.278 100.278 0 01-2.434-10.954h-47.22zm-29.864 116.618v-9.939c-4.599-.766-9.196-1.015-13.006-1.015-51.818 0-95.206 41.586-95.206 93.155 0 33.855 16.476 62.795 41.517 79.926-17.445-17.31-28.264-41.54-28.264-68.971 0-51.48 43.253-93.043 94.959-93.156z"/><path fill="#F1204A" fill-rule="nonzero" d="M313.36 299.433c0 64.057-49.001 98.002-95.184 98.002-19.992 0-38.564-6.041-53.937-16.545 17.266 17.131 41.022 27.499 67.19 27.499 46.184 0 95.184-33.945 95.184-98.002v-104.38c-4.597-3.11-9.015-6.739-13.253-10.976v104.402zM197.801 340.86c-5.635-7.122-8.994-16.341-8.994-27.159 0-30.361 23.734-46.409 55.38-43.073v-50.849c-4.598-.766-9.196-1.014-13.028-1.014h-.226v40.886c-31.644-3.313-55.379 12.712-55.379 43.096 0 17.761 9.084 31.239 22.247 38.113zM385.08 183.851v37.979c-21.029 0-40.931-4.012-58.467-15.823 20.421 20.421 45.192 26.8 71.721 26.8v-46.972a82.367 82.367 0 01-13.254-1.984zm-40.593-22.54c-11.202-11.517-19.745-27.385-23.215-48.211h-10.819c6.176 22.517 18.888 38.227 34.034 48.211z"/><path fill="#fff" fill-rule="nonzero" d="M218.176 397.435c46.183 0 95.184-33.944 95.184-98.002V195.031c4.238 4.237 8.655 7.866 13.253 10.976 17.536 11.811 37.438 15.823 58.468 15.823v-37.979c-14.561-3.313-29.009-10.593-40.594-22.54-15.146-9.984-27.859-25.694-34.034-48.211h-36.402v200.601c0 26.303-18.888 43.208-41.856 43.208-13.816 0-26.415-5.86-34.394-16.048-13.163-6.875-22.247-20.353-22.247-38.114 0-30.384 23.734-46.409 55.379-43.096v-40.887c-51.705.113-94.958 41.676-94.958 93.156 0 27.431 10.819 51.661 28.264 68.971 15.372 10.503 33.945 16.544 53.937 16.544z"/></svg>`,
    youtube:   `<svg width="20" height="20" viewBox="0 0 124.08 123.51" xmlns="http://www.w3.org/2000/svg"><path fill="#fff" d="M28.35.6H95.73a27.83,27.83,0,0,1,27.75,27.75V95.17a27.83,27.83,0,0,1-27.75,27.74H28.35A27.83,27.83,0,0,1,.6,95.17V28.35A27.83,27.83,0,0,1,28.35.6Z"/><path fill="red" fill-rule="evenodd" d="M104.91,44.26s-.85-6-3.48-8.69c-3.33-3.48-7.07-3.5-8.77-3.71C80.42,31,62,31,62,31h0s-18.37,0-30.62.89c-1.71.21-5.44.23-8.77,3.71-2.63,2.65-3.47,8.69-3.47,8.69a133.12,133.12,0,0,0-.87,14.17v6.64a133.37,133.37,0,0,0,.87,14.17s.86,6,3.47,8.69c3.33,3.48,7.71,3.37,9.67,3.74,7,.67,29.76.87,29.76.87s18.4,0,30.64-.91c1.71-.2,5.44-.22,8.77-3.7,2.63-2.65,3.49-8.69,3.49-8.69a133.18,133.18,0,0,0,.87-14.18V58.43a136.86,136.86,0,0,0-.89-14.18Z"/><polygon fill="#fff" points="52.97 73.11 52.97 48.51 76.61 60.86 52.97 73.11 52.97 73.11"/></svg>`,
    pinterest: `<svg width="20" height="20" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><path fill="#E60019" fill-rule="nonzero" d="M0 256c0 109.29 68.5 202.6 164.91 239.32-2.35-19.99-4.84-52.95.53-76.07 4.63-19.89 29.89-126.68 29.89-126.68s-7.62-15.25-7.62-37.85c0-35.41 20.53-61.87 46.11-61.87 21.76 0 32.25 16.33 32.25 35.89 0 21.87-13.93 54.55-21.12 84.87-5.99 25.36 12.74 46.05 37.74 46.05 45.29 0 80.13-47.77 80.13-116.71 0-61.04-43.86-103.68-106.48-103.68-72.48 0-115.04 54.38-115.04 110.59 0 21.91 8.42 45.38 18.96 58.16a7.568 7.568 0 012.07 5.21c0 .7-.1 1.41-.29 2.09-1.94 8.07-6.26 25.37-7.08 28.9-1.13 4.65-3.69 5.66-8.54 3.4-31.82-14.81-51.71-61.34-51.71-98.71 0-80.41 58.4-154.22 168.36-154.22 88.41 0 157.13 63 157.13 147.18 0 87.83-55.37 158.53-132.25 158.53-25.84 0-50.09-13.45-58.41-29.3 0 0-12.78 48.68-15.88 60.59-6.01 23.13-22.7 52.39-33.04 69.01 23.84 7.36 49.14 11.3 75.38 11.3 141.38 0 256-114.63 256-256S397.38 0 256 0 0 114.62 0 256z"/></svg>`,
    twitter:   `<svg width="20" height="20" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><path d="M256 0c141.385 0 256 114.615 256 256S397.385 512 256 512 0 397.385 0 256 114.615 0 256 0z"/><path fill="#fff" fill-rule="nonzero" d="M318.64 157.549h33.401l-72.973 83.407 85.85 113.495h-67.222l-52.647-68.836-60.242 68.836h-33.423l78.052-89.212-82.354-107.69h68.924l47.59 62.917 55.044-62.917zm-11.724 176.908h18.51L205.95 176.493h-19.86l120.826 157.964z"/></svg>`,
    whatsapp:  `<svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="12" fill="#25D366"/><path fill="#fff" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>`
  };

  const links = [
    { key: 'facebook',  label: 'Facebook'  },
    { key: 'instagram', label: 'Instagram', bg: '#c9963e' },
    { key: 'tiktok',    label: 'TikTok',    bg: '#0d0d0d' },
    { key: 'youtube',   label: 'YouTube',   bg: '#0d0d0d' },
    { key: 'pinterest', label: 'Pinterest' },
    { key: 'twitter',   label: 'X',         bg: '#0d0d0d' },
    { key: 'whatsapp',  label: 'WhatsApp'  },
  ].filter(l => social[l.key]);

  if (!links.length) return '';

  return `
<table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto 16px;">
  <tr>
    ${links.map(l => `
    <td style="padding:0 5px;">
      <a href="${social[l.key]}" target="_blank"
         style="display:inline-block;width:36px;height:36px;border-radius:8px;
                background:${l.bg || 'rgba(255,255,255,0.12)'};
                text-align:center;line-height:36px;text-decoration:none;">
        ${SVG[l.key]}
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

// ── Master template wrapper ────────────────────────────────────
function masterTemplate({ preheader, headerGrad, topBadge, headline, subHeadline, bodyHTML, settings, showCEO = false }) {
  const logoHTML   = buildLogoComponent(settings);
  const socialHTML = buildSocialFooter(settings);
  const ceoHTML    = showCEO ? buildCEOSignature(settings) : '';
  const support    = (settings.contact_emails || {}).general || (settings.contact || {}).email || 'support@bbw4life.com';
  const whatsapp   = (settings.contact || {}).whatsapp_url || 'https://wa.me/18292677434';

  const grad = headerGrad || `background:linear-gradient(145deg,${BBW.dark2} 0%,${BBW.rose} 50%,${BBW.gold} 100%)`;

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

<!-- Preheader -->
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
                <h1 class="eh1" style="margin:0 0 0;font-family:Georgia,serif;font-size:28px;
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

// ── Reusable HTML components ──────────────────────────────────
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
  const bd = `rgba(192,56,94,0.18)`;
  return `
<table width="100%" cellpadding="0" cellspacing="0" role="presentation"
       style="margin:0 0 14px;border-radius:14px;overflow:hidden;background:${bg};border:1px solid ${bd};">
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
           alt="${item.title}">
    </td>` : ''}
    <td style="padding:14px 16px;vertical-align:middle;">
      <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:13px;font-weight:700;color:${BBW.dark};">${item.title}</p>
      ${item.size  ? `<p style="margin:0 0 2px;font-family:Arial,sans-serif;font-size:12px;color:${BBW.textLight};">Size: ${item.size}</p>`  : ''}
      ${item.color ? `<p style="margin:0 0 2px;font-family:Arial,sans-serif;font-size:12px;color:${BBW.textLight};">Color: ${item.color}</p>` : ''}
      <p style="margin:4px 0 0;font-family:Arial,sans-serif;font-size:12px;color:${BBW.textLight};">
        Qty: ${item.quantity} &nbsp;·&nbsp;
        <span style="color:${BBW.rose};font-weight:700;">$${parseFloat(item.price * item.quantity).toFixed(2)}</span>
      </p>
    </td>
  </tr>
</table>`;
}

// ════════════════════════════════════════════════════════════════
//  AI COPY GENERATORS — with fallbacks
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
Write 1 paragraph (2-3 sentences): Thank her for the order. Express genuine excitement. Mention order is being prepared.
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
- Para 1 (2 sentences): Notice she left something behind in her cart. Warm, curious tone, not guilt-tripping. Ask gently what held her back.
- Para 2 (2 sentences): Reassure her items are saved and waiting. Mention a special gift below to help her finish her order.
Plain text only, no greeting, no sign-off.`
  );
  return copy || `We noticed you left something behind in your cart — and we just wanted to check in. Sometimes life gets busy, or maybe something wasn't quite clear, and we'd genuinely love to know if there's anything we can help with.\n\nYour items are safely saved and waiting for you, exactly where you left them. To make it even easier to come back, we've added a little gift below just for you.`;
}

// ════════════════════════════════════════════════════════════════
//  EMAIL COMPOSERS
// ════════════════════════════════════════════════════════════════

// ── 1. Welcome Email ──────────────────────────────────────────
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
      preheader:    `You're officially part of the BBW4LIFE family — and we built this for exactly you.`,
      headerGrad:   `background:linear-gradient(145deg,${BBW.dark2} 0%,${BBW.plum} 40%,${BBW.rose} 80%,${BBW.gold} 100%)`,
      topBadge:     'Welcome to the family',
      headline:     'You made it. 👑',
      subHeadline:  'BBW4LIFE was built for women exactly like you.',
      bodyHTML,
      settings,
      showCEO:      true,
    }),
  };
}

// ── 2. Order Confirmation ─────────────────────────────────────
async function composeOrderConfirm(data, settings) {
  const { firstName, lastName, email, orderId, items = [], total, shippingAddress } = data;
  const name = firstName || lastName || 'Beautiful';
  const copy = await genOrderConfirmCopy(name);

  const itemsHTML = items.map(item => cOrderItem(item)).join('');

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
      preheader:    `Your order has been confirmed — we're already preparing it with care.`,
      headerGrad:   `background:linear-gradient(145deg,${BBW.dark2} 0%,${BBW.rose} 60%,${BBW.gold} 100%)`,
      topBadge:     'Order Confirmed',
      headline:     'Thank you for your order! 🛍️',
      subHeadline:  'We\'re preparing your package with love.',
      bodyHTML,
      settings,
    }),
  };
}

// ── 3. Order Tracking ─────────────────────────────────────────
async function composeOrderTracking(data, settings) {
  const { firstName, lastName, orderId, trackingNumber, carrier } = data;
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
    ${cCTA('Track My Order →', data.trackingUrl || `${BASE_URL}/page/order-tracking.html`)}
    ${cDivider()}
    <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:${BBW.textLight};text-align:center;">
      Order: <strong style="color:${BBW.dark};">#${orderId || 'BBW4LIFE'}</strong>
    </p>`;

  return {
    subject: `Your BBW4LIFE order is on its way! 🚚 Tracking: ${trackingNumber}`,
    html: masterTemplate({
      preheader:    `Your order has shipped — here's your tracking number: ${trackingNumber}`,
      headerGrad:   `background:linear-gradient(145deg,${BBW.dark2} 0%,${BBW.plum} 50%,${BBW.rose} 100%)`,
      topBadge:     'Order Shipped',
      headline:     'Your order is on its way! 🚚',
      subHeadline:  'Track your package and watch the magic happen.',
      bodyHTML,
      settings,
    }),
  };
}

// ── 4. Newsletter #1 — Immediate ──────────────────────────────
async function composeNewsletter1(firstName, settings) {
  const name = firstName || 'Beautiful';
  const copy = await genNewsletter1Copy(name);
  const promos = (settings.promos || []);
  const promo  = promos[0];

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
    ${cHighlightBox('✨', 'New Arrivals First', 'You\'ll always be the first to know.', '#f0f8fd')}
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
      preheader:    `Your subscription is confirmed — exclusive tips, deals, and real stories incoming.`,
      headerGrad:   `background:linear-gradient(145deg,${BBW.dark2} 0%,${BBW.rose} 55%,${BBW.gold} 100%)`,
      topBadge:     'Newsletter Confirmed',
      headline:     "You're officially inside. 💕",
      subHeadline:  'The best of BBW4LIFE, delivered to your inbox.',
      bodyHTML,
      settings,
      showCEO:      true,
    }),
  };
}

// ── 5. Newsletter #2 — Day 3 ──────────────────────────────────
async function composeNewsletter2(firstName, settings) {
  const name = firstName || 'Beautiful';
  const copy = await genNewsletter2Copy(name);
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
      preheader:    `We'd love to hear from you — your feedback shapes everything we do.`,
      headerGrad:   `background:linear-gradient(145deg,${BBW.dark2} 0%,${BBW.plum} 50%,${BBW.rose} 100%)`,
      topBadge:     'Just Checking In',
      headline:     "How's it going? 💬",
      subHeadline:  'Your feedback genuinely shapes what we do.',
      bodyHTML,
      settings,
      showCEO:      true,
    }),
  };
}

// ── 6. Newsletter #3 — Day 5 ──────────────────────────────────
async function composeNewsletter3(firstName, settings) {
  const name = firstName || 'Beautiful';
  const copy = await genNewsletter3Copy(name);
  const promos = settings.promos || [];
  const promo  = promos[1] || promos[0];

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
      preheader:    `Bundles, favorites, and exclusive promotions — all waiting for you.`,
      headerGrad:   `background:linear-gradient(145deg,${BBW.dark2} 0%,${BBW.rose} 45%,${BBW.plum} 100%)`,
      topBadge:     'Community Favorites',
      headline:     "You deserve the best. 🔥",
      subHeadline:  'Bundles, promotions, and our community\'s top picks.',
      bodyHTML,
      settings,
    }),
  };
}

// ── 7. Newsletter #4 — Day 10 (Buyer) ────────────────────────
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
      preheader:    `We appreciate you and we'd love to hear about your experience.`,
      headerGrad:   `background:linear-gradient(145deg,${BBW.dark2} 0%,${BBW.gold} 50%,${BBW.rose} 100%)`,
      topBadge:     'Customer Appreciation',
      headline:     "Thank you for trusting us. 💕",
      subHeadline:  'Your experience matters to us more than anything.',
      bodyHTML,
      settings,
      showCEO:      true,
    }),
  };
}

// ── 8. Newsletter #4 — Day 10 (Non-Buyer) ────────────────────
async function composeNewsletter4New(firstName, settings) {
  const name = firstName || 'Beautiful';
  const copy = await genNewsletter4NewCopy(name);
  const promos = settings.promos || [];
  const promo  = promos[0];

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
      preheader:    `We prepared something special for you — an exclusive discount waiting inside.`,
      headerGrad:   `background:linear-gradient(145deg,${BBW.dark2} 0%,${BBW.rose} 50%,${BBW.gold} 100%)`,
      topBadge:     'Exclusive Offer',
      headline:     "This is just for you. 🎁",
      subHeadline:  'A special gift from the BBW4LIFE family.',
      bodyHTML,
      settings,
      showCEO:      true,
    }),
  };
}

// ── 9. Contact Auto-Reply ─────────────────────────────────────
async function composeContactReply(data, settings) {
  const { firstName, lastName, subject: msgSubject, category } = data;
  const name = firstName || lastName || 'Beautiful';
  const copy = await genContactReplyCopy(name);
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
      preheader:    `Your message has been received — our team will respond within 24-48 hours.`,
      headerGrad:   `background:linear-gradient(145deg,${BBW.dark2} 0%,${BBW.plum} 50%,${BBW.rose} 100%)`,
      topBadge:     'Support',
      headline:     'Message received! ✅',
      subHeadline:  'Our team will respond within 24 to 48 hours.',
      bodyHTML,
      settings,
    }),
  };
}

// ── 10. Plan/Product Request ──────────────────────────────────
async function composePlanRequest(data, settings) {
  const { firstName, lastName, program, productId, size, color } = data;
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
          <p style="margin:0 0 6px;font-family:Georgia,serif;font-size:15px;font-weight:700;color:#fff;">${program}</p>
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
      preheader:    `We've received your request for ${program} — our team will review it soon.`,
      headerGrad:   `background:linear-gradient(145deg,${BBW.dark2} 0%,${BBW.plum} 50%,${BBW.gold} 100%)`,
      topBadge:     'Request Confirmed',
      headline:     "We've got your request! ⏳",
      subHeadline:  'Our team is on it — we\'ll be in touch very soon.',
      bodyHTML,
      settings,
    }),
  };
}

// ── 11. Custom Product Request ────────────────────────────────
async function composeCustomProduct(data, settings) {
  const { firstname, lastname, email, product_title, product_desc } = data;
  const name = firstname || lastname || 'Beautiful';
  const copy = await genCustomProductCopy(name, product_title);

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
            ${product_title || 'Your Custom Product'}
          </p>
          ${product_desc ? `<p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:rgba(255,255,255,0.65);line-height:1.5;">${product_desc.substring(0, 100)}${product_desc.length > 100 ? '...' : ''}</p>` : ''}
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
      preheader:    `Your custom product idea has been received — our design team is reviewing it.`,
      headerGrad:   `background:linear-gradient(145deg,${BBW.dark2} 0%,${BBW.rose} 50%,${BBW.plum} 100%)`,
      topBadge:     'Design Request',
      headline:     "We love your vision! 🎨",
      subHeadline:  'Our design team will review your personalized product idea.',
      bodyHTML,
      settings,
      showCEO:      true,
    }),
  };
}

// ── 12. Abandoned Cart Recovery ───────────────────────────────
async function composeCartAbandoned(data, settings) {
  const { firstName, lastName, items = [], promoCode, promoPercent, restartLink } = data;
  const name = firstName || lastName || 'Beautiful';
  const copy = await genCartAbandonedCopy(name);

  const itemsHTML = items.map(item => cOrderItem(item)).join('');
  const finalRestartLink = restartLink || `${BASE_URL}/checkout.html`;

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
    ${cCTA('Restart My Order →', finalRestartLink)}
    ${cDivider()}
    <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:${BBW.textLight};text-align:center;">
      Beauty Has No Sizes — and your spot in the BBW4LIFE family is still waiting. 👑
    </p>`;

  return {
    subject: `${name}, you left something beautiful behind 🛍️`,
    html: masterTemplate({
      preheader:    `Your cart is saved and waiting — plus a little gift to welcome you back.`,
      headerGrad:   `background:linear-gradient(145deg,${BBW.dark2} 0%,${BBW.rose} 50%,${BBW.gold} 100%)`,
      topBadge:     'Cart Saved For You',
      headline:     "Don't forget this. 🛍️",
      subHeadline:  'Your items are exactly where you left them.',
      bodyHTML,
      settings,
      showCEO:      true,
    }),
  };
}

// ════════════════════════════════════════════════════════════════
//  SEND HELPER — with log check
// ════════════════════════════════════════════════════════════════
async function trySend(email, type, composeFn, sheets, sentLog, results, ...args) {
  if (!email || !email.includes('@')) {
    console.warn(`[trySend] Invalid email: "${email}"`);
    return false;
  }
  if (wasEmailSent(sentLog, email, type)) {
    results.skipped.push({ email, type, reason: 'already sent' });
    return false;
  }
  try {
    console.log(`[trySend] Composing ${type} for ${email}`);
    const { subject, html } = await composeFn(...args);
    const ok = await deliver(email, subject, html);
    if (ok) {
      await markEmailSent(sheets, email, type);
      sentLog.add(`${email.toLowerCase()}||${type}`);
      results.sent.push({ email, type });
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
    // Load settings once
    const settings = await loadSettings();
    const sheets   = getSheets();
    const sentLog  = await loadEmailLog(sheets);

    // ── TRIGGER MODE (POST) ────────────────────────────────
    if (event.httpMethod === 'POST' && event.body) {
      const body    = JSON.parse(event.body);
      const trigger = body.trigger;

      if (!trigger) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'trigger required' }) };
      }

      console.log(`[Handler] Trigger: ${trigger}`);

      const email = body.email;
      if (!email || !email.includes('@')) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Valid email required' }) };
      }

      // ── Welcome ──
      if (trigger === T.WELCOME) {
        await trySend(email, T.WELCOME, () => composeWelcome(body.firstName, settings), sheets, sentLog, results);
      }

      // ── Order Confirmation ──
      if (trigger === T.ORDER_CONFIRM) {
        await trySend(email, T.ORDER_CONFIRM,
          () => composeOrderConfirm(body, settings),
          sheets, sentLog, results);
      }

      // ── Order Tracking ──
      if (trigger === T.ORDER_TRACKING) {
        await trySend(email, T.ORDER_TRACKING,
          () => composeOrderTracking(body, settings),
          sheets, sentLog, results);
      }

      // ── Newsletter #1 ──
      if (trigger === T.NEWSLETTER_1) {
        await trySend(email, T.NEWSLETTER_1,
          () => composeNewsletter1(body.firstName, settings),
          sheets, sentLog, results);
      }

      // ── Newsletter #2 ──
      if (trigger === T.NEWSLETTER_2) {
        await trySend(email, T.NEWSLETTER_2,
          () => composeNewsletter2(body.firstName, settings),
          sheets, sentLog, results);
      }

      // ── Newsletter #3 ──
      if (trigger === T.NEWSLETTER_3) {
        await trySend(email, T.NEWSLETTER_3,
          () => composeNewsletter3(body.firstName, settings),
          sheets, sentLog, results);
      }

      // ── Newsletter #4 — Buyer ──
      if (trigger === T.NEWSLETTER_4_BUYER) {
        await trySend(email, T.NEWSLETTER_4_BUYER,
          () => composeNewsletter4Buyer(body.firstName, settings),
          sheets, sentLog, results);
      }

      // ── Newsletter #4 — New (non-buyer) ──
      if (trigger === T.NEWSLETTER_4_NEW) {
        await trySend(email, T.NEWSLETTER_4_NEW,
          () => composeNewsletter4New(body.firstName, settings),
          sheets, sentLog, results);
      }

      // ── Contact Reply ──
      if (trigger === T.CONTACT_REPLY) {
        await trySend(email, T.CONTACT_REPLY,
          () => composeContactReply(body, settings),
          sheets, sentLog, results);
      }

      // ── Plan Request ──
      if (trigger === T.PLAN_REQUEST) {
        await trySend(email, T.PLAN_REQUEST,
          () => composePlanRequest(body, settings),
          sheets, sentLog, results);
      }

      // ── Custom Product ──
      if (trigger === T.CUSTOM_PRODUCT) {
        await trySend(email, T.CUSTOM_PRODUCT,
          () => composeCustomProduct(body, settings),
          sheets, sentLog, results);
      }

      // ── Cart Abandoned ──
      if (trigger === T.CART_ABANDONED) {
        await trySend(email, T.CART_ABANDONED,
          () => composeCartAbandoned(body, settings),
          sheets, sentLog, results);
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, trigger, results }),
      };
    }

    // ── BATCH / SCHEDULER MODE (GET) ──────────────────────

    if (event.httpMethod === 'GET') {
      const params = event.queryStringParameters || {};

      // ── Tracking checker (appelé par cron toutes les 12h) ──
      if (params.action === 'tracking') {
        const secret = params.secret;
        if (secret !== process.env.REPORT_SECRET) {
          return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
        }
        const trackResult = await runTrackingChecker(sheets, settings);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, ...trackResult })
        };
      }

      // ── Newsletter batch (existant) ──
      console.log('[Handler] Batch newsletter sequence mode');

      const accountRows = await sheetRead(
        sheets,
        process.env.SHEET_ID_BBW4LIFE_ACCOUNTS,
        'bbw4life-accounts!A:I'
      );

      console.log(`[Batch] ${accountRows.length} account rows`);

      for (const row of accountRows) {
        // A=LastName B=FirstName C=Email F=Newsletter G=Orders H=TotalSpent
        const lastName   = (row[0] || '').trim();
        const firstName  = (row[1] || '').trim();
        const email      = (row[2] || '').trim();
        const newsletter = (row[5] || '').trim().toLowerCase();
        const orders     = parseInt(row[6] || 0, 10);

        if (!email || !email.includes('@')) continue;

        const name = firstName || lastName || 'Beautiful';

        // Newsletter sequence
        if (newsletter === 'yes') {
          if (!wasEmailSent(sentLog, email, T.NEWSLETTER_1)) {
            await trySend(email, T.NEWSLETTER_1,
              () => composeNewsletter1(name, settings),
              sheets, sentLog, results);
            await sleep(500); continue;
          }
          if (!wasEmailSent(sentLog, email, T.NEWSLETTER_2)) {
            await trySend(email, T.NEWSLETTER_2,
              () => composeNewsletter2(name, settings),
              sheets, sentLog, results);
            await sleep(500); continue;
          }
          if (!wasEmailSent(sentLog, email, T.NEWSLETTER_3)) {
            await trySend(email, T.NEWSLETTER_3,
              () => composeNewsletter3(name, settings),
              sheets, sentLog, results);
            await sleep(500); continue;
          }

          // Day 10 — check if buyer or not
          const type10 = orders > 0 ? T.NEWSLETTER_4_BUYER : T.NEWSLETTER_4_NEW;
          if (!wasEmailSent(sentLog, email, T.NEWSLETTER_4_BUYER) &&
              !wasEmailSent(sentLog, email, T.NEWSLETTER_4_NEW)) {
            if (orders > 0) {
              await trySend(email, T.NEWSLETTER_4_BUYER,
                () => composeNewsletter4Buyer(name, settings),
                sheets, sentLog, results);
            } else {
              await trySend(email, T.NEWSLETTER_4_NEW,
                () => composeNewsletter4New(name, settings),
                sheets, sentLog, results);
            }
            await sleep(500);
          }
        }
      }

      const summary = {
        sent:    results.sent.length,
        skipped: results.skipped.length,
        errors:  results.errors.length,
      };
      console.log(`[Batch] Done — sent:${summary.sent} skipped:${summary.skipped} errors:${summary.errors}`);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, summary, results }),
      };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  } catch (fatal) {
    console.error('[Handler] Fatal error:', fatal.message, fatal.stack);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: fatal.message }),
    };
  }
};