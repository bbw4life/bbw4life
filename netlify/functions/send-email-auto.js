// netlify/functions/send-email-auto.js
// BBW4LIFE — Automatic transactional & marketing email engine (Resend)

process.removeAllListeners('warning');
const fetch = require('node-fetch');
const { google } = require('googleapis');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL      = process.env.FROM_EMAIL;
const BASE_URL        = process.env.BASE_URL;

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

const BRAND = {
  black:  '#0d0d0d',
  gold:   '#c9963e',
  ivory:  '#fdf8ef',
  rose:   '#c0385e',
  plum:   '#7b3f6e',
  textMuted: '#7a7a7a'
};

// Live settings from products.data.json (social links, founder info, etc.)
async function getSiteSettings() {
  try {
    const res = await fetch(`${BASE_URL}/products.data.json`);
    if (!res.ok) throw new Error(`products.data.json fetch failed: ${res.status}`);
    const data = await res.json();
    const settings = (Array.isArray(data) ? data : []).find(p => p.type === 'settings') || {};
    return settings;
  } catch (err) {
    console.warn('[EMAIL] Could not load products.data.json, using fallback settings:', err.message);
    return {};
  }
}

// Newsletter sequence tracker — tracks which steps were sent per email
const SEQUENCE_TAB   = 'bbw4life-newsletter-sequence';
const SEQUENCE_RANGE = `${SEQUENCE_TAB}!A:E`;

function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key:  process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  return google.sheets({ version: 'v4', auth });
}

async function ensureSequenceTabExists(sheets, spreadsheetId) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = meta.data.sheets.some(s => s.properties.title === SEQUENCE_TAB);
  if (exists) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    resource: { requests: [{ addSheet: { properties: { title: SEQUENCE_TAB } } }] }
  });

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: SEQUENCE_RANGE,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    resource: { values: [['Email', 'Step1 (J+0)', 'Step2 (J+3)', 'Step3 (J+5)', 'Step4 (J+10)']] }
  });
}

function normalizeEmail(e) {
  return (e || '').trim().toLowerCase();
}

// Returns { rowIndex, rowNum, row } or { rowIndex: -1 } if not found
async function findSequenceRow(sheets, spreadsheetId, email) {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: SEQUENCE_RANGE });
  const rows = res.data.values || [];
  const idx = rows.findIndex(r => normalizeEmail(r[0]) === normalizeEmail(email));
  return { rowIndex: idx, rowNum: idx + 1, rows, row: idx !== -1 ? rows[idx] : null };
}

// step: 1..4  -> marks the given step as sent "now" for that email.
// Creates the row if it doesn't exist yet.
async function markSequenceStepSent(email, step) {
  try {
    const spreadsheetId = process.env.SHEET_ID_BBW4LIFE_ACCOUNTS;
    const sheets = getSheetsClient();
    await ensureSequenceTabExists(sheets, spreadsheetId);

    const { rowIndex, rowNum } = await findSequenceRow(sheets, spreadsheetId, email);
    const colLetter = ['B', 'C', 'D', 'E'][step - 1];
    const now = new Date().toISOString();

    if (rowIndex === -1) {
      const values = [['', '', '', '', '']];
      values[0][0] = email;
      values[0][step] = now; // step 1 -> index 1 = column B, etc.
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: SEQUENCE_RANGE,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: { values }
      });
    } else {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${SEQUENCE_TAB}!${colLetter}${rowNum}`,
        valueInputOption: 'RAW',
        resource: { values: [[now]] }
      });
    }
  } catch (e) {
    console.warn('[EMAIL] markSequenceStepSent failed:', e.message);
  }
}

// Returns true if the given step (1..4) was already sent to this email.
async function wasSequenceStepSent(email, step) {
  try {
    const spreadsheetId = process.env.SHEET_ID_BBW4LIFE_ACCOUNTS;
    const sheets = getSheetsClient();
    await ensureSequenceTabExists(sheets, spreadsheetId);
    const { row } = await findSequenceRow(sheets, spreadsheetId, email);
    if (!row) return false;
    return !!(row[step] && row[step].trim() !== '');
  } catch (e) {
    console.warn('[EMAIL] wasSequenceStepSent failed:', e.message);
    return false;
  }
}

// Generic Resend sender
async function sendEmail({ to, subject, html }) {
  if (!RESEND_API_KEY || !FROM_EMAIL) {
    console.warn('[EMAIL] Missing RESEND_API_KEY or FROM_EMAIL — skipping send.');
    return { success: false, skipped: true, reason: 'Missing env vars' };
  }
  if (!to || !to.includes('@')) {
    console.warn('[EMAIL] Invalid recipient, skipping send:', to);
    return { success: false, skipped: true, reason: 'Invalid recipient' };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type':  'application/json'
      },
      body: JSON.stringify({
        from:    FROM_EMAIL,
        to:      [to],
        subject: subject,
        html:    html
      })
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('[EMAIL] Resend error:', JSON.stringify(data));
      return { success: false, error: data };
    }
    console.log(`[EMAIL] ✅ Sent "${subject}" to ${to} (id: ${data.id || 'n/a'})`);
    return { success: true, id: data.id };
  } catch (err) {
    console.error('[EMAIL] Send failed:', err.message);
    return { success: false, error: err.message };
  }
}

// Social icons (SVG), links pulled dynamically from settings.social_links
function socialIconsHTML(socialLinks) {
  const ICONS = {
    facebook: {
      url: socialLinks.facebook,
      svg: `<svg width="20" height="20" viewBox="0 0 512 509.64" xmlns="http://www.w3.org/2000/svg"><rect fill="#0866FF" width="512" height="509.64" rx="115.612" ry="115.612"/><path fill="#fff" d="M287.015 509.64h-92.858V332.805h-52.79v-78.229h52.79v-33.709c0-87.134 39.432-127.522 124.977-127.522 16.217 0 44.203 3.181 55.651 6.361v70.915c-6.043-.636-16.536-.953-29.576-.953-41.976 0-58.194 15.9-58.194 57.241v27.667h83.618l-14.365 78.229h-69.253V509.64z"/></svg>`
    },
    instagram: {
      url: socialLinks.instagram,
      svg: `<svg width="20" height="20" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><rect width="512" height="512" rx="115" fill="#c9963e"/><path fill="#fff" fill-rule="nonzero" transform="translate(0,-1)" d="M170.663 256.157c-.083-47.121 38.055-85.4 85.167-85.482 47.121-.092 85.407 38.029 85.499 85.159.091 47.13-38.047 85.4-85.176 85.492-47.112.09-85.399-38.039-85.49-85.169zm-46.108.092c.141 72.602 59.106 131.327 131.69 131.185 72.592-.14 131.35-59.089 131.209-131.691-.141-72.577-59.114-131.336-131.715-131.194-72.585.141-131.325 59.114-131.184 131.7zm237.104-137.092c.033 16.954 13.817 30.682 30.772 30.649 16.961-.034 30.689-13.811 30.664-30.765-.033-16.954-13.818-30.69-30.78-30.656-16.962.033-30.689 13.818-30.656 30.772z"/></svg>`
    },
    twitter: {
      url: socialLinks.twitter,
      svg: `<svg width="20" height="20" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><path d="M256 0c141.385 0 256 114.615 256 256S397.385 512 256 512 0 397.385 0 256 114.615 0 256 0z" fill="#0d0d0d"/><path fill="#fff" fill-rule="nonzero" d="M318.64 157.549h33.401l-72.973 83.407 85.85 113.495h-67.222l-52.647-68.836-60.242 68.836h-33.423l78.052-89.212-82.354-107.69h68.924l47.59 62.917 55.044-62.917z"/></svg>`
    },
    pinterest: {
      url: socialLinks.pinterest,
      svg: `<svg width="20" height="20" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><circle cx="256" cy="256" r="256" fill="#E60019"/><path fill="#fff" fill-rule="nonzero" d="M256 110c-80.59 0-146 65.41-146 146 0 60.06 36.27 111.6 88.07 134.04-1.34-11.39-2.76-30.18.3-43.18 2.64-11.34 17.05-72.21 17.05-72.21s-4.34-8.69-4.34-21.57c0-20.18 11.71-35.26 26.29-35.26 12.4 0 18.39 9.31 18.39 20.46 0 12.46-7.94 31.1-12.04 48.36-3.42 14.46 7.26 26.25 21.51 26.25 25.83 0 45.69-27.21 45.69-66.52 0-34.81-25.01-59.13-60.7-59.13-41.34 0-65.6 31.01-65.6 63.08 0 12.5 4.8 25.88 10.81 33.16.43.4.59.91.59 1.19 0 .4-.06.8-.17 1.19-1.11 4.6-3.57 14.46-4.04 16.48-.65 2.65-2.11 3.23-4.87 1.94-18.15-8.45-29.47-34.99-29.47-56.28 0-45.84 33.31-87.94 96-87.94 50.41 0 89.6 35.93 89.6 83.95 0 50.09-31.58 90.4-75.43 90.4-14.74 0-28.59-7.67-33.31-16.71 0 0-7.28 27.77-9.05 34.55-3.43 13.19-12.94 29.88-18.84 39.36 13.6 4.2 28.02 6.44 43 6.44 80.59 0 146-65.4 146-146 0-80.59-65.41-146-146-146z"/></svg>`
    },
    tiktok: {
      url: socialLinks.tiktok,
      svg: `<svg width="20" height="20" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><circle cx="256" cy="256" r="256" fill="#0d0d0d"/><path fill="#c9963e" fill-rule="nonzero" d="M344.487 161.312c11.585 11.945 26.033 19.226 40.593 22.539v37.979c-21.029 0-40.931-4.012-58.467-15.823 17.536 20.421 45.192 26.8 71.721 26.8v46.972c-26.529 0-51.3-6.379-71.721-26.8v104.402c0 64.057-49.001 98.002-95.184 98.002-46.183 0-95.184-33.945-95.184-98.002 0-51.569 43.388-93.155 95.206-93.155 4.598 0 9.196.25 13.006 1.015v50.849c-31.646-3.336-55.38 12.712-55.38 43.073 0 27.431 19.992 47.166 47.358 47.166 22.967 0 41.855-16.905 41.855-43.185V101.146h47.22c3.47 21.495 12.246 37.706 23.563 49.317 1.74 1.815 3.55 3.55 5.422 5.205z"/></svg>`
    },
    youtube: {
      url: socialLinks.youtube,
      svg: `<svg width="20" height="20" viewBox="0 0 124.08 123.51" xmlns="http://www.w3.org/2000/svg"><path fill="#0d0d0d" d="M28.35.6H95.73a27.83,27.83,0,0,1,27.75,27.75V95.17a27.83,27.83,0,0,1-27.75,27.74H28.35A27.83,27.83,0,0,1,.6,95.17V28.35A27.83,27.83,0,0,1,28.35.6Z"/><path fill="#c9963e" d="M104.91,44.26s-.85-6-3.48-8.69c-3.33-3.48-7.07-3.5-8.77-3.71C80.42,31,62,31,62,31h0s-18.37,0-30.62.89c-1.71.21-5.44.23-8.77,3.71-2.63,2.65-3.47,8.69-3.47,8.69a133.12,133.12,0,0,0-.87,14.17v6.64a133.37,133.37,0,0,0,.87,14.17s.86,6,3.47,8.69c3.33,3.48,7.71,3.37,9.67,3.74,7,.67,29.76.87,29.76.87s18.4,0,30.64-.91c1.71-.2,5.44-.22,8.77-3.7,2.63-2.65,3.49-8.69,3.49-8.69a133.18,133.18,0,0,0,.87-14.18V58.43a136.86,136.86,0,0,0-.89-14.18Z"/><polygon fill="#0d0d0d" points="52.97 73.11 52.97 48.51 76.61 60.86 52.97 73.11"/></svg>`
    },
    whatsapp: {
      url: socialLinks.whatsapp,
      svg: `<svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="12" fill="#25D366"/><path fill="#fff" d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.46-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51-.17-.01-.37-.01-.57-.01-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35z"/></svg>`
    }
  };

  return Object.values(ICONS)
    .filter(icon => icon.url)
    .map(icon => `
      <a href="${icon.url}" target="_blank" style="display:inline-block;margin:0 6px;text-decoration:none;">
        ${icon.svg}
      </a>`)
    .join('');
}

// Shared HTML shell (header + footer)
function emailShell({ settings, preheader, bodyHTML, unsubscribeUrl }) {
  const social   = settings.social_links || {};
  const contact  = settings.contact || {};
  const founder  = settings.founder || {};
  const founderName  = founder.full_name || founder.name || 'Francenel';
  const founderTitle = founder.title || 'Founder, BBW4LIFE';

  const socialHTML = socialIconsHTML(social);
  const unsubLink  = unsubscribeUrl || `${BASE_URL}/page/contact.html`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>BBW4LIFE</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f1ea;font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;">

  <!-- Preheader (hidden preview text) -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader || ''}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f1ea;padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:${BRAND.ivory};border-radius:14px;overflow:hidden;box-shadow:0 8px 28px rgba(0,0,0,0.08);">

          <!-- HEADER -->
          <tr>
            <td style="background:linear-gradient(135deg, ${BRAND.black} 0%, #1a1a1a 100%);padding:36px 40px 30px;text-align:center;">
              <div style="font-family:Georgia, 'Times New Roman', serif;font-size:30px;font-weight:700;letter-spacing:2px;color:${BRAND.ivory};">
                BBW<span style="color:${BRAND.gold};">4</span>LIFE
              </div>
              <div style="margin-top:6px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${BRAND.gold};">
                Beauty Has No Sizes
              </div>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="padding:40px 40px 24px;color:${BRAND.black};">
              ${bodyHTML}
            </td>
          </tr>

          <!-- FOUNDER STRIP -->
          <tr>
            <td style="padding:0 40px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e7ddc9;padding-top:20px;">
                <tr>
                  <td style="font-size:12.5px;color:${BRAND.textMuted};font-style:italic;line-height:1.6;">
                    "Beauty Has No Sizes." — A message from ${founderName}, ${founderTitle}.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background-color:${BRAND.black};padding:30px 40px;text-align:center;">
              <div style="margin-bottom:16px;">
                ${socialHTML}
              </div>
              <div style="font-size:12px;color:#b8b8b8;line-height:1.9;">
                <a href="${BASE_URL}/index.html" style="color:${BRAND.gold};text-decoration:none;margin:0 8px;">Home</a>
                <a href="${BASE_URL}/collections/bbw4life-all-product.html" style="color:${BRAND.gold};text-decoration:none;margin:0 8px;">Shop</a>
                <a href="${BASE_URL}/page/contact.html" style="color:${BRAND.gold};text-decoration:none;margin:0 8px;">Contact</a>
                <a href="${BASE_URL}/page/order-tracking.html" style="color:${BRAND.gold};text-decoration:none;margin:0 8px;">Track Order</a>
              </div>
              <div style="margin-top:18px;font-size:11px;color:#777;line-height:1.7;">
                © ${new Date().getFullYear()} BBW4LIFE. All rights reserved.<br>
                You're receiving this email because you interacted with BBW4LIFE.<br>
                <a href="${unsubLink}" style="color:#999;text-decoration:underline;">Unsubscribe</a> ·
                <a href="${BASE_URL}/policies/privacy.html" style="color:#999;text-decoration:underline;">Privacy Policy</a>
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Reusable UI pieces
function ctaButton(label, url) {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px auto 4px;">
      <tr>
        <td style="border-radius:8px;background:linear-gradient(135deg, ${BRAND.gold}, #b9853a);">
          <a href="${url}" style="display:inline-block;padding:15px 36px;font-size:14px;font-weight:700;letter-spacing:0.5px;color:#0d0d0d;text-decoration:none;border-radius:8px;text-transform:uppercase;">
            ${label}
          </a>
        </td>
      </tr>
    </table>`;
}

function greeting(firstName) {
  const name = firstName ? firstName.charAt(0).toUpperCase() + firstName.slice(1) : 'there';
  return `<p style="font-size:16px;color:${BRAND.black};margin:0 0 18px;">Hi ${name},</p>`;
}

function sectionTitle(text) {
  return `<h1 style="font-family:Georgia, 'Times New Roman', serif;font-size:24px;color:${BRAND.black};margin:0 0 18px;line-height:1.3;">${text}</h1>`;
}

function paragraph(text) {
  return `<p style="font-size:15px;line-height:1.7;color:#3a3a3a;margin:0 0 16px;">${text}</p>`;
}

function promoBadge(code, percent) {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:24px auto;">
      <tr>
        <td style="border:2px dashed ${BRAND.gold};border-radius:10px;padding:18px 30px;text-align:center;background-color:#fbf6ea;">
          <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${BRAND.textMuted};margin-bottom:6px;">Your Exclusive Code</div>
          <div style="font-size:26px;font-weight:800;color:${BRAND.rose};letter-spacing:1px;">${code}</div>
          <div style="font-size:13px;color:${BRAND.black};margin-top:6px;">Save ${percent}% on your order</div>
        </td>
      </tr>
    </table>`;
}

function orderItemsTable(items) {
  if (!Array.isArray(items) || !items.length) return '';
  const rows = items.map(item => {
    const title    = item.title || 'Item';
    const variant  = [item.color, item.size].filter(Boolean).join(' · ');
    const qty      = item.quantity || 1;
    const price    = parseFloat(item.price || item.lineTotal || 0);
    const img      = item.image_variant || item.image || '';
    const imgHTML  = img
      ? `<img src="${img}" width="56" height="56" style="border-radius:8px;object-fit:cover;display:block;" alt="${title}">`
      : '';
    return `
      <tr>
        <td style="padding:10px 0;width:56px;">${imgHTML}</td>
        <td style="padding:10px 0 10px 14px;">
          <div style="font-size:14px;font-weight:600;color:${BRAND.black};">${title}</div>
          ${variant ? `<div style="font-size:12px;color:${BRAND.textMuted};margin-top:2px;">${variant}</div>` : ''}
          <div style="font-size:12px;color:${BRAND.textMuted};margin-top:2px;">Qty: ${qty}</div>
        </td>
        <td style="padding:10px 0;text-align:right;font-size:14px;font-weight:600;color:${BRAND.black};white-space:nowrap;">
          $${(price * (item.lineTotal ? 1 : qty)).toFixed(2)}
        </td>
      </tr>`;
  }).join('<tr><td colspan="3" style="border-bottom:1px solid #ece4d3;"></td></tr>');

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border-top:1px solid #ece4d3;border-bottom:1px solid #ece4d3;">
      ${rows}
    </table>`;
}

// TEMPLATE 1 — WELCOME (account created)
function tplWelcome({ firstName, settings }) {
  const body = `
    ${sectionTitle('Welcome to the Family 👑')}
    ${greeting(firstName)}
    ${paragraph(`Your BBW4LIFE account has been created successfully — and we couldn't be happier to have you with us.`)}
    ${paragraph(`At BBW4LIFE, beauty truly has no sizes. We built this space to celebrate every curve, every shape, every story — yours included. Explore our latest collections, discover exclusive offers, and join a community that sees you exactly as you are: powerful, radiant, and worthy.`)}
    ${ctaButton('Start Exploring', `${BASE_URL}/collections/bbw4life-all-product.html`)}
    ${paragraph(`If you ever have a question, our team is always here for you.`)}
  `;
  return {
    subject: '👑 Welcome to BBW4LIFE — Your Account Is Ready!',
    html: emailShell({ settings, preheader: 'Your BBW4LIFE account is ready. Beauty has no sizes.', bodyHTML: body })
  };
}

// TEMPLATE 2 — ORDER CONFIRMATION
function tplOrderConfirm({ firstName, orderId, items, total, shippingAddress, settings }) {
  const body = `
    ${sectionTitle('Your Order Is Confirmed! 🎉')}
    ${greeting(firstName)}
    ${paragraph(`Thank you for your order — we're already preparing it with love and care.`)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fbf6ea;border-radius:10px;padding:16px 20px;margin:10px 0 4px;">
      <tr>
        <td style="font-size:13px;color:${BRAND.textMuted};">Order Number</td>
        <td style="font-size:13px;color:${BRAND.black};font-weight:700;text-align:right;">#${orderId || 'N/A'}</td>
      </tr>
    </table>
    ${orderItemsTable(items)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 18px;">
      <tr>
        <td style="font-size:15px;font-weight:700;color:${BRAND.black};">Total</td>
        <td style="font-size:18px;font-weight:800;color:${BRAND.rose};text-align:right;">$${parseFloat(total || 0).toFixed(2)}</td>
      </tr>
    </table>
    ${shippingAddress ? paragraph(`<strong>Shipping to:</strong> ${shippingAddress}`) : ''}
    ${paragraph(`As soon as your tracking number is available, we'll send it to you right away.`)}
    ${ctaButton('Track My Order', `${BASE_URL}/page/order-tracking.html`)}
  `;
  return {
    subject: `🎉 Order Confirmed — #${orderId || ''} | BBW4LIFE`,
    html: emailShell({ settings, preheader: 'Your BBW4LIFE order has been confirmed and is being prepared.', bodyHTML: body })
  };
}

// TEMPLATE 3 — TRACKING NUMBER AVAILABLE (ready to be called by a future scheduled polling function)
function tplOrderTracking({ firstName, orderId, trackingNumber, carrier, settings }) {
  const body = `
    ${sectionTitle('Your Order Is On Its Way! 📦')}
    ${greeting(firstName)}
    ${paragraph(`Great news — your package has shipped and is now on its way to you.`)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fbf6ea;border-radius:10px;padding:18px 20px;margin:16px 0 22px;">
      <tr><td style="font-size:13px;color:${BRAND.textMuted};">Order Number</td><td style="font-size:13px;font-weight:700;text-align:right;color:${BRAND.black};">#${orderId || 'N/A'}</td></tr>
      <tr><td colspan="2" style="height:8px;"></td></tr>
      <tr><td style="font-size:13px;color:${BRAND.textMuted};">Tracking Number</td><td style="font-size:13px;font-weight:700;text-align:right;color:${BRAND.rose};">${trackingNumber || 'N/A'}</td></tr>
      ${carrier ? `<tr><td colspan="2" style="height:8px;"></td></tr><tr><td style="font-size:13px;color:${BRAND.textMuted};">Carrier</td><td style="font-size:13px;font-weight:700;text-align:right;color:${BRAND.black};">${carrier}</td></tr>` : ''}
    </table>
    ${paragraph(`Track every step of your delivery in real-time on our Order Tracking page.`)}
    ${ctaButton('Track My Package', `${BASE_URL}/page/order-tracking.html`)}
  `;
  return {
    subject: `📦 Your BBW4LIFE Order Has Shipped — Tracking #${trackingNumber || ''}`,
    html: emailShell({ settings, preheader: 'Your tracking number is ready. Follow your delivery in real time.', bodyHTML: body })
  };
}

// TEMPLATE 4 — NEWSLETTER J+0 (Welcome to the family)
function tplNewsletter1({ firstName, settings }) {
  const body = `
    ${sectionTitle('You\'re Officially Part of the Family 💛')}
    ${greeting(firstName)}
    ${paragraph(`Thank you for joining the BBW4LIFE family! From now on, you'll be the first to know about our newest collections, exclusive offers, and everything happening behind the scenes.`)}
    ${paragraph(`This isn't just a newsletter — it's an invitation into a community built around one simple truth: beauty has no sizes.`)}
    ${ctaButton('Explore the Collection', `${BASE_URL}/collections/bbw4life-all-product.html`)}
  `;
  return {
    subject: '💛 Welcome to the BBW4LIFE Family!',
    html: emailShell({ settings, preheader: 'You\'ll be the first to know about new drops & exclusive offers.', bodyHTML: body })
  };
}

// TEMPLATE 5 — NEWSLETTER J+3 (Engagement)
function tplNewsletter2({ firstName, settings }) {
  const body = `
    ${sectionTitle('How Are You Feeling So Far? 💭')}
    ${greeting(firstName)}
    ${paragraph(`We'd love to hear from you. How has your experience on BBW4LIFE been so far?`)}
    ${paragraph(`Is there something you're looking for that you haven't found yet? A style, a size, a category you wish we carried? Your voice genuinely shapes what we build next.`)}
    ${ctaButton('Tell Us What You Think', `${BASE_URL}/page/contact.html`)}
    ${paragraph(`We read every single message — and we can't wait to hear yours.`)}
  `;
  return {
    subject: 'We\'d Love to Hear From You 💭',
    html: emailShell({ settings, preheader: 'What\'s missing? What are you looking for? Tell us.', bodyHTML: body })
  };
}

// TEMPLATE 6 — NEWSLETTER J+5 (VIP warm email)
function tplNewsletter3({ firstName, settings }) {
  const promos = settings.promos || [];
  const promo  = promos[0] || { code: 'PAUL81', percent: 40 };

  const body = `
    ${sectionTitle('You Are Truly Important to Us 👑')}
    ${greeting(firstName)}
    ${paragraph(`We just wanted to take a moment to remind you: you are valued here. Not just as a customer, but as part of something bigger — a movement that celebrates every curve, unapologetically.`)}
    ${paragraph(`As a thank you, here's an exclusive code reserved for our community:`)}
    ${promoBadge(promo.code, promo.percent)}
    ${paragraph(`We also have beautiful bundle deals waiting for you — carefully put together to give you more for less.`)}
    ${ctaButton('Shop With My Code', `${BASE_URL}/collections/bbw4life-all-product.html`)}
  `;
  return {
    subject: '👑 You\'re VIP — Here\'s Something Special For You',
    html: emailShell({ settings, preheader: `Exclusive code inside: ${promo.code} — ${promo.percent}% off.`, bodyHTML: body })
  };
}

// TEMPLATE 7 — NEWSLETTER J+10 (BUYER — loyalty)
function tplNewsletter4Buyer({ firstName, settings }) {
  const body = `
    ${sectionTitle('Thank You for Trusting Us 🤍')}
    ${greeting(firstName)}
    ${paragraph(`We wanted to take a moment to genuinely thank you for your order with BBW4LIFE. Customers like you are the reason this brand exists.`)}
    ${paragraph(`We'd love to know — how was your experience? Did the piece make you feel as confident and beautiful as we hoped it would?`)}
    ${ctaButton('Share Your Experience', `${BASE_URL}/page/contact.html`)}
    ${paragraph(`And while you're here — we've just added new arrivals we think you'll love.`)}
    ${ctaButton('Discover What\'s New', `${BASE_URL}/collections/bbw4life-new-arrivals.html`)}
  `;
  return {
    subject: '🤍 Thank You for Being Part of BBW4LIFE',
    html: emailShell({ settings, preheader: 'How was your experience? Plus, new arrivals just for you.', bodyHTML: body })
  };
}

// TEMPLATE 8 — NEWSLETTER J+10 (NEW / never ordered — incentive)
function tplNewsletter4New({ firstName, settings }) {
  const promos = settings.promos || [];
  const promo  = promos[1] || promos[0] || { code: 'CURVA15', percent: 20 };

  const body = `
    ${sectionTitle('Your First Order Is Waiting For You 🎁')}
    ${greeting(firstName)}
    ${paragraph(`We noticed you haven't placed your first order with us yet — and we'd love to change that with something special.`)}
    ${paragraph(`Here's an exclusive code, just for you, to make your first BBW4LIFE experience unforgettable:`)}
    ${promoBadge(promo.code, promo.percent)}
    ${paragraph(`Whatever your style — bold, elegant, playful, glamorous — we have something made for your curves.`)}
    ${ctaButton('Claim My Discount', `${BASE_URL}/collections/bbw4life-all-product.html`)}
  `;
  return {
    subject: `🎁 A Gift For Your First Order — ${promo.percent}% Off`,
    html: emailShell({ settings, preheader: `Use code ${promo.code} on your first BBW4LIFE order.`, bodyHTML: body })
  };
}

// TEMPLATE 9 — CONTACT FORM REPLY
function tplContactReply({ firstName, subject, category, settings }) {
  const body = `
    ${sectionTitle('We\'ve Received Your Message ✉️')}
    ${greeting(firstName)}
    ${paragraph(`Thank you for reaching out to BBW4LIFE. We've successfully received your message and our team will get back to you as soon as possible.`)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fbf6ea;border-radius:10px;padding:16px 20px;margin:6px 0 22px;">
      <tr><td style="font-size:13px;color:${BRAND.textMuted};">Subject</td><td style="font-size:13px;font-weight:700;text-align:right;color:${BRAND.black};">${subject || 'N/A'}</td></tr>
      ${category ? `<tr><td colspan="2" style="height:8px;"></td></tr><tr><td style="font-size:13px;color:${BRAND.textMuted};">Category</td><td style="font-size:13px;font-weight:700;text-align:right;color:${BRAND.black};">${category}</td></tr>` : ''}
    </table>
    ${paragraph(`In the meantime, feel free to keep exploring our collections.`)}
    ${ctaButton('Continue Shopping', `${BASE_URL}/collections/bbw4life-all-product.html`)}
  `;
  return {
    subject: '✉️ We\'ve Received Your Message — BBW4LIFE',
    html: emailShell({ settings, preheader: 'Thanks for reaching out. We\'ll get back to you shortly.', bodyHTML: body })
  };
}

// TEMPLATE 10 — PRODUCT REQUEST RECEIVED (Plan / Featured request)
function tplPlanRequest({ firstName, program, settings }) {
  const body = `
    ${sectionTitle('Your Product Request Has Been Received 🛍️')}
    ${greeting(firstName)}
    ${paragraph(`Thank you for your interest in <strong>${program || 'this product'}</strong>! We've received your request successfully.`)}
    ${paragraph(`This item is currently being finalized by our team and will be available on the site very soon. We'll make sure you're among the first to know once it launches.`)}
    ${ctaButton('Discover More Styles', `${BASE_URL}/collections/bbw4life-all-product.html`)}
  `;
  return {
    subject: '🛍️ Your Product Request Has Been Received — BBW4LIFE',
    html: emailShell({ settings, preheader: 'We\'re finalizing this item — it will be available very soon.', bodyHTML: body })
  };
}

// TEMPLATE 11 — CUSTOM PRODUCT / DESIGN REQUEST RECEIVED
function tplCustomProduct({ firstName, productTitle, productDesc, settings }) {
  const body = `
    ${sectionTitle('Your Custom Design Request Is In! 🎨')}
    ${greeting(firstName)}
    ${paragraph(`We've received your custom design idea — and we love your creativity!`)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fbf6ea;border-radius:10px;padding:16px 20px;margin:6px 0 22px;">
      <tr><td style="font-size:13px;color:${BRAND.textMuted};">Your Idea</td><td style="font-size:13px;font-weight:700;text-align:right;color:${BRAND.black};">${productTitle || 'N/A'}</td></tr>
      ${productDesc ? `<tr><td colspan="2" style="height:10px;"></td></tr><tr><td colspan="2" style="font-size:13px;color:#3a3a3a;line-height:1.6;">${productDesc}</td></tr>` : ''}
    </table>
    ${paragraph(`Our design team is now going to work on bringing your vision to life. Once it's ready, it will be made available directly on the site — and you'll be the first to know.`)}
    ${ctaButton('Browse Current Collections', `${BASE_URL}/collections/bbw4life-all-product.html`)}
  `;
  return {
    subject: '🎨 Your Custom Design Request Has Been Received',
    html: emailShell({ settings, preheader: 'Our team is now working on bringing your design idea to life.', bodyHTML: body })
  };
}

// TEMPLATE 12 — ABANDONED CART RECOVERY (already wired from detect-abandoned-cart.js)
function tplCartAbandoned({ firstName, items, promoCode, promoPercent, restartLink, settings }) {
  const body = `
    ${sectionTitle('You Left Something Beautiful Behind 💔')}
    ${greeting(firstName)}
    ${paragraph(`We noticed you didn't quite finish your order — your selections are still saved and waiting for you.`)}
    ${orderItemsTable(items)}
    ${promoCode ? paragraph(`As a little nudge, here's an exclusive code just for you:`) : ''}
    ${promoCode ? promoBadge(promoCode, promoPercent || 20) : ''}
    ${ctaButton('Complete My Order', restartLink || `${BASE_URL}/checkout/checkout.html`)}
    ${paragraph(`Don't let it slip away — your curves deserve this.`)}
  `;
  return {
    subject: '💔 You Left Something in Your Cart — Come Back!',
    html: emailShell({ settings, preheader: 'Your cart is saved. Complete your order before it\'s gone.', bodyHTML: body })
  };
}

// MAIN HANDLER
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { trigger, email } = body;

    if (!trigger) throw new Error('Missing "trigger" field');
    if (!email || !email.includes('@')) throw new Error('Missing or invalid "email" field');

    const settings = await getSiteSettings();
    let result;

    switch (trigger) {

      /* ───────── TRIGGER 2 — Account created ───────── */
      case 'welcome': {
        const { firstName } = body;
        const tpl = tplWelcome({ firstName, settings });
        result = await sendEmail({ to: email, subject: tpl.subject, html: tpl.html });
        break;
      }

      /* ───────── TRIGGER 1 (part 1) — Order confirmed ───────── */
      case 'order_confirm': {
        const { firstName, orderId, items, total, shippingAddress } = body;
        const tpl = tplOrderConfirm({ firstName, orderId, items, total, shippingAddress, settings });
        result = await sendEmail({ to: email, subject: tpl.subject, html: tpl.html });
        break;
      }

      /* ───────── TRIGGER 1 (part 2) — Tracking number available ─────────
         NOTE: This branch is ready to receive calls from a future
         scheduled function that polls the Eprolo API every 12h for up
         to 1 day after order_confirm. Not implemented in this file. */
      case 'order_tracking': {
        const { firstName, orderId, trackingNumber, carrier } = body;
        const tpl = tplOrderTracking({ firstName, orderId, trackingNumber, carrier, settings });
        result = await sendEmail({ to: email, subject: tpl.subject, html: tpl.html });
        break;
      }

      /* ───────── TRIGGER 3 — Newsletter sequence ───────── */
      case 'newsletter_1': {
        const { firstName } = body;
        // Anti-duplicate: if step 1 was already sent to this email
        // (i.e. they already subscribed before), do not resend the
        // welcome step — wait for the normal delay before sending step 2.
        const alreadySent = await wasSequenceStepSent(email, 1);
        if (alreadySent) {
          console.log(`[EMAIL] newsletter_1 skipped — already sent to ${email} previously.`);
          result = { success: true, skipped: true, reason: 'Step 1 already sent previously' };
          break;
        }
        const tpl = tplNewsletter1({ firstName, settings });
        result = await sendEmail({ to: email, subject: tpl.subject, html: tpl.html });
        if (result.success) await markSequenceStepSent(email, 1);
        break;
      }

      case 'newsletter_2': {
        const { firstName } = body;
        const tpl = tplNewsletter2({ firstName, settings });
        result = await sendEmail({ to: email, subject: tpl.subject, html: tpl.html });
        if (result.success) await markSequenceStepSent(email, 2);
        break;
      }

      case 'newsletter_3': {
        const { firstName } = body;
        const tpl = tplNewsletter3({ firstName, settings });
        result = await sendEmail({ to: email, subject: tpl.subject, html: tpl.html });
        if (result.success) await markSequenceStepSent(email, 3);
        break;
      }

      case 'newsletter_4_buyer': {
        const { firstName } = body;
        const tpl = tplNewsletter4Buyer({ firstName, settings });
        result = await sendEmail({ to: email, subject: tpl.subject, html: tpl.html });
        if (result.success) await markSequenceStepSent(email, 4);
        break;
      }

      case 'newsletter_4_new': {
        const { firstName } = body;
        const tpl = tplNewsletter4New({ firstName, settings });
        result = await sendEmail({ to: email, subject: tpl.subject, html: tpl.html });
        if (result.success) await markSequenceStepSent(email, 4);
        break;
      }

      /* ───────── TRIGGER 4 — Contact form received ───────── */
      case 'contact_reply': {
        const { firstName, subject, category } = body;
        const tpl = tplContactReply({ firstName, subject, category, settings });
        result = await sendEmail({ to: email, subject: tpl.subject, html: tpl.html });
        break;
      }

      /* ───────── TRIGGER 5 — Product request received ───────── */
      case 'plan_request': {
        const { firstName, program } = body;
        const tpl = tplPlanRequest({ firstName, program, settings });
        result = await sendEmail({ to: email, subject: tpl.subject, html: tpl.html });
        break;
      }

      /* ───────── TRIGGER 6 — Custom design request received ───────── */
      case 'custom_product': {
        const { firstname, firstName, product_title, productTitle, product_desc, productDesc } = body;
        const fName = firstName || firstname;
        const pTitle = productTitle || product_title;
        const pDesc  = productDesc || product_desc;
        const tpl = tplCustomProduct({ firstName: fName, productTitle: pTitle, productDesc: pDesc, settings });
        result = await sendEmail({ to: email, subject: tpl.subject, html: tpl.html });
        break;
      }

      /* ───────── Abandoned cart recovery (already wired) ───────── */
      case 'cart_abandoned': {
        const { firstName, items, promoCode, promoPercent, restartLink } = body;
        const tpl = tplCartAbandoned({ firstName, items, promoCode, promoPercent, restartLink, settings });
        result = await sendEmail({ to: email, subject: tpl.subject, html: tpl.html });
        break;
      }

      default:
        throw new Error(`Unknown trigger: "${trigger}"`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, trigger, result })
    };

  } catch (error) {
    console.error('SEND EMAIL AUTO ERROR:', error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};