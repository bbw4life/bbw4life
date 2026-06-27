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

// ── Groq ──────────────────────────────────────────────────────
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
- Celebrates real bodies, real beauty, real confidence
- Never condescending, never robotic, never generic

WRITING RULES:
1. Write ONLY the requested email body — no subject line
2. NO bullet points, NO markdown, NO asterisks
3. Maximum 3 sentences per paragraph
4. Every sentence must feel intentional — no filler
5. NEVER use: "embark on", "unleash", "game-changer"
6. ALWAYS use: conversational contractions (you're, we're, it's)
7. Output: Plain text only. Separate paragraphs with a blank line.
8. Start with a warm personal greeting using the customer's first name
9. End with a warm sign-off from the BBW4LIFE team`
              },
              { role: 'user', content: userPrompt }
            ],
            max_tokens:  600,
            temperature: 0.65,
            top_p:       0.90,
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

// ── Email HTML ─────────────────────────────────────────────────
function buildEmailHTML(firstName, subject, aiBody, settings) {
  const logoUrl  = settings.logo_url || settings.logo || '';
  const support  = (settings.contact_emails || {}).general || 'support@bbw4life.com';
  const whatsapp = (settings.contact || {}).whatsapp_url   || 'https://wa.me/18292677434';
  const ceo      = settings.ceo || settings.founder || {};

  const logoHTML = logoUrl
    ? `<a href="${BASE_URL}" target="_blank" style="display:inline-block;text-decoration:none;margin-bottom:20px;">
        <img src="${logoUrl}" alt="BBW4LIFE" height="60" style="height:60px;width:auto;max-width:200px;display:block;">
       </a>`
    : `<a href="${BASE_URL}" target="_blank" style="text-decoration:none;display:inline-block;margin-bottom:20px;">
        <span style="font-family:Georgia,serif;font-size:20px;font-weight:700;color:#fff;letter-spacing:0.15em;">BBW<span style="color:#e8bc6a;">4LIFE</span></span>
       </a>`;

  const ceoHTML = ceo.name ? `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="margin-top:28px;padding-top:20px;border-top:1px solid rgba(192,56,94,0.15);">
      <tr>
        <td>
          ${ceo.photo ? `<img src="${ceo.photo}" alt="${ceo.name}" width="48" height="48"
               style="width:48px;height:48px;border-radius:50%;object-fit:cover;
                      border:2px solid #c9963e;display:inline-block;vertical-align:middle;margin-right:12px;">` : ''}
          <span style="display:inline-block;vertical-align:middle;">
            <span style="display:block;font-family:Georgia,serif;font-size:14px;font-weight:700;color:#0d0d0d;">${ceo.name}</span>
            <span style="display:block;font-family:Arial,sans-serif;font-size:12px;color:#9e8e96;">${ceo.title || 'Founder & CEO, BBW4LIFE'}</span>
          </span>
        </td>
      </tr>
    </table>` : '';

  const bodyParagraphs = aiBody.split('\n').filter(p => p.trim()).map(p =>
    `<p style="margin:0 0 18px;font-family:Arial,sans-serif;font-size:15px;color:#42383e;line-height:1.75;">${p}</p>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>BBW4LIFE</title>
  <style>
    body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
    table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}
    img{-ms-interpolation-mode:bicubic;border:0;height:auto;line-height:100%;outline:none;text-decoration:none}
    body{margin:0!important;padding:0!important;background-color:#f9f0f5}
    @media only screen and (max-width:620px){
      .ew{width:100%!important;border-radius:0!important}
      .ep{padding:24px 16px!important}
      .eh1{font-size:22px!important}
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f9f0f5;">

<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:#f9f0f5;line-height:1px;">
  ${subject} — BBW4LIFE Support&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;
</div>

<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f9f0f5;padding:32px 16px;">
  <tr><td align="center">
    <table class="ew" width="600" cellpadding="0" cellspacing="0" role="presentation"
           style="max-width:600px;width:100%;border-radius:20px;overflow:hidden;
                  box-shadow:0 20px 60px rgba(192,56,94,0.18);">

      <!-- HEADER -->
      <tr>
        <td style="background:linear-gradient(145deg,#1a0812 0%,#7b3f6e 50%,#c0385e 100%);">
          <div style="height:3px;background:linear-gradient(90deg,#c9963e,#c0385e,#e8bc6a,#c0385e,#c9963e);"></div>
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td style="padding:36px 40px 32px;text-align:center;">
                ${logoHTML}
                <div style="display:inline-block;padding:5px 18px;border-radius:20px;
                  background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.28);
                  font-family:Arial,sans-serif;font-size:11px;font-weight:700;
                  color:rgba(255,255,255,0.88);letter-spacing:0.12em;text-transform:uppercase;
                  margin-bottom:14px;">Support Response</div><br>
                <h1 class="eh1" style="margin:0;font-family:Georgia,serif;font-size:26px;
                    font-weight:700;color:#fff;line-height:1.2;letter-spacing:0.02em;">
                  ${subject}
                </h1>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- BODY -->
      <tr>
        <td class="ep" style="background:#fff;padding:36px 40px;">
          ${bodyParagraphs}
          ${ceoHTML}
        </td>
      </tr>

      <!-- FOOTER -->
      <tr>
        <td style="background:#fdf8f3;padding:20px 40px;text-align:center;border-top:1px solid rgba(192,56,94,0.12);">
          <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:#9e8e96;">
            Need more help?
            <a href="mailto:${support}" style="color:#c0385e;text-decoration:none;font-weight:600;">${support}</a>
            &nbsp;·&nbsp;
            <a href="${whatsapp}" target="_blank" style="color:#c0385e;text-decoration:none;font-weight:600;">WhatsApp</a>
          </p>
        </td>
      </tr>

      <!-- BOTTOM -->
      <tr>
        <td style="background:#1a0812;padding:20px 40px;text-align:center;">
          <p style="margin:0 0 6px;font-family:Georgia,serif;font-size:11px;color:rgba(255,255,255,0.40);letter-spacing:0.15em;">BBW4LIFE</p>
          <p style="margin:0;font-family:Arial,sans-serif;font-size:11px;color:rgba(255,255,255,0.30);font-style:italic;">Beauty Has No Sizes 👑</p>
        </td>
      </tr>

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
      const subjectResp     = (row[7] !== undefined ? row[7] : '').trim();  // col H
      const response        = (row[8] !== undefined ? row[8] : '').trim();  // col I
      const repliedAt       = (row[9] !== undefined ? row[9] : '').trim();  // col J

      // Skip si pas de réponse rédigée
      if (!subjectResp || !response) continue;

      // Skip si déjà envoyé
      if (repliedAt && !repliedAt.startsWith('pending:')) continue;

      if (!email || !email.includes('@')) continue;

      console.log(`[reply-contact-message] Processing row ${i + 1} — ${email} — repliedAt: "${repliedAt}"`);

      // ── Première détection : pas encore de pending ──
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

      // ── Pending détecté : vérifier délai ──
      if (repliedAt.startsWith('pending:')) {
        const pendingTime         = new Date(repliedAt.replace('pending:', ''));
        const minutesSincePending = (Date.now() - pendingTime.getTime()) / (1000 * 60);

        if (minutesSincePending < 2) {
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
SUPPORT TEAM NOTES (use this to write the reply): ${response}

Write a warm, professional email body responding to this customer. Use the support notes as the basis for your response. Make it feel personal and caring, not copy-paste. The customer's name is ${firstName}.`;

        const aiBody = await callGroq(aiPrompt) || response;
        const html   = buildEmailHTML(firstName, subjectResp, aiBody, settings);
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