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
  const links  = [
    { key: 'facebook',  emoji: '📘', label: 'Facebook'  },
    { key: 'instagram', emoji: '📸', label: 'Instagram' },
    { key: 'tiktok',    emoji: '🎵', label: 'TikTok'    },
    { key: 'youtube',   emoji: '▶️',  label: 'YouTube'   },
    { key: 'pinterest', emoji: '📌', label: 'Pinterest' },
    { key: 'twitter',   emoji: '🐦', label: 'X'         },
    { key: 'whatsapp',  emoji: '💬', label: 'WhatsApp'  },
  ].filter(l => social[l.key]);

  if (!links.length) return '';

  return `
<table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto 16px;">
  <tr>
    ${links.map(l => `
    <td style="padding:0 5px;">
      <a href="${social[l.key]}" target="_blank"
         style="display:inline-block;width:36px;height:36px;border-radius:8px;
                background:rgba(192,56,94,0.18);border:1px solid rgba(192,56,94,0.30);
                text-align:center;line-height:36px;font-size:16px;text-decoration:none;">
        ${l.emoji}
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

      // ── Contact Reply ──
      if (trigger === 'contact_reply') {
        await trySend(email, 'contact_reply',
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