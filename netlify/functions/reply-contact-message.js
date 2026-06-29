// netlify/functions/reply-contact-message.js
process.removeAllListeners('warning');

const { Resend } = require('resend');
const { google } = require('googleapis');

const BASE_URL   = process.env.BASE_URL   || 'https://bbw4life.com';
const FROM_EMAIL = process.env.FROM_EMAIL || 'BBW4LIFE <hello@bbw4life.com>';

const GROQ_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-70b-versatile',
  'mixtral-8x7b-32768',
  'gemma2-9b-it',
  'llama3-70b-8192',
];
let modelIdx = 0;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Brand colors ───────────────────────────────────────────────
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

// ── Base CSS ───────────────────────────────────────────────────
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

// ── Groq ───────────────────────────────────────────────────────
async function callGroq(userPrompt) {
  for (let attempt = 0; attempt < GROQ_MODELS.length; attempt++) {
    const idx   = (modelIdx + attempt) % GROQ_MODELS.length;
    const model = GROQ_MODELS[idx];
    for (let retry = 1; retry <= 2; retry++) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type':  'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: 'system',
                content: `You are the senior customer support email writer for BBW4LIFE — a premium plus-size fashion and lifestyle brand with the tagline "Beauty Has No Sizes".

BRAND VOICE:
- Warm, professional, deeply human — like a best friend who genuinely cares
- Never condescending, never robotic, never generic

WRITING RULES:
1. Write ONLY the email body — no subject line, no extra commentary
2. Stay STRICTLY on the topic of the support notes provided — do not add unrelated information
3. NO bullet points, NO markdown, NO asterisks
4. Maximum 3 sentences per paragraph
5. Every sentence must feel intentional — no filler
6. NEVER use: "embark on", "unleash", "game-changer"
7. ALWAYS use: conversational contractions (you're, we're, it's)
8. Output: Plain text only. Separate paragraphs with a blank line.
9. Start with a warm personal greeting using the customer's first name
10. End with a warm sign-off from the BBW4LIFE team
11. IMPORTANT: Only address what is in the support notes. Do not invent details, promises, or topics not mentioned.`
              },
              { role: 'user', content: userPrompt }
            ],
            max_tokens:  500,
            temperature: 0.60,
            top_p:       0.88,
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

// ── Sheets ─────────────────────────────────────────────────────
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

// ── Settings ───────────────────────────────────────────────────
async function loadSettings() {
  try {
    const res  = await fetch(`${BASE_URL}/products.data.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const arr  = Array.isArray(data) ? data : [];
    return arr.find(p => p.type === 'settings') || {};
  } catch (e) {
    console.warn('[Settings] Failed to load:', e.message);
    return {};
  }
}

// ── Social icons ───────────────────────────────────────────────
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

// ── CEO Footer ─────────────────────────────────────────────────
function buildCEOFooter(settings) {
  const ceo      = settings.founder || settings.ceo || {};
  const support  = (settings.contact_emails || {}).general || 'support@bbw4life.com';
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
          <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:26px;font-weight:700;
              color:${BBW.white};letter-spacing:0.05em;">
            BBW<span style="color:${BBW.pink};">4</span>LIFE
          </p>
          <div style="width:40px;height:1px;background:${BBW.pink};margin:0 auto 6px;"></div>
          <p style="margin:0 0 18px;font-family:Arial,sans-serif;font-size:10px;
              color:rgba(255,255,255,0.45);letter-spacing:0.15em;text-transform:uppercase;">
            Stay Connected
          </p>
          ${buildSocialIcons(settings)}
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
            You are receiving this email because you contacted BBW4LIFE support.<br>
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

// ── Master Template ────────────────────────────────────────────
function buildEmailHTML(subjectResp, aiBody, settings) {
  const founder = settings.founder || settings.ceo || {};
  const heroImg = founder.hero_image
    || 'https://cdn.shopify.com/s/files/1/0746/5346/6724/files/bbw.email.png?v=1782613828';

  const logoHTML = `
<p style="margin:0;font-family:Georgia,serif;font-size:48px;font-weight:700;
    color:${BBW.white};letter-spacing:0.02em;line-height:1;">
  BBW<span style="color:${BBW.pink};">4</span>LIFE<span style="color:${BBW.pink};font-size:28px;">♡</span>
</p>
<div style="width:60px;height:2px;background:${BBW.pink};margin:10px 0 16px;"></div>`;

  const bodyParagraphs = aiBody.split('\n').filter(p => p.trim()).map(p =>
    `<p style="margin:0 0 18px;font-family:Arial,sans-serif;font-size:15px;color:${BBW.textMid};line-height:1.75;">${p}</p>`
  ).join('');

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
  ${subjectResp} — BBW4LIFE Support&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;
</div>

<table width="100%" cellpadding="0" cellspacing="0" role="presentation"
       style="background:#f9eef3;padding:24px 16px;">
  <tr><td align="center">
    <table class="ew" width="600" cellpadding="0" cellspacing="0" role="presentation"
           style="max-width:600px;width:100%;border-radius:0;overflow:hidden;
                  box-shadow:0 16px 48px rgba(192,56,94,0.20);">

      <!-- HEADER -->
      <tr>
        <td style="background:${BBW.black};padding:0;position:relative;">

          <!-- Tagline strip -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td style="padding:12px 32px 0;text-align:center;">
                <p style="margin:0;font-family:Arial,sans-serif;font-size:10px;
                    color:rgba(255,255,255,0.55);letter-spacing:0.20em;text-transform:uppercase;">
                  CONFIDENCE. BEAUTY. EMPOWERMENT. &nbsp;♥
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
                  SUPPORT <span style="color:${BBW.pink};">RESPONSE.</span>
                </p>
                <p style="margin:0 0 24px;font-family:Arial,sans-serif;font-size:13px;
                    font-weight:700;color:rgba(255,255,255,0.75);letter-spacing:0.04em;text-transform:uppercase;">
                  WE'RE HERE FOR YOU.
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

          <!-- Wave SVG transition noir → blanc -->
          <div style="line-height:0;font-size:0;display:block;overflow:hidden;">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 48" width="600" height="48"
                 style="display:block;width:100%;height:auto;" preserveAspectRatio="none">
              <path d="M0,0 C150,48 450,0 600,32 L600,48 L0,48 Z" fill="${BBW.pink}" opacity="0.9"/>
              <path d="M0,16 C200,48 400,8 600,40 L600,48 L0,48 Z" fill="${BBW.white}"/>
            </svg>
          </div>
        </td>
      </tr>

      <!-- BODY -->
      <tr>
        <td class="ep" style="background:${BBW.white};padding:36px 40px 36px;">
          ${bodyParagraphs}
          <div style="height:8px;"></div>
        </td>
      </tr>

      <!-- CEO FOOTER -->
      ${buildCEOFooter(settings)}

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

// ── Resend ─────────────────────────────────────────────────────
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
//  HANDLER
// ════════════════════════════════════════════════════════════════
exports.handler = async () => {
  console.log('[reply-contact-message] Starting — ' + new Date().toISOString());

  try {
    const sheets        = getSheets();
    const spreadsheetId = process.env.SHEET_ID_BBW4LIFE_ACCOUNTS;
    const SHEET         = 'bbw4life-contact-messages';
    const settings      = await loadSettings();

    const res  = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET}!A:J`
    });
    const rows = res.data.values || [];

    if (rows.length <= 1) {
      console.log('[reply-contact-message] No rows found');
      return { statusCode: 200, body: JSON.stringify({ success: true, processed: 0 }) };
    }

    let processed = 0;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];

      const firstName       = row[0] || '';
      const lastName        = row[1] || '';
      const email           = row[2] || '';
      const originalSubject = row[3] || '';
      const category        = row[4] || '';
      const message         = row[5] || '';
      const subjectResp     = (row[7] !== undefined ? row[7] : '').trim();
      const response        = (row[8] !== undefined ? row[8] : '').trim();
      const repliedAt       = (row[9] !== undefined ? row[9] : '').trim();

      if (!subjectResp || !response) continue;
      if (repliedAt && !repliedAt.startsWith('pending:')) continue;
      if (!email || !email.includes('@')) continue;

      console.log(`[reply-contact-message] Processing row ${i + 1} — ${email} — repliedAt: "${repliedAt}"`);

      if (!repliedAt) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range:            `${SHEET}!J${i + 1}`,
          valueInputOption: 'RAW',
          resource:         { values: [[`pending:${new Date().toISOString()}`]] }
        });
        console.log(`[reply-contact-message] Row ${i + 1} — marked as pending, will send in 2min`);
        await sleep(500);
        continue;
      }

      if (repliedAt.startsWith('pending:')) {
        const pendingTime         = new Date(repliedAt.replace('pending:', ''));
        const minutesSincePending = (Date.now() - pendingTime.getTime()) / (1000 * 60);

        if (minutesSincePending < 30) {
          console.log(`[reply-contact-message] Row ${i + 1} — pending since ${minutesSincePending.toFixed(1)} min, waiting`);
          await sleep(500);
          continue;
        }

        console.log(`[reply-contact-message] Row ${i + 1} — ${minutesSincePending.toFixed(1)} min elapsed, sending to ${email}`);

        const aiPrompt = `You are replying to a customer support message for BBW4LIFE.

CUSTOMER: ${firstName} ${lastName}
ORIGINAL SUBJECT: ${originalSubject}
CATEGORY: ${category}
CUSTOMER MESSAGE: ${message}

RESPONSE SUBJECT: ${subjectResp}
SUPPORT TEAM NOTES: ${response}

Write a warm, professional email body. Use ONLY the support notes as your basis. Do not add anything not mentioned in the notes. Address the customer by first name. Keep it focused and on-topic.`;

        const aiBody = await callGroq(aiPrompt) || response;
        const html   = buildEmailHTML(subjectResp, aiBody, settings);
        const ok     = await deliver(email, subjectResp, html);

        if (ok) {
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range:            `${SHEET}!J${i + 1}`,
            valueInputOption: 'RAW',
            resource:         { values: [[`sent:${new Date().toISOString()}`]] }
          });
          console.log(`[reply-contact-message] ✅ Reply sent to ${email}`);
          processed++;
        }

        await sleep(500);
      }
    }

    console.log(`[reply-contact-message] Done — processed: ${processed}`);
    return { statusCode: 200, body: JSON.stringify({ success: true, processed }) };

  } catch (error) {
    console.error('[reply-contact-message] ERROR:', error.message);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
  }
};