// netlify/functions/send-email-auto.js
process.removeAllListeners('warning');

const { Resend } = require('resend');
const { google }  = require('googleapis');
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
  CONFIRM_ACCOUNT:    'confirm_account',
  STORY_RECEIVED:     'story_received',
  REVIEW_RESPONSE:    'review_response',
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
//  CJ — AUTH + TRACKING CHECKER
// ════════════════════════════════════════════════════════════════
async function getCJAccessToken() {
  const res = await fetch('https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: process.env.CJ_API_KEY })
  });
  const data = await res.json();
  if (!data.result || !data.data?.accessToken) {
    throw new Error('CJ auth failed: ' + (data.message || JSON.stringify(data)));
  }
  return data.data.accessToken;
}

async function getCJOrderTracking(cjOrderId, token) {
  try {
    const url = `https://developers.cjdropshipping.com/api2.0/v1/shopping/order/getOrderDetail?orderId=${encodeURIComponent(cjOrderId)}`;
    const res = await fetch(url, {
      method:  'GET',
      headers: { 'CJ-Access-Token': token }
    });
    const text = await res.text();

    let data;
    try { data = JSON.parse(text); } catch { return null; }

    if (data.result !== true || !data.data) {
      console.warn(`[CJ Tracking] API error: ${data.message}`);
      return null;
    }

    const trackNumber = data.data.trackNumber;
    if (!trackNumber) return null;

    return {
      trackingNumber: trackNumber,
      carrier:        data.data.logisticName || null,
      trackingUrl:    null
    };
  } catch (e) {
    console.warn('[CJ Tracking] Error:', e.message);
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
    'bbw4life-pending-orders!A:V'
  );

  if (rows.length <= 1) {
    console.log('[Tracking] No orders found');
    return { checked: 0, found: 0 };
  }

  const now     = new Date();
  let checked   = 0;
  let found     = 0;
  let cjToken   = null; // ── récupéré à la volée, une seule fois, si besoin ──

  const processed = new Set();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];

    const internalOrderId   = row[0]  || '';
    const paymentId         = row[2]  || '';
    const fullName          = row[3]  || '';
    const email              = row[4]  || '';
    const status             = (row[14] || '').toLowerCase();
    const orderDateStr       = row[16] || '';
    const trackingCol        = row[18] || '';
    const fulfillmentMethod  = (row[19] || 'eprolo').toLowerCase().trim();
    const cjOrderId          = row[21] || '';

    if (trackingCol)                   continue;
    if (status !== 'successful')       continue;
    if (!email || !email.includes('@')) continue;
    if (processed.has(paymentId))      continue;

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

    let result = null;

    if (fulfillmentMethod === 'cj') {
      if (!cjOrderId) {
        console.log(`[Tracking] ⚠️ CJ order ${internalOrderId} — cj_order_id manquant en colonne V, skip`);
      } else {
        try {
          if (!cjToken) cjToken = await getCJAccessToken();
          result = await getCJOrderTracking(cjOrderId, cjToken);
        } catch (e) {
          console.warn('[Tracking] CJ auth/tracking error:', e.message);
        }
      }
    } else {
      result = await getEproloOrderTracking(internalOrderId);
    }

    if (result && result.trackingNumber) {
      found++;

      try {
        await sheets.spreadsheets.values.update({
          spreadsheetId: process.env.SHEET_ID_BBW4LIFE_PENDING_ORDERS,
          range:         `bbw4life-pending-orders!S${i + 1}`,
          valueInputOption: 'RAW',
          resource: { values: [[result.trackingNumber]] }
        });
        console.log(`[Tracking] ✅ Saved tracking ${result.trackingNumber} for order ${internalOrderId} (${fulfillmentMethod.toUpperCase()})`);
      } catch (e) {
        console.warn('[Tracking] Failed to save tracking:', e.message);
      }

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

      try {
        await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            chat_id:    process.env.TELEGRAM_CHAT_ID,
            text:       `📦 <b>Tracking trouvé! (${fulfillmentMethod.toUpperCase()})</b>\n\n👤 <b>Client:</b> ${fullName}\n📧 <b>Email:</b> ${email}\n🔢 <b>Tracking:</b> ${result.trackingNumber}\n🚚 <b>Carrier:</b> ${result.carrier || 'N/A'}`,
            parse_mode: 'HTML'
          })
        });
      } catch (e) {
        console.warn('[Tracking] Telegram notify failed:', e.message);
      }

    } else {
      console.log(`[Tracking] ⏳ No tracking yet for ${internalOrderId} (${fulfillmentMethod.toUpperCase()})`);
    }

    await sleep(800);
  }

  console.log(`[Tracking] Done — checked: ${checked} | found: ${found}`);
  return { checked, found };
}


async function runEmailQueueProcessor(sheets, sentLog, settings) {
  console.log('[Queue] Checking scheduled emails...');
  const rows = await sheetRead(
    sheets,
    process.env.SHEET_ID_BBW4LIFE_ACCOUNTS,
    'bbw4life-accounts!A:AJ'
  );

  if (!rows.length) return { processed: 0 };

  const now = new Date();
  let processed = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    const firstName = row[1] || '';
    const email      = row[2] || '';

    const welcomeScheduledAt    = row[32] || '';
    const welcomeSent           = (row[33] || '').toLowerCase();
    const newsletterScheduledAt = row[34] || '';
    const newsletterSent        = (row[35] || '').toLowerCase();

    if (!email || !email.includes('@')) continue;

    if (welcomeScheduledAt && welcomeSent === 'no' && new Date(welcomeScheduledAt) <= now) {
      const single = { sent: [], skipped: [], errors: [] };
      const ok = await trySend(
        email, T.WELCOME,
        () => composeWelcome(firstName, settings),
        sheets, sentLog, single
      );
      await sheets.spreadsheets.values.update({
        spreadsheetId: process.env.SHEET_ID_BBW4LIFE_ACCOUNTS,
        range: `bbw4life-accounts!AH${i + 1}`,
        valueInputOption: 'RAW',
        resource: { values: [['yes']] }
      });
      if (ok) processed++;
      await sleep(400);
    }

    if (newsletterScheduledAt && newsletterSent === 'no' && new Date(newsletterScheduledAt) <= now) {
      const single = { sent: [], skipped: [], errors: [] };
      const ok = await trySend(
        email, T.NEWSLETTER_1,
        () => composeNewsletter1(firstName, settings),
        sheets, sentLog, single
      );
      await sheets.spreadsheets.values.update({
        spreadsheetId: process.env.SHEET_ID_BBW4LIFE_ACCOUNTS,
        range: `bbw4life-accounts!AJ${i + 1}`,
        valueInputOption: 'RAW',
        resource: { values: [['yes']] }
      });
      if (ok) processed++;
      await sleep(400);
    }
  }

  console.log(`[Queue] Done — processed: ${processed}`);
  return { processed };
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
//  EMAIL DESIGN SYSTEM — BBW4LIFE BRANDED
//  Redesign fidèle à l'image de référence :
//  • Header noir avec hero image (founder.hero_image) à droite
//  • Tagline "CONFIDENCE. BEAUTY. EMPOWERMENT."
//  • Logo BBW4LIFE en grand avec "4" en rose
//  • Vague de transition noir→blanc
//  • Section corps sur fond blanc/rose très clair
//  • Bloc "YOU ARE enough JUST AS YOU ARE" sur fond rose pastel
//  • Grille de 4 icônes (valeurs de la marque)
//  • Footer sombre avec photo CEO + social icons colorés
// ════════════════════════════════════════════════════════════════

const BBW = {
  pink:      '#e8245a',
  pinkDark:  '#c0385e',
  pinkLight: '#f9e0e8',
  pinkPale:  '#fdf0f4',
  black:     '#0d0d0d',
  darkBg:    '#1a0812',
  white:     '#ffffff',
  offWhite:  '#fdf8fb',
  textDark:  '#1a1618',
  textMid:   '#42383e',
  textLight: '#9e8e96',
  gold:      '#c9963e',
  goldL:     '#e8bc6a',
};

const BASE_CSS = `
  body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
  table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}
  img{-ms-interpolation-mode:bicubic;border:0;height:auto;line-height:100%;outline:none;text-decoration:none}
  body{margin:0!important;padding:0!important;background-color:#f9eef3}
  a{color:inherit}
  @media only screen and (max-width:620px){
    .ew{width:100%!important;border-radius:0!important}
    .ep{padding:24px 16px!important}
    .eh1{font-size:26px!important}
    .elogo{font-size:38px!important}
    .egrid td{display:block!important;width:100%!important;padding:8px 0!important;text-align:center!important}
    .hide-mobile{display:none!important}
    .hero-img td{width:50%!important}
    .hero-img img{width:160px!important;max-width:160px!important}
    .hero-txt{padding:20px 16px 0!important}
  }
`;

// ── Social icons colorés (comme dans l'image) ─────────────────
function buildSocialIcons(settings) {
  const social = settings.social_links || {};
  const icons  = settings.social_icons  || {};

  const links = [
    { key: 'facebook',  label: 'Facebook'  },
    { key: 'instagram', label: 'Instagram' },
    { key: 'pinterest', label: 'Pinterest' },
    { key: 'youtube',   label: 'YouTube'   },
    { key: 'tiktok',    label: 'TikTok'    },
    { key: 'twitter',   label: 'X'         },
    { key: 'whatsapp',  label: 'WhatsApp'  },
  ].filter(l => social[l.key]);

  if (!links.length) return '';

  return `
<table cellpadding="0" cellspacing="0" role="presentation" style="margin:14px auto 6px;">
  <tr>
    ${links.map(l => `
    <td style="padding:0 4px;">
      <a href="${social[l.key]}" target="_blank" style="display:inline-block;text-decoration:none;">
        ${icons[l.key]
          ? `<img src="${icons[l.key]}" alt="${l.label}" width="38" height="38"
               style="width:38px;height:38px;display:block;border-radius:50%;object-fit:cover;">`
          : `<span style="display:inline-flex;align-items:center;justify-content:center;
               width:38px;height:38px;border-radius:50%;background:#333;
               font-family:Arial,sans-serif;font-size:11px;color:#fff;font-weight:700;">
               ${l.label.charAt(0)}
             </span>`
        }
      </a>
    </td>`).join('')}
  </tr>
</table>
<table cellpadding="0" cellspacing="0" role="presentation" style="margin:6px auto 0;">
  <tr>
    ${links.map(l => `
    <td style="padding:0 4px;text-align:center;min-width:46px;">
      <span style="font-family:Arial,sans-serif;font-size:9px;color:rgba(255,255,255,0.55);">${l.label}</span>
    </td>`).join('')}
  </tr>
</table>`;
}

// ── CEO Footer Block (fidèle à l'image : photo ronde + citation + logo + socials) ──
function buildCEOFooter(settings) {
  const ceo     = settings.founder || settings.ceo || {};
  const support = (settings.contact_emails || {}).general || 'support@bbw4life.com';
  const whatsapp = (settings.contact || {}).whatsapp_url || 'https://wa.me/18292677434';

  const photoHTML = (ceo.photo || 'https://cdn.shopify.com/s/files/1/0746/5346/6724/files/Pdg_Francenel.jpg?v=1778926866')
    ? `<img src="${ceo.photo || 'https://cdn.shopify.com/s/files/1/0746/5346/6724/files/Pdg_Francenel.jpg?v=1778926866'}" alt="${ceo.name || 'Francenel'}" width="90" height="90"
         style="width:90px;height:90px;border-radius:50%;object-fit:cover;
                border:3px solid ${BBW.pink};display:block;margin:0 auto 14px;">`
    : '';

  return `
<!-- CEO + SOCIAL FOOTER -->
<tr>
  <td style="background:${BBW.black};padding:0;">

    <!-- CEO Section -->
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <!-- Left: CEO Info -->
        <td width="50%" style="padding:36px 20px 36px 36px;vertical-align:middle;">
          ${photoHTML}
          <p style="margin:0 0 2px;font-family:Georgia,serif;font-size:11px;
              color:rgba(255,255,255,0.55);font-style:italic;letter-spacing:0.05em;">
            From the CEO &amp; Founder,
          </p>
          <p style="margin:0 0 14px;font-family:Georgia,serif;font-size:20px;
              font-weight:700;color:${BBW.pink};letter-spacing:0.03em;">
            ${ceo.name || 'FRANCENEL'}
          </p>
          <p style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:12px;
              color:rgba(255,255,255,0.65);line-height:1.65;font-style:italic;">
            "${ceo.quote
              ? ceo.quote.substring(0, 120) + (ceo.quote.length > 120 ? '...' : '')
              : 'My mission is simple: to empower curvy women to love themselves unapologetically and live their best life, every single day.'}"
          </p>
          <p style="margin:0;font-family:Georgia,serif;font-size:15px;
              color:${BBW.white};font-style:italic;">${ceo.name || 'Francenel'} ♡</p>
        </td>

        <!-- Right: Logo + Social -->
        <td width="50%" style="padding:36px 36px 36px 20px;vertical-align:middle;text-align:center;
            border-left:1px solid rgba(255,255,255,0.08);">

          <!-- BBW4LIFE Logo text -->
          <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:26px;font-weight:700;
              color:${BBW.white};letter-spacing:0.05em;">
            BBW<span style="color:${BBW.pink};">4</span>LIFE
          </p>
          <div style="width:40px;height:1px;background:${BBW.pink};margin:0 auto 6px;"></div>
          <p style="margin:0 0 18px;font-family:Arial,sans-serif;font-size:10px;
              color:rgba(255,255,255,0.45);letter-spacing:0.15em;text-transform:uppercase;">
            Stay Connected
          </p>

          <!-- Social icons -->
          ${buildSocialIcons(settings)}

          <!-- Support links -->
          <p style="margin:18px 0 0;font-family:Arial,sans-serif;font-size:11px;color:rgba(255,255,255,0.35);">
            <a href="mailto:${support}" style="color:${BBW.pink};text-decoration:none;">${support}</a>
            &nbsp;·&nbsp;
            <a href="${whatsapp}" style="color:${BBW.pink};text-decoration:none;">WhatsApp</a>
          </p>
        </td>
      </tr>
    </table>

    <!-- Bottom bar -->
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td style="padding:16px 36px;border-top:1px solid rgba(255,255,255,0.07);text-align:center;">
          <p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:11px;
              color:rgba(255,255,255,0.30);line-height:1.6;">
            You are receiving this email because you are part of the BBW4LIFE family.<br>
            No longer want to receive these emails?
            <a href="${BASE_URL}/unsubscribe" style="color:${BBW.pink};text-decoration:underline;">Unsubscribe</a>
          </p>
          <table cellpadding="0" cellspacing="0" role="presentation" style="margin:10px auto 0;">
            <tr>
              <td style="padding:0 8px;">
                <a href="${BASE_URL}/collections/bbw4life-all-product.html"
                   style="font-family:Arial,sans-serif;font-size:10px;color:rgba(255,255,255,0.30);text-decoration:none;">Shop</a>
              </td>
              <td style="padding:0 8px;border-left:1px solid rgba(255,255,255,0.12);">
                <a href="${BASE_URL}/policies/privacy.html"
                   style="font-family:Arial,sans-serif;font-size:10px;color:rgba(255,255,255,0.30);text-decoration:none;">Privacy</a>
              </td>
              <td style="padding:0 8px;border-left:1px solid rgba(255,255,255,0.12);">
                <a href="${BASE_URL}/page/contact.html"
                   style="font-family:Arial,sans-serif;font-size:10px;color:rgba(255,255,255,0.30);text-decoration:none;">Contact</a>
              </td>
              <td style="padding:0 8px;border-left:1px solid rgba(255,255,255,0.12);">
                <a href="${BASE_URL}/policies/refund.html"
                   style="font-family:Arial,sans-serif;font-size:10px;color:rgba(255,255,255,0.30);text-decoration:none;">Refunds</a>
              </td>
            </tr>
          </table>
          <p style="margin:10px 0 0;font-family:Arial,sans-serif;font-size:10px;color:rgba(255,255,255,0.18);">
            &copy; ${new Date().getFullYear()} BBW4LIFE. All rights reserved.
          </p>
        </td>
      </tr>
    </table>

  </td>
</tr>`;
}

// ── Valeurs de la marque — 4 icônes (comme dans l'image) ──────
function buildValueGrid() {
  const values = [
    { icon: '♡',  title: 'SELF LOVE',        desc: 'Embrace who you are and love every inch.' },
    { icon: '♛',  title: 'CONFIDENCE',        desc: 'Walk in your power every single day.' },
    { icon: '🎁', title: 'EXCLUSIVE OFFERS',  desc: 'Enjoy special deals just for you.' },
    { icon: '👥', title: 'COMMUNITY',         desc: 'Join a community that celebrates you.' },
  ];

  return `
<table width="100%" cellpadding="0" cellspacing="0" role="presentation"
       style="margin:0;border-top:1px solid rgba(232,36,90,0.12);">
  <tr>
    ${values.map((v, i) => `
    <td class="egrid" width="25%" style="padding:28px 12px;text-align:center;
        ${i < 3 ? 'border-right:1px solid rgba(232,36,90,0.12);' : ''}
        vertical-align:top;">
      <div style="font-size:26px;margin-bottom:10px;color:${BBW.pink};">${v.icon}</div>
      <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:10px;font-weight:700;
          color:${BBW.pink};letter-spacing:0.10em;text-transform:uppercase;">${v.title}</p>
      <p style="margin:0;font-family:Arial,sans-serif;font-size:11px;
          color:${BBW.textMid};line-height:1.55;">${v.desc}</p>
    </td>`).join('')}
  </tr>
</table>`;
}

// ── MASTER TEMPLATE — fidèle à l'image de référence ───────────
function masterTemplate({ preheader, tagline, heroHeadline, heroSubline, topBadge, bodyHTML, settings, showValueGrid = false }) {
  const founder  = settings.founder || settings.ceo || {};
  // Fallback direct sur l'URL connue si settings non encore chargé
  const heroImg  = founder.hero_image
    || 'https://cdn.shopify.com/s/files/1/0746/5346/6724/files/bbw.email.png?v=1782613828';

  // Logo BBW4LIFE style image : blanc + "4" en rose
  const logoHTML = `
<p style="margin:0;font-family:Georgia,serif;font-size:48px;font-weight:700;
    color:${BBW.white};letter-spacing:0.02em;line-height:1;">
  BBW<span style="color:${BBW.pink};">4</span>LIFE<span style="color:${BBW.pink};font-size:28px;">♡</span>
</p>
<div style="width:60px;height:2px;background:${BBW.pink};margin:10px 0 16px;"></div>`;

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>BBW4LIFE</title>
  <style>${BASE_CSS}</style>
</head>
<body style="margin:0;padding:0;background-color:#f9eef3;">

<!-- Preheader -->
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:#f9eef3;line-height:1px;">
  ${preheader}&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;
</div>

<table width="100%" cellpadding="0" cellspacing="0" role="presentation"
       style="background:#f9eef3;padding:24px 16px;">
  <tr><td align="center">
    <table class="ew" width="600" cellpadding="0" cellspacing="0" role="presentation"
           style="max-width:600px;width:100%;border-radius:0;overflow:hidden;
                  box-shadow:0 16px 48px rgba(192,56,94,0.20);">

      <!-- ═══════════════════════════════════════════════════════
           HEADER — Fond noir, hero image à droite, logo à gauche
           Fidèle à l'image de référence
           ═══════════════════════════════════════════════════════ -->
      <tr>
        <td style="background:${BBW.black};padding:0;position:relative;">

          <!-- Tagline strip -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td style="padding:12px 32px 0;text-align:center;">
                <p style="margin:0;font-family:Arial,sans-serif;font-size:10px;
                    color:rgba(255,255,255,0.55);letter-spacing:0.20em;text-transform:uppercase;">
                  ${tagline || 'CONFIDENCE. BEAUTY. EMPOWERMENT.'} &nbsp;♥
                </p>
              </td>
            </tr>
          </table>

          <!-- Hero: Logo left + Image right -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <!-- Left: Logo + Headline -->
              <td class="hero-txt" width="55%" style="padding:20px 24px 0 32px;vertical-align:bottom;">
                ${logoHTML}
                <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:13px;
                    font-weight:700;color:${BBW.white};letter-spacing:0.04em;text-transform:uppercase;">
                  ${heroHeadline || 'LOVE YOUR <span style="color:'+BBW.pink+';">CURVES.</span>'}
                </p>
                <p style="margin:0 0 24px;font-family:Arial,sans-serif;font-size:13px;
                    font-weight:700;color:rgba(255,255,255,0.75);letter-spacing:0.04em;text-transform:uppercase;">
                  ${heroSubline || 'LIVE YOUR BEST LIFE.'}
                </p>
              </td>
              <!-- Right: Hero image -->
              ${heroImg ? `
              <td class="hero-img" width="45%" style="padding:0;vertical-align:bottom;text-align:right;">
                <img src="${heroImg}" alt="BBW4LIFE" width="260"
                     style="width:260px;max-width:260px;height:auto;display:block;
                            border-radius:0;object-fit:cover;object-position:top center;">
              </td>` : `<td width="45%"></td>`}
            </tr>
          </table>

          <!-- Wave SVG transition noir → rose puis blanc -->
          <div style="line-height:0;font-size:0;display:block;overflow:hidden;">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 48" width="600" height="48"
                 style="display:block;width:100%;height:auto;" preserveAspectRatio="none">
              <path d="M0,0 C150,48 450,0 600,32 L600,48 L0,48 Z" fill="${BBW.pink}" opacity="0.9"/>
              <path d="M0,16 C200,48 400,8 600,40 L600,48 L0,48 Z" fill="${BBW.white}"/>
            </svg>
          </div>
        </td>
      </tr>

      <!-- ═══════════════════════════════════════════════════════
           BODY — Fond blanc/rose très clair
           ═══════════════════════════════════════════════════════ -->
      <tr>
        <td class="ep" style="background:${BBW.white};padding:36px 40px 0;">
          ${bodyHTML}
        </td>
      </tr>

      <!-- ═══════════════════════════════════════════════════════
           VALUE GRID — 4 icônes (Self Love / Confidence / Offers / Community)
           ═══════════════════════════════════════════════════════ -->
      ${showValueGrid ? `
      <tr>
        <td style="background:${BBW.white};padding:0 0 8px;">
          ${buildValueGrid()}
        </td>
      </tr>` : ''}

      <!-- ═══════════════════════════════════════════════════════
           CEO FOOTER + SOCIAL — Fond noir, 2 colonnes
           ═══════════════════════════════════════════════════════ -->
      ${buildCEOFooter(settings)}

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

// ── Composants réutilisables ──────────────────────────────────
function cParagraphs(text) {
  if (!text) return '';
  return text.split('\n').filter(p => p.trim()).map(p =>
    `<p style="margin:0 0 18px;font-family:Arial,sans-serif;font-size:15px;
        color:${BBW.textMid};line-height:1.75;">${p}</p>`
  ).join('');
}

function cCTA(label, url, color) {
  const bg = color || BBW.pink;
  return `
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:24px 0 8px;">
  <tr>
    <td align="center">
      <a href="${url}" target="_blank"
         style="display:inline-block;padding:15px 44px;border-radius:6px;
                background:${bg};font-family:Arial,sans-serif;font-size:14px;
                font-weight:700;color:#fff;text-decoration:none;letter-spacing:0.06em;
                text-transform:uppercase;">
        ${label}
      </a>
    </td>
  </tr>
</table>`;
}

function cDivider() {
  return `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:22px 0;">
  <tr>
    <td style="height:1px;background:linear-gradient(90deg,transparent,rgba(232,36,90,0.25),transparent);"></td>
  </tr>
</table>`;
}

// Bloc "YOU ARE enough JUST AS YOU ARE" — signature visuelle de l'image
function cEnoughBox(message) {
  return `
<table width="100%" cellpadding="0" cellspacing="0" role="presentation"
       style="margin:20px 0;">
  <tr>
    <td style="background:${BBW.pinkLight};border-radius:12px;padding:30px 24px;text-align:center;">
      <p style="margin:0 0 4px;font-size:20px;">♡</p>
      <p style="margin:0 0 2px;font-family:Arial,sans-serif;font-size:13px;font-weight:700;
          color:${BBW.textDark};letter-spacing:0.08em;text-transform:uppercase;">YOU ARE</p>
      <p style="margin:0 0 2px;font-family:Georgia,serif;font-size:36px;font-weight:700;
          color:${BBW.pink};font-style:italic;line-height:1.1;">${message || 'enough'}</p>
      <p style="margin:0 0 12px;font-family:Arial,sans-serif;font-size:12px;font-weight:700;
          color:${BBW.textDark};letter-spacing:0.10em;text-transform:uppercase;">JUST AS YOU ARE.</p>
      <div style="width:30px;height:1px;background:${BBW.textMid};margin:0 auto 6px;"></div>
      <p style="margin:0;font-size:12px;">♥</p>
    </td>
  </tr>
</table>`;
}

// Highlight box sobre
function cHighlightBox(icon, title, text, bgColor) {
  const bg = bgColor || BBW.pinkPale;
  return `
<table width="100%" cellpadding="0" cellspacing="0" role="presentation"
       style="margin:0 0 12px;border-radius:10px;overflow:hidden;
              background:${bg};border-left:3px solid ${BBW.pink};">
  <tr>
    <td style="padding:16px 18px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td width="32" style="vertical-align:top;padding-top:1px;font-size:20px;">${icon}</td>
          <td style="padding-left:10px;">
            <p style="margin:0 0 3px;font-family:Arial,sans-serif;font-size:12px;
                font-weight:700;color:${BBW.pink};letter-spacing:0.06em;text-transform:uppercase;">${title}</p>
            <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;
                color:${BBW.textMid};line-height:1.55;">${text}</p>
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
       style="margin-bottom:10px;border-radius:10px;overflow:hidden;
              background:${BBW.pinkPale};border:1px solid rgba(232,36,90,0.12);">
  <tr>
    ${item.image ? `
    <td width="70" style="padding:0;vertical-align:top;">
      <img src="${item.image}" width="70" height="70"
           style="display:block;width:70px;height:70px;object-fit:cover;border-radius:10px 0 0 10px;"
           alt="${item.title}">
    </td>` : ''}
    <td style="padding:14px 16px;vertical-align:middle;">
      <p style="margin:0 0 3px;font-family:Georgia,serif;font-size:13px;
          font-weight:700;color:${BBW.textDark};">${item.title}</p>
      ${item.size  ? `<p style="margin:0 0 2px;font-family:Arial,sans-serif;font-size:12px;color:${BBW.textLight};">Size: ${item.size}</p>`  : ''}
      ${item.color ? `<p style="margin:0 0 2px;font-family:Arial,sans-serif;font-size:12px;color:${BBW.textLight};">Color: ${item.color}</p>` : ''}
      <p style="margin:4px 0 0;font-family:Arial,sans-serif;font-size:12px;color:${BBW.textLight};">
        Qty: ${item.quantity} &nbsp;·&nbsp;
        <span style="color:${BBW.pink};font-weight:700;">$${parseFloat(item.price * item.quantity).toFixed(2)}</span>
      </p>
    </td>
  </tr>
</table>`;
}

// Bloc promo code — style sombre (comme dans l'image)
function cPromoBlock(code, percent, items, label) {
  return `
<table width="100%" cellpadding="0" cellspacing="0" role="presentation"
       style="margin:20px 0;border-radius:12px;overflow:hidden;
              background:${BBW.black};">
  <tr>
    <td style="padding:28px 24px;text-align:center;">
      <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:10px;
          color:rgba(255,255,255,0.55);text-transform:uppercase;letter-spacing:0.15em;">
        🎁 ${label || 'Exclusive Gift'}
      </p>
      <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:32px;font-weight:700;
          color:${BBW.goldL};letter-spacing:0.12em;">${code}</p>
      <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;
          color:rgba(255,255,255,0.65);">
        ${percent}% off — ${items} items or more
      </p>
    </td>
  </tr>
</table>`;
}

// ════════════════════════════════════════════════════════════════
//  AI COPY GENERATORS — inchangés
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

async function getProductName(productId) {
  try {
    const res  = await fetch(`${BASE_URL}/products.data.json`);
    if (!res.ok) return null;
    const data = await res.json();
    const arr  = Array.isArray(data) ? data : [];
    const prod = arr.find(p => p.id === productId && p.type !== 'settings');
    return prod ? (prod.name || prod.title || null) : null;
  } catch (e) {
    console.warn('[ProductName] Failed:', e.message);
    return null;
  }
}

function detectSentiment(title, text) {
  const combined = `${title} ${text}`.toLowerCase();
  const neg = [
    'never arrived','never received','not received','jamais reçu','jamais arrivé',
    'lost','perdu','broken','cassé','damaged','wrong','mauvais','disappointed',
    'déçu','terrible','horrible','bad','refund','remboursement','scam','arnaque',
    'too long','trop long','delay','retard','poor quality','mauvaise qualité',
    'problem','problème','worst','never again','ripped','doesn\'t fit'
  ];
  const pos = [
    'love','adore','amazing','beautiful','perfect','excellent','great','wonderful',
    'fantastic','gorgeous','magnifique','parfait','superbe','incroyable','très bien',
    'highly recommend','satisfied','happy','fast shipping','good quality',
    'fits perfectly','worth it','five stars','5 stars','best','comfortable'
  ];
  let negScore = 0; let posScore = 0;
  neg.forEach(k => { if (combined.includes(k)) negScore++; });
  pos.forEach(k => { if (combined.includes(k)) posScore++; });
  return negScore > posScore ? 'negative' : 'positive';
}

async function genReviewResponseCopy(firstName, title, text, productName, sentiment, promo, settings) {
  const whatsapp    = (settings.contact || {}).whatsapp_url || 'https://wa.me/18298940709';
  const contactPage = `${BASE_URL}/page/contact.html`;

  const userPrompt = sentiment === 'positive'
    ? `Customer ${firstName} left a POSITIVE review about "${productName}".
Title: "${title}"
Review: "${text}"
Write a short warm thank-you (2 paragraphs max). Mention their specific product "${productName}".
Add naturally: promo code ${promo ? promo.code : ''} — ${promo ? promo.percent + '% off on ' + promo.items + ' items or more' : ''}.
End with a warm invite to shop again. Plain text only.`
    : `Customer ${firstName} left a NEGATIVE review about "${productName}".
Title: "${title}"
Review: "${text}"
Write a short sincere apology (2 paragraphs max). Address their EXACT issue from the review.
Ask them kindly to reach us on WhatsApp: ${whatsapp} or contact page: ${contactPage} to resolve personally.
Warm, humble, genuine. No excuses. Plain text only.`;

  const copy = await callGroq(userPrompt);
  return copy || (sentiment === 'positive'
    ? `Thank you so much for your kind words about ${productName} — it means everything to us to know you love it. You just made our whole team smile.\n\nAs a small thank-you, here's an exclusive gift for you: use code ${promo ? promo.code : ''} for ${promo ? promo.percent + '% off' : 'a special discount'}. We can't wait to see what you pick next.`
    : `We're truly sorry about your experience with ${productName} — this is not the standard we hold ourselves to, and we completely understand your frustration.\n\nPlease reach out to us on WhatsApp (${whatsapp}) or through our contact page (${contactPage}) so we can personally make this right for you.`
  );
}

async function genStoryReceivedCopy(name) {
  const copy = await callGroq(
    `EMAIL TYPE: Story submission confirmation — BBW4LIFE community page.
RECIPIENT: ${name}
Write 2 short paragraphs (blank line between):
- Para 1 (2-3 sentences): Tell her her story genuinely moved us. Her courage to share it is extraordinary. The BBW4LIFE community needs voices like hers.
- Para 2 (2 sentences): Let her know the team will review it carefully, and once approved it will be published on the Our Story page so other women can read it and find strength. Make her feel proud of what she shared.
Plain text only, no greeting, no sign-off.`
  );
  return copy || `What you just shared stopped us in our tracks — your story is real, raw, and exactly the kind of truth that changes how women see themselves. The courage it takes to share something so personal is something we never take for granted, and we're deeply honored you chose to share it with us.\n\nOur team will review your story carefully, and once approved it will be published on our Our Story page — where other women just like you will read it, feel seen, and find the strength they've been looking for. Thank you for being part of something bigger than fashion.`;
}

// ════════════════════════════════════════════════════════════════
//  EMAIL COMPOSERS — redesignés avec le nouveau masterTemplate
// ════════════════════════════════════════════════════════════════

// ── 1. Welcome Email ──────────────────────────────────────────
async function composeWelcome(firstName, settings) {
  const name = firstName || 'Beautiful';
  const copy = await genWelcomeCopy(name);

  const bodyHTML = `
    <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:26px;
        font-weight:700;color:${BBW.textDark};font-style:italic;">Hey ${name}! ♡</p>
    <p style="margin:0 0 22px;font-family:Arial,sans-serif;font-size:12px;
        color:${BBW.pink};letter-spacing:0.08em;text-transform:uppercase;font-weight:700;">
      Welcome to the family
    </p>
    ${cParagraphs(copy)}

    <!-- Two-column: text left, enough box right -->
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:20px 0;">
      <tr>
        <td width="55%" style="vertical-align:top;padding-right:16px;">
          ${cHighlightBox('👗', 'Fashion', 'Hundreds of styles designed with your curves in mind.')}
          ${cHighlightBox('💄', 'Beauty', 'Products that make you feel beautiful inside and out.', BBW.offWhite)}
          ${cHighlightBox('❤️', 'Community', 'Real women, real stories, real support.', BBW.pinkPale)}
          ${cCTA('EXPLORE NOW &nbsp;›', `${BASE_URL}/collections/bbw4life-all-product.html`)}
        </td>
        <td width="45%" style="vertical-align:top;">
          ${cEnoughBox('enough')}
        </td>
      </tr>
    </table>`;

  return {
    subject: `Welcome to BBW4LIFE, ${name}! Beauty Has No Sizes 👑`,
    html: masterTemplate({
      preheader:   `You're officially part of the BBW4LIFE family — and we built this for exactly you.`,
      tagline:     'CONFIDENCE. BEAUTY. EMPOWERMENT.',
      heroHeadline: `LOVE YOUR <span style="color:${BBW.pink};">CURVES.</span>`,
      heroSubline:  'LIVE YOUR BEST LIFE.',
      bodyHTML,
      settings,
      showValueGrid: true,
    }),
  };
}


// ── Confirmation d'email après signup ──
async function composeConfirmAccount(data, settings) {
  const { firstName, confirmUrl } = data;
  const name = firstName || 'Beautiful';

  const bodyHTML = `
    <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:26px;
        font-weight:700;color:${BBW.textDark};font-style:italic;">Hey ${name}! ♡</p>
    <p style="margin:0 0 22px;font-family:Arial,sans-serif;font-size:12px;
        color:${BBW.pink};letter-spacing:0.08em;text-transform:uppercase;font-weight:700;">
      Confirm Your Email ✉️
    </p>
    <p style="margin:0 0 18px;font-family:Arial,sans-serif;font-size:15px;
        color:${BBW.textMid};line-height:1.75;">
      Welcome to BBW4LIFE! We're so glad you're here. Before you can log in and start shopping,
      please confirm your email address by clicking the button below.
    </p>
    ${cCTA('CONFIRM MY ACCOUNT &nbsp;›', confirmUrl)}
    ${cDivider()}
    <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;
        color:${BBW.textLight};text-align:center;line-height:1.6;">
      If you didn't create this account, you can safely ignore this email.
    </p>
    <div style="height:32px;"></div>`;

  return {
    subject: `Please confirm your BBW4LIFE account, ${name} ✉️`,
    html: masterTemplate({
      preheader:    `One quick step — confirm your email to activate your account.`,
      tagline:      'CONFIDENCE. BEAUTY. EMPOWERMENT.',
      heroHeadline: `ALMOST <span style="color:${BBW.pink};">THERE!</span>`,
      heroSubline:  'CONFIRM YOUR EMAIL TO GET STARTED.',
      bodyHTML,
      settings,
    }),
  };
}

// ── 2. Order Confirmation ─────────────────────────────────────
async function composeOrderConfirm(data, settings) {
  const { firstName, lastName, orderId, items = [], total, shippingAddress } = data;
  const name = firstName || lastName || 'Beautiful';
  const copy = await genOrderConfirmCopy(name);

  const itemsHTML = items.map(item => cOrderItem(item)).join('');

  const bodyHTML = `
    <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:26px;
        font-weight:700;color:${BBW.textDark};font-style:italic;">Hey ${name}! ♡</p>
    <p style="margin:0 0 22px;font-family:Arial,sans-serif;font-size:12px;
        color:${BBW.pink};letter-spacing:0.08em;text-transform:uppercase;font-weight:700;">
      Order Confirmed ✅
    </p>
    ${cParagraphs(copy)}
    ${cDivider()}
    <p style="margin:0 0 14px;font-family:Georgia,serif;font-size:15px;font-weight:700;color:${BBW.textDark};">
      Your Order — <span style="color:${BBW.pink};">#${orderId || 'BBW4LIFE'}</span>
    </p>
    ${itemsHTML}
    ${total ? `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="margin-top:14px;padding:14px;background:${BBW.pinkPale};
                  border-radius:8px;border:1px solid rgba(232,36,90,0.12);">
      <tr>
        <td style="font-family:Georgia,serif;font-size:15px;font-weight:700;color:${BBW.textDark};">Total</td>
        <td style="text-align:right;font-family:Georgia,serif;font-size:17px;
            font-weight:700;color:${BBW.pink};">$${parseFloat(total).toFixed(2)}</td>
      </tr>
    </table>` : ''}
    ${shippingAddress ? `
    ${cDivider()}
    <p style="margin:0 0 6px;font-family:Georgia,serif;font-size:13px;
        font-weight:700;color:${BBW.textDark};">Shipping to:</p>
    <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;
        color:${BBW.textMid};line-height:1.6;">${shippingAddress}</p>` : ''}
    ${cDivider()}
    <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;
        color:${BBW.textLight};text-align:center;line-height:1.6;">
      You'll receive a tracking number by email as soon as your order ships.<br>
      Questions? Reply to this email — we're always here. ♡
    </p>
    <div style="height:32px;"></div>`;

  return {
    subject: `Order Confirmed! Your BBW4LIFE order is being prepared 🛍️`,
    html: masterTemplate({
      preheader:    `Your order has been confirmed — we're already preparing it with care.`,
      tagline:      'CONFIDENCE. BEAUTY. EMPOWERMENT.',
      heroHeadline: `YOUR ORDER IS <span style="color:${BBW.pink};">CONFIRMED.</span>`,
      heroSubline:  'WE\'RE PREPARING IT WITH LOVE.',
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
    <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:26px;
        font-weight:700;color:${BBW.textDark};font-style:italic;">Hey ${name}! ♡</p>
    <p style="margin:0 0 22px;font-family:Arial,sans-serif;font-size:12px;
        color:${BBW.pink};letter-spacing:0.08em;text-transform:uppercase;font-weight:700;">
      Your Order Is On Its Way 🚚
    </p>
    ${cParagraphs(copy)}
    ${cDivider()}
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="margin:0 0 20px;border-radius:12px;overflow:hidden;background:${BBW.black};">
      <tr>
        <td style="padding:28px;text-align:center;">
          <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:10px;
              color:rgba(255,255,255,0.50);text-transform:uppercase;letter-spacing:0.15em;">
            Tracking Number
          </p>
          <p style="margin:0 0 10px;font-family:Georgia,serif;font-size:26px;font-weight:700;
              color:${BBW.goldL};letter-spacing:0.10em;">${trackingNumber}</p>
          ${carrier ? `<p style="margin:0;font-family:Arial,sans-serif;font-size:12px;
              color:rgba(255,255,255,0.55);">Carrier: ${carrier}</p>` : ''}
        </td>
      </tr>
    </table>
    ${cCTA('TRACK MY ORDER &nbsp;›', data.trackingUrl || `${BASE_URL}/page/order-tracking.html`)}
    ${cDivider()}
    <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;
        color:${BBW.textLight};text-align:center;">
      Order: <strong style="color:${BBW.textDark};">#${orderId || 'BBW4LIFE'}</strong>
    </p>
    <div style="height:32px;"></div>`;

  return {
    subject: `Your BBW4LIFE order is on its way! 🚚 Tracking: ${trackingNumber}`,
    html: masterTemplate({
      preheader:    `Your order has shipped — tracking: ${trackingNumber}`,
      tagline:      'CONFIDENCE. BEAUTY. EMPOWERMENT.',
      heroHeadline: `IT'S ON ITS <span style="color:${BBW.pink};">WAY!</span>`,
      heroSubline:  'YOUR PACKAGE IS HEADING TO YOU.',
      bodyHTML,
      settings,
    }),
  };
}

// ── 4. Newsletter #1 — Immédiat ───────────────────────────────
async function composeNewsletter1(firstName, settings) {
  const name   = firstName || 'Beautiful';
  const copy   = await genNewsletter1Copy(name);
  const promos = (settings.promos || []);
  const promo  = promos[0];

  const bodyHTML = `
    <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:26px;
        font-weight:700;color:${BBW.textDark};font-style:italic;">Hey Beautiful! ♡</p>
    <p style="margin:0 0 22px;font-family:Arial,sans-serif;font-size:12px;
        color:${BBW.pink};letter-spacing:0.08em;text-transform:uppercase;font-weight:700;">
      Subscription Confirmed ✓
    </p>

    <!-- Two-column: copy left, enough box right -->
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 20px;">
      <tr>
        <td width="56%" style="vertical-align:top;padding-right:16px;">
          ${cParagraphs(copy)}
          ${cCTA('EXPLORE NOW &nbsp;›', `${BASE_URL}/collections/bbw4life-all-product.html`)}
        </td>
        <td width="44%" style="vertical-align:top;">
          ${cEnoughBox('enough')}
        </td>
      </tr>
    </table>

    ${promo ? cPromoBlock(promo.code, promo.percent, promo.items, 'Welcome Gift') : ''}
    <div style="height:32px;"></div>`;

  return {
    subject: `You're in! Welcome to the BBW4LIFE family 💕`,
    html: masterTemplate({
      preheader:    `Your subscription is confirmed — exclusive tips, deals, and real stories incoming.`,
      tagline:      'CONFIDENCE. BEAUTY. EMPOWERMENT.',
      heroHeadline: `LOVE YOUR <span style="color:${BBW.pink};">CURVES.</span>`,
      heroSubline:  'LIVE YOUR BEST LIFE.',
      bodyHTML,
      settings,
      showValueGrid: true,
    }),
  };
}

// ── 5. Newsletter #2 — Jour 3 ─────────────────────────────────
async function composeNewsletter2(firstName, settings) {
  const name    = firstName || 'Beautiful';
  const copy    = await genNewsletter2Copy(name);
  const support = (settings.contact_emails || {}).general || 'support@bbw4life.com';

  const bodyHTML = `
    <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:26px;
        font-weight:700;color:${BBW.textDark};font-style:italic;">Hey ${name}! ♡</p>
    <p style="margin:0 0 22px;font-family:Arial,sans-serif;font-size:12px;
        color:${BBW.pink};letter-spacing:0.08em;text-transform:uppercase;font-weight:700;">
      Checking In 💬
    </p>
    ${cParagraphs(copy)}
    ${cDivider()}
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="border-radius:10px;overflow:hidden;background:${BBW.pinkPale};
                  border:1px solid rgba(232,36,90,0.12);">
      <tr>
        <td style="padding:22px;text-align:center;">
          <p style="margin:0 0 8px;font-size:28px;">💬</p>
          <p style="margin:0 0 6px;font-family:Georgia,serif;font-size:14px;
              font-weight:700;color:${BBW.textDark};">We'd love to hear from you</p>
          <p style="margin:0 0 14px;font-family:Arial,sans-serif;font-size:13px;
              color:${BBW.textMid};">Simply reply to this email or reach us anytime.</p>
          <a href="mailto:${support}"
             style="display:inline-block;padding:11px 28px;border-radius:6px;
                    background:${BBW.pink};font-family:Arial,sans-serif;font-size:13px;
                    font-weight:700;color:#fff;text-decoration:none;letter-spacing:0.05em;
                    text-transform:uppercase;">
            Reply Now &nbsp;›
          </a>
        </td>
      </tr>
    </table>
    ${cCTA('BROWSE THE SHOP &nbsp;›', `${BASE_URL}/collections/bbw4life-all-product.html`)}
    <div style="height:32px;"></div>`;

  return {
    subject: `Hey ${name}, how's your BBW4LIFE experience so far? 💬`,
    html: masterTemplate({
      preheader:    `We'd love to hear from you — your feedback shapes everything we do.`,
      tagline:      'CONFIDENCE. BEAUTY. EMPOWERMENT.',
      heroHeadline: `LOVE YOUR <span style="color:${BBW.pink};">CURVES.</span>`,
      heroSubline:  'LIVE YOUR BEST LIFE.',
      bodyHTML,
      settings,
    }),
  };
}

// ── 6. Newsletter #3 — Jour 5 ─────────────────────────────────
async function composeNewsletter3(firstName, settings) {
  const name   = firstName || 'Beautiful';
  const copy   = await genNewsletter3Copy(name);
  const promos = settings.promos || [];
  const promo  = promos[1] || promos[0];

  const bodyHTML = `
    <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:26px;
        font-weight:700;color:${BBW.textDark};font-style:italic;">Hey ${name}! ♡</p>
    <p style="margin:0 0 22px;font-family:Arial,sans-serif;font-size:12px;
        color:${BBW.pink};letter-spacing:0.08em;text-transform:uppercase;font-weight:700;">
      Special For You 💕
    </p>
    ${cParagraphs(copy)}
    ${cDivider()}
    ${cHighlightBox('🛍️', 'Bundle Deals', 'Buy multiple items and save more — designed to reward women who shop smart.')}
    ${cHighlightBox('⭐', 'Customer Favorites', 'The pieces our community loves most, voted by real women.', BBW.offWhite)}
    ${cHighlightBox('🔥', 'Limited Promotions', 'Flash deals that come and go — stay subscribed to never miss one.', BBW.pinkPale)}
    ${promo ? cPromoBlock(promo.code, promo.percent, promo.items, 'For Our Subscribers') : ''}
    ${cCTA('SHOP OUR FAVORITES &nbsp;›', `${BASE_URL}/collections/most-popular.html`)}
    <div style="height:32px;"></div>`;

  return {
    subject: `${name}, these are our customers' favorites 🔥`,
    html: masterTemplate({
      preheader:    `Bundles, favorites, and exclusive promotions — all waiting for you.`,
      tagline:      'CONFIDENCE. BEAUTY. EMPOWERMENT.',
      heroHeadline: `YOU DESERVE <span style="color:${BBW.pink};">THE BEST.</span>`,
      heroSubline:  'BUNDLES & COMMUNITY TOP PICKS.',
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
    <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:26px;
        font-weight:700;color:${BBW.textDark};font-style:italic;">Hey ${name}! ♡</p>
    <p style="margin:0 0 22px;font-family:Arial,sans-serif;font-size:12px;
        color:${BBW.pink};letter-spacing:0.08em;text-transform:uppercase;font-weight:700;">
      Thank You 💕
    </p>
    ${cParagraphs(copy)}
    ${cDivider()}
    ${cHighlightBox('⭐', 'Share Your Experience', 'Your review helps other women feel confident in their choices.')}
    ${cHighlightBox('🛍️', 'Shop More', 'New arrivals added regularly — always something new waiting for you.', BBW.offWhite)}
    ${cCTA('LEAVE A REVIEW &nbsp;›', `${BASE_URL}/collections/bbw4life-all-product.html`)}
    ${cCTA('SHOP NEW ARRIVALS &nbsp;›', `${BASE_URL}/collections/bbw4life-all-product.html`, BBW.pinkDark)}
    <div style="height:32px;"></div>`;

  return {
    subject: `Thank you for your trust, ${name} 💕`,
    html: masterTemplate({
      preheader:    `We appreciate you and we'd love to hear about your experience.`,
      tagline:      'CONFIDENCE. BEAUTY. EMPOWERMENT.',
      heroHeadline: `THANK YOU FOR <span style="color:${BBW.pink};">TRUSTING US.</span>`,
      heroSubline:  'YOUR EXPERIENCE MATTERS TO US.',
      bodyHTML,
      settings,
      showValueGrid: true,
    }),
  };
}

// ── 8. Newsletter #4 — Jour 10 (Non-Buyer) ───────────────────
async function composeNewsletter4New(firstName, settings) {
  const name   = firstName || 'Beautiful';
  const copy   = await genNewsletter4NewCopy(name);
  const promos = settings.promos || [];
  const promo  = promos[0];

  const bodyHTML = `
    <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:26px;
        font-weight:700;color:${BBW.textDark};font-style:italic;">Hey ${name}! ♡</p>
    <p style="margin:0 0 22px;font-family:Arial,sans-serif;font-size:12px;
        color:${BBW.pink};letter-spacing:0.08em;text-transform:uppercase;font-weight:700;">
      A Special Gift For You 🎁
    </p>
    ${cParagraphs(copy)}
    ${promo ? cPromoBlock(promo.code, promo.percent, promo.items, 'Exclusive Subscriber Offer') : ''}
    ${cCTA('USE MY DISCOUNT &nbsp;›', `${BASE_URL}/collections/bbw4life-all-product.html`)}
    ${cDivider()}
    <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;
        color:${BBW.textLight};text-align:center;font-style:italic;">
      Beauty Has No Sizes — and neither does this offer. 👑
    </p>
    <div style="height:32px;"></div>`;

  return {
    subject: `${name}, here's an exclusive gift just for you 🎁`,
    html: masterTemplate({
      preheader:    `We prepared something special for you — an exclusive discount waiting inside.`,
      tagline:      'CONFIDENCE. BEAUTY. EMPOWERMENT.',
      heroHeadline: `THIS IS JUST <span style="color:${BBW.pink};">FOR YOU.</span>`,
      heroSubline:  'A SPECIAL GIFT FROM THE BBW4LIFE FAMILY.',
      bodyHTML,
      settings,
      showValueGrid: true,
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
    <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:26px;
        font-weight:700;color:${BBW.textDark};font-style:italic;">Hey ${name}! ♡</p>
    <p style="margin:0 0 22px;font-family:Arial,sans-serif;font-size:12px;
        color:${BBW.pink};letter-spacing:0.08em;text-transform:uppercase;font-weight:700;">
      Message Received ✅
    </p>
    ${cParagraphs(copy)}
    ${cDivider()}
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="border-radius:10px;background:${BBW.pinkPale};
                  border:1px solid rgba(232,36,90,0.12);">
      <tr>
        <td style="padding:20px;">
          <p style="margin:0 0 8px;font-family:Georgia,serif;font-size:13px;
              font-weight:700;color:${BBW.textDark};">Your message details:</p>
          ${msgSubject ? `<p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:13px;color:${BBW.textMid};"><strong>Subject:</strong> ${msgSubject}</p>` : ''}
          ${category   ? `<p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:${BBW.textMid};"><strong>Category:</strong> ${category}</p>` : ''}
        </td>
      </tr>
    </table>
    ${cDivider()}
    <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;
        color:${BBW.textLight};text-align:center;line-height:1.7;">
      Need urgent help?<br>
      <a href="mailto:${support}" style="color:${BBW.pink};font-weight:700;text-decoration:none;">${support}</a>
      &nbsp;·&nbsp;
      <a href="${whatsapp}" target="_blank" style="color:${BBW.pink};font-weight:700;text-decoration:none;">WhatsApp Us</a>
    </p>
    <div style="height:32px;"></div>`;

  return {
    subject: `We received your message — BBW4LIFE Support ✅`,
    html: masterTemplate({
      preheader:    `Your message has been received — our team will respond within 24-48 hours.`,
      tagline:      'CONFIDENCE. BEAUTY. EMPOWERMENT.',
      heroHeadline: `MESSAGE <span style="color:${BBW.pink};">RECEIVED!</span>`,
      heroSubline:  'OUR TEAM WILL RESPOND WITHIN 24-48H.',
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
    <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:26px;
        font-weight:700;color:${BBW.textDark};font-style:italic;">Hey ${name}! ♡</p>
    <p style="margin:0 0 22px;font-family:Arial,sans-serif;font-size:12px;
        color:${BBW.pink};letter-spacing:0.08em;text-transform:uppercase;font-weight:700;">
      Request Received ✅
    </p>
    ${cParagraphs(copy)}
    ${cDivider()}
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="border-radius:12px;overflow:hidden;background:${BBW.black};">
      <tr>
        <td style="padding:24px;text-align:center;">
          <p style="margin:0 0 6px;font-size:32px;">⏳</p>
          <p style="margin:0 0 6px;font-family:Georgia,serif;font-size:15px;
              font-weight:700;color:#fff;">${program}</p>
          ${size  ? `<p style="margin:0 0 2px;font-family:Arial,sans-serif;font-size:12px;color:rgba(255,255,255,0.55);">Size: ${size}</p>` : ''}
          ${color ? `<p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:rgba(255,255,255,0.55);">Color: ${color}</p>` : ''}
          <p style="margin:12px 0 0;font-family:Arial,sans-serif;font-size:12px;color:${BBW.goldL};">
            Our team will be in touch soon.
          </p>
        </td>
      </tr>
    </table>
    ${cCTA('BROWSE THE SHOP &nbsp;›', `${BASE_URL}/collections/bbw4life-all-product.html`)}
    <div style="height:32px;"></div>`;

  return {
    subject: `Your BBW4LIFE product request has been received! ⏳`,
    html: masterTemplate({
      preheader:    `We've received your request for ${program} — our team will review it soon.`,
      tagline:      'CONFIDENCE. BEAUTY. EMPOWERMENT.',
      heroHeadline: `WE'VE GOT YOUR <span style="color:${BBW.pink};">REQUEST!</span>`,
      heroSubline:  'OUR TEAM IS ON IT.',
      bodyHTML,
      settings,
    }),
  };
}

// ── 11. Custom Product Request ────────────────────────────────
async function composeCustomProduct(data, settings) {
  const { firstname, lastname, product_title, product_desc } = data;
  const name = firstname || lastname || 'Beautiful';
  const copy = await genCustomProductCopy(name, product_title);

  const bodyHTML = `
    <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:26px;
        font-weight:700;color:${BBW.textDark};font-style:italic;">Hey ${name}! ♡</p>
    <p style="margin:0 0 22px;font-family:Arial,sans-serif;font-size:12px;
        color:${BBW.pink};letter-spacing:0.08em;text-transform:uppercase;font-weight:700;">
      Design Request Received 🎨
    </p>
    ${cParagraphs(copy)}
    ${cDivider()}
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="border-radius:12px;overflow:hidden;background:${BBW.black};">
      <tr>
        <td style="padding:24px;text-align:center;">
          <p style="margin:0 0 6px;font-size:32px;">🎨</p>
          <p style="margin:0 0 6px;font-family:Georgia,serif;font-size:15px;
              font-weight:700;color:#fff;">${product_title || 'Your Custom Product'}</p>
          ${product_desc ? `<p style="margin:0;font-family:Arial,sans-serif;font-size:12px;
              color:rgba(255,255,255,0.55);line-height:1.5;">${product_desc.substring(0, 100)}${product_desc.length > 100 ? '...' : ''}</p>` : ''}
          <p style="margin:12px 0 0;font-family:Arial,sans-serif;font-size:12px;color:${BBW.goldL};">
            Our design team will review your idea.
          </p>
        </td>
      </tr>
    </table>
    ${cDivider()}
    <p style="margin:0 0 20px;font-family:Arial,sans-serif;font-size:13px;
        color:${BBW.textLight};text-align:center;line-height:1.7;">
      We evaluate every personalized product request carefully.<br>
      If your idea becomes a product, you'll be the first to know. 👑
    </p>
    ${cCTA('EXPLORE EXISTING PRODUCTS &nbsp;›', `${BASE_URL}/collections/bbw4life-all-product.html`)}
    <div style="height:32px;"></div>`;

  return {
    subject: `Your personalized product request is with our design team! 🎨`,
    html: masterTemplate({
      preheader:    `Your custom product idea has been received — our design team is reviewing it.`,
      tagline:      'CONFIDENCE. BEAUTY. EMPOWERMENT.',
      heroHeadline: `WE LOVE YOUR <span style="color:${BBW.pink};">VISION!</span>`,
      heroSubline:  'OUR DESIGN TEAM IS REVIEWING IT.',
      bodyHTML,
      settings,
      showValueGrid: true,
    }),
  };
}

// ── 12. Abandoned Cart Recovery ───────────────────────────────
async function composeCartAbandoned(data, settings) {
  const { firstName, lastName, items = [], promoCode, promoPercent, restartLink } = data;
  const name = firstName || lastName || 'Beautiful';
  const copy = await genCartAbandonedCopy(name);

  const itemsHTML = items.map(item => cOrderItem(item)).join('');
  const finalRestartLink = restartLink || `${BASE_URL}/checkout/checkout.html`;

  const bodyHTML = `
    <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:26px;
        font-weight:700;color:${BBW.textDark};font-style:italic;">Hey ${name}! ♡</p>
    <p style="margin:0 0 22px;font-family:Arial,sans-serif;font-size:12px;
        color:${BBW.pink};letter-spacing:0.08em;text-transform:uppercase;font-weight:700;">
      Your Cart Is Waiting 🛍️
    </p>
    ${cParagraphs(copy)}
    ${itemsHTML ? `
    ${cDivider()}
    <p style="margin:0 0 14px;font-family:Georgia,serif;font-size:15px;
        font-weight:700;color:${BBW.textDark};">Still in your cart:</p>
    ${itemsHTML}` : ''}
    ${promoCode ? cPromoBlock(promoCode, promoPercent || '', '', 'A Little Gift For You') : ''}
    ${cCTA('RESTART MY ORDER &nbsp;›', finalRestartLink)}
    ${cDivider()}
    <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;
        color:${BBW.textLight};text-align:center;font-style:italic;">
      Beauty Has No Sizes — and your spot in the BBW4LIFE family is still waiting. 👑
    </p>
    <div style="height:32px;"></div>`;

  return {
    subject: `${name}, you left something beautiful behind 🛍️`,
    html: masterTemplate({
      preheader:    `Your cart is saved and waiting — plus a little gift to welcome you back.`,
      tagline:      'CONFIDENCE. BEAUTY. EMPOWERMENT.',
      heroHeadline: `DON'T FORGET <span style="color:${BBW.pink};">THIS.</span>`,
      heroSubline:  'YOUR ITEMS ARE EXACTLY WHERE YOU LEFT THEM.',
      bodyHTML,
      settings,
      showValueGrid: true,
    }),
  };
}

// ── 13. Review Response ───────────────────────────────────────
async function composeReviewResponse(data, settings) {
  const { firstName, title, text, productId } = data;
  const name        = firstName || 'Beautiful';
  const productName = await getProductName(productId) || productId;
  const sentiment   = detectSentiment(title, text);
  const promos      = settings.promos || [];
  const promo       = sentiment === 'positive' && promos.length
    ? promos[Math.floor(Math.random() * promos.length)]
    : null;

  const copy = await genReviewResponseCopy(name, title, text, productName, sentiment, promo, settings);

  const promoBlock = (sentiment === 'positive' && promo)
    ? cPromoBlock(promo.code, promo.percent, promo.items, 'Your Thank-You Gift')
    : '';

  const bodyHTML = `
    <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:26px;
        font-weight:700;color:${BBW.textDark};font-style:italic;">Hey ${name}! ♡</p>
    <p style="margin:0 0 22px;font-family:Arial,sans-serif;font-size:12px;
        color:${BBW.pink};letter-spacing:0.08em;text-transform:uppercase;font-weight:700;">
      ${sentiment === 'positive' ? 'Thank You 💕' : "We're Sorry 💙"}
    </p>
    ${cParagraphs(copy)}
    ${promoBlock}
    ${sentiment === 'positive' ? cCTA('SHOP NOW &nbsp;›', `${BASE_URL}/collections/bbw4life-all-product.html`) : ''}
    <div style="height:32px;"></div>`;

  const isPositive = sentiment === 'positive';
  return {
    subject: isPositive
      ? `Thank you for your review, ${name}! 💕 Here's a gift for you`
      : `We're truly sorry, ${name} — let's make this right 💙`,
    html: masterTemplate({
      preheader:   isPositive
        ? `Your review made our day — here's a little thank-you gift just for you.`
        : `We read your review and we want to make this right for you.`,
      tagline:      'CONFIDENCE. BEAUTY. EMPOWERMENT.',
      heroHeadline: isPositive
        ? `YOU MADE OUR <span style="color:${BBW.pink};">DAY!</span>`
        : `WE'RE TRULY <span style="color:${BBW.pink};">SORRY.</span>`,
      heroSubline:  isPositive
        ? 'THANK YOU FOR YOUR REVIEW.'
        : "YOUR EXPERIENCE MATTERS — LET'S FIX THIS.",
      bodyHTML,
      settings,
      showValueGrid: true,
    }),
  };
}

// ── 14. Story Submission Confirmation ─────────────────────────
async function composeStoryReceived(data, settings) {
  const { firstName } = data;
  const name = firstName || 'Beautiful';
  const copy = await genStoryReceivedCopy(name);

  const bodyHTML = `
    <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:26px;
        font-weight:700;color:${BBW.textDark};font-style:italic;">Hey ${name}! ♡</p>
    <p style="margin:0 0 22px;font-family:Arial,sans-serif;font-size:12px;
        color:${BBW.pink};letter-spacing:0.08em;text-transform:uppercase;font-weight:700;">
      Story Received 💕
    </p>
    ${cParagraphs(copy)}
    ${cDivider()}
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="border-radius:12px;overflow:hidden;background:${BBW.black};">
      <tr>
        <td style="padding:32px;text-align:center;">
          <p style="margin:0 0 8px;font-size:40px;">💌</p>
          <p style="margin:0 0 6px;font-family:Georgia,serif;font-size:18px;
              font-weight:700;color:#fff;letter-spacing:0.03em;">
            Your story is in our hands.
          </p>
          <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;
              color:rgba(255,255,255,0.55);line-height:1.6;">
            Once approved, it will be visible on our<br>
            <strong style="color:${BBW.goldL};">Our Story</strong> page — for every woman who needs it.
          </p>
        </td>
      </tr>
    </table>
    ${cDivider()}
    ${cHighlightBox('👑', 'Beauty Has No Sizes', 'Every story shared here makes this community stronger. Thank you for being part of it.')}
    ${cHighlightBox('🔍', 'Review Process', 'Our team reads every submission personally. You\'ll hear from us soon.', BBW.offWhite)}
    ${cCTA('READ OTHER STORIES &nbsp;›', `${BASE_URL}/page/our-story.html`)}
    ${cDivider()}
    <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;
        color:${BBW.textLight};text-align:center;line-height:1.7;">
      Questions? Just reply to this email — we read everything. 💕
    </p>
    <div style="height:32px;"></div>`;

  return {
    subject: `${name}, your story touched our hearts 💕`,
    html: masterTemplate({
      preheader:    `Your BBW4LIFE story has been received — our team will review it and publish it soon.`,
      tagline:      'CONFIDENCE. BEAUTY. EMPOWERMENT.',
      heroHeadline: `YOUR STORY <span style="color:${BBW.pink};">MATTERS.</span>`,
      heroSubline:  "WE'RE HONORED YOU SHARED IT WITH US.",
      bodyHTML,
      settings,
      showValueGrid: true,
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

      if (trigger === T.WELCOME) {
        await trySend(email, T.WELCOME, () => composeWelcome(body.firstName, settings), sheets, sentLog, results);
      }

      if (trigger === T.CONFIRM_ACCOUNT) {
        await trySend(email, T.CONFIRM_ACCOUNT,
          () => composeConfirmAccount(body, settings),
          sheets, sentLog, results);
      }

      if (trigger === T.ORDER_CONFIRM) {
        await trySend(email, T.ORDER_CONFIRM,
          () => composeOrderConfirm(body, settings),
          sheets, sentLog, results);
      }

      if (trigger === T.ORDER_TRACKING) {
        await trySend(email, T.ORDER_TRACKING,
          () => composeOrderTracking(body, settings),
          sheets, sentLog, results);
      }

      if (trigger === T.NEWSLETTER_1) {
        await trySend(email, T.NEWSLETTER_1,
          () => composeNewsletter1(body.firstName, settings),
          sheets, sentLog, results);
      }

      if (trigger === T.NEWSLETTER_2) {
        await trySend(email, T.NEWSLETTER_2,
          () => composeNewsletter2(body.firstName, settings),
          sheets, sentLog, results);
      }

      if (trigger === T.NEWSLETTER_3) {
        await trySend(email, T.NEWSLETTER_3,
          () => composeNewsletter3(body.firstName, settings),
          sheets, sentLog, results);
      }

      if (trigger === T.NEWSLETTER_4_BUYER) {
        await trySend(email, T.NEWSLETTER_4_BUYER,
          () => composeNewsletter4Buyer(body.firstName, settings),
          sheets, sentLog, results);
      }

      if (trigger === T.NEWSLETTER_4_NEW) {
        await trySend(email, T.NEWSLETTER_4_NEW,
          () => composeNewsletter4New(body.firstName, settings),
          sheets, sentLog, results);
      }

      if (trigger === T.CONTACT_REPLY) {
        await trySend(email, T.CONTACT_REPLY,
          () => composeContactReply(body, settings),
          sheets, sentLog, results);
      }

      if (trigger === T.PLAN_REQUEST) {
        await trySend(email, T.PLAN_REQUEST,
          () => composePlanRequest(body, settings),
          sheets, sentLog, results);
      }

      if (trigger === T.CUSTOM_PRODUCT) {
        await trySend(email, T.CUSTOM_PRODUCT,
          () => composeCustomProduct(body, settings),
          sheets, sentLog, results);
      }

      if (trigger === T.CART_ABANDONED) {
        const dedupeType = `${T.CART_ABANDONED}_${body.orderId || Date.now()}`;
        await trySend(email, dedupeType,
          () => composeCartAbandoned(body, settings),
          sheets, sentLog, results);
      }

      if (trigger === T.STORY_RECEIVED) {
        await trySend(email, T.STORY_RECEIVED,
          () => composeStoryReceived(body, settings),
          sheets, sentLog, results);
      }

      if (trigger === T.REVIEW_RESPONSE) {
        await trySend(email, T.REVIEW_RESPONSE,
          () => composeReviewResponse(body, settings),
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

      if (params.action === 'process-queue') {
        const secret = params.secret;
        if (secret !== process.env.REPORT_SECRET) {
          return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
        }
        const queueResult = await runEmailQueueProcessor(sheets, sentLog, settings);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, ...queueResult })
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
        const lastName   = (row[0] || '').trim();
        const firstName  = (row[1] || '').trim();
        const email      = (row[2] || '').trim();
        const newsletter = (row[5] || '').trim().toLowerCase();
        const orders     = parseInt(row[6] || 0, 10);

        if (!email || !email.includes('@')) continue;

        const name = firstName || lastName || 'Beautiful';

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