// netlify/functions/send-email-auto.js
// ══════════════════════════════════════════════════════════════════════════════
//  CurvaFit — Automated Email Marketing System
//  All products, promos, prices loaded DYNAMICALLY from products.data.json
// ══════════════════════════════════════════════════════════════════════════════

const { google } = require('googleapis');
const { Resend }  = require('resend');
const path        = require('path');
const fs          = require('fs');

// ── ENVIRONMENT ───────────────────────────────────────────────────────────────
const SITE_URL   = process.env.SITE_URL || 'https://curvafit.com';
const FROM_EMAIL = 'CurvaFit <hello@curvafit.com>';

// ── EMAIL TYPE CONSTANTS ──────────────────────────────────────────────────────
const T = {
  WELCOME:       'welcome',
  NEWSLETTER:    'newsletter',
  REVIEW_THANKS: 'review_thanks',
  CART_ABANDON:  'abandoned_cart',
  PLAN_REQUEST:  'plan_request',
};

// ── GROQ MODELS ───────────────────────────────────────────────────────────────
const EMAIL_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-70b-versatile',
  'mixtral-8x7b-32768',
  'gemma2-9b-it',
  'llama3-70b-8192',
  'llama3-8b-8192',
  'llama-3.1-8b-instant',
  'llama-guard-3-8b',
  'llama3-groq-70b-8192-tool-use-preview',
  'llama3-groq-8b-8192-tool-use-preview',
];
let modelIdx = 0;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ════════════════════════════════════════════════════════════════════════════
//  LOAD products.data.json DYNAMICALLY
// ════════════════════════════════════════════════════════════════════════════
async function loadProductsData() {
  const localPaths = [
    path.join(process.cwd(), 'products.data.json'),
    path.join(process.cwd(), 'public', 'products.data.json'),
    path.join(process.cwd(), 'dist', 'products.data.json'),
    path.join(__dirname, '..', '..', 'products.data.json'),
    path.join(__dirname, '..', '..', 'public', 'products.data.json'),
  ];
  for (const p of localPaths) {
    try {
      if (fs.existsSync(p)) {
        console.log(`[Products] Loaded from disk: ${p}`);
        return JSON.parse(fs.readFileSync(p, 'utf8'));
      }
    } catch (e) { /* continue */ }
  }
  // Fallback: fetch from live site
  const res = await fetch(`${SITE_URL}/products.data.json`);
  if (!res.ok) throw new Error(`Cannot load products.data.json: HTTP ${res.status}`);
  console.log('[Products] Loaded from live site');
  return res.json();
}

// ── Parse products & settings from raw JSON ───────────────────────────────────
function parseProductsData(rawData) {
  const settings = rawData.find(p => p.type === 'settings') || {};
  const activeProducts = rawData.filter(p => p.type !== 'settings' && p.id && p.active !== false);

  // Build featured products list (top 4 active)
  const featured = activeProducts.slice(0, 4).map((p, index) => {
    const minPrice = p.variants && p.variants.length
      ? Math.min(...p.variants.map(v => v.price).filter(Boolean))
      : p.price;
    return {
      id:       p.id,
      title:    p.title,
      price:    `$${Number(minPrice).toFixed(2)}`,
      oldPrice: `$${Number(p.compare_price).toFixed(2)}`,
      badge:    p.badge ? (typeof p.badge === 'object' ? p.badge.text : p.badge) : 'Top Pick',
      url:      `${SITE_URL}/products/product${index + 1}.html`,
      image:    p.image,
    };
  });

  // Promos — 100% from products.data.json settings.promos, no hardcoded fallback
  const rawPromos = settings.promos || [];
  if (rawPromos.length === 0) {
    console.warn('[Products] No promos found in settings.promos — promo blocks will be skipped');
  }
  const promos = rawPromos.map(p => ({
    code:  p.code,
    label: `${p.percent}% off — ${p.items} items or more`,
  }));

  const freeShipThreshold = (settings.cart_drawer || {}).free_shipping_threshold || 120;

  return { products: activeProducts, featured, promos, settings, freeShipThreshold };
}

// ════════════════════════════════════════════════════════════════════════════
//  GROQ — AI COPY GENERATION
// ════════════════════════════════════════════════════════════════════════════

const SYSTEM_PROMPT = `You are the senior email copywriter for CurvaFit — a premium fitness and wellness brand built for curvy, plus-size women.

BRAND VOICE:
- Warm, empowering, deeply human — like a best friend who genuinely believes in you
- Never condescending, never clinical, never robotic
- Celebrates real bodies, real progress, real women
- Confident and aspirational without being pushy

WRITING RULES:
1. Write ONLY the requested content — no subject lines, no greetings, no sign-offs unless asked
2. NO bullet points, NO markdown, NO asterisks, NO hashtags
3. Maximum 3 sentences per paragraph
4. Every sentence must feel intentional — no filler phrases
5. NEVER use: "embark on", "unleash", "game-changer", "journey to success"
6. ALWAYS use: conversational contractions (you're, we're, it's), emotional truth
7. Output: Plain text only. Separate paragraphs with a blank line.`;

async function callGroq(userPrompt) {
  for (let attempt = 0; attempt < EMAIL_MODELS.length; attempt++) {
    const idx   = (modelIdx + attempt) % EMAIL_MODELS.length;
    const model = EMAIL_MODELS[idx];
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
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user',   content: userPrompt },
            ],
            max_tokens:  500,
            temperature: 0.68,
            top_p:       0.92,
          }),
        });
        if (res.status === 429) {
          if (retry < 2) { await sleep(1800); continue; }
          modelIdx = (idx + 1) % EMAIL_MODELS.length;
          break;
        }
        if (!res.ok) { console.warn(`[Groq] HTTP ${res.status} on ${model}`); break; }
        const data    = await res.json();
        const content = data.choices?.[0]?.message?.content?.trim() || '';
        if (content.length < 30) break;
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

async function generateWelcomeCopy(firstName) {
  return await callGroq(
    `EMAIL TYPE: Welcome — new CurvaFit customer just created their account.
RECIPIENT: ${firstName}
Write 2 short paragraphs (blank line between):
- Para 1 (2 sentences): Make her feel genuinely seen. Reference CurvaFit was built for her body right now.
- Para 2 (2 sentences): Describe what's waiting (shop, programs, community). End with one warm personal line.
Plain text only, no greeting, no sign-off.`
  ) || `You just made a decision that thousands of women told themselves they'd make "someday" — and you made it today. CurvaFit was built for women exactly like you: real bodies, real goals, no time for programs that weren't designed with you in mind.\n\nEverything you need is already here — products that work, programs that fit, and a community of women who genuinely get it. We're so glad you're here.`;
}

async function generateNewsletterCopy(firstName) {
  return await callGroq(
    `EMAIL TYPE: Newsletter subscription confirmation. RECIPIENT: ${firstName || 'Beautiful'}
Write 1 paragraph (2-3 sentences): confirm warmly, mention exclusive deals/tips/new arrivals/stories. End with excitement.
Plain text only, no greeting, no sign-off.`
  ) || `You're officially on the inside now — and that means something real. Every week you'll get exclusive deals before anyone else, practical wellness tips built for curvy women, and honest stories from women in our community who show up for themselves every day. Good things are heading your way.`;
}

async function generateReviewThanksCopy(firstName) {
  return await callGroq(
    `EMAIL TYPE: Thank-you after a customer submitted a product review. RECIPIENT: ${firstName || 'Beautiful'}
Write 2 short paragraphs (blank line between):
- Para 1 (2 sentences): Thank sincerely. Explain her review helps the next woman decide.
- Para 2 (1-2 sentences): Mention exclusive offer waiting below. Warm, not salesy.
Plain text only, no greeting, no sign-off, no specific codes.`
  ) || `Your review matters more than you might realize — every honest word you wrote will help another woman decide whether CurvaFit is the right fit for her. Thank you for taking the time to share your real experience with our community.\n\nAs a small thank-you, we've put together something exclusive just for you — because women who give deserve to receive too.`;
}

async function generateCartCopy(firstName, cartQty) {
  return await callGroq(
    `EMAIL TYPE: Abandoned cart recovery. RECIPIENT: ${firstName || 'Beautiful'} ITEMS: ${cartQty}
Write 2 short paragraphs (blank line between):
- Para 1: Remind warmly she left ${cartQty} item${cartQty > 1 ? 's' : ''} behind. Caring friend tone.
- Para 2: Light urgency — stock moves fast, special offer below.
Plain text only, no greeting, no sign-off.`
  ) || `You left ${cartQty} item${cartQty > 1 ? 's' : ''} behind — and we completely understand, life gets busy sometimes. But we didn't want you to miss out on something you clearly already loved enough to add to your cart.\n\nStock on some of these moves fast, and your saved cart won't last forever. We've added something special below to make it easier to finish what you started.`;
}

async function generatePlanCopy(firstName, program) {
  return await callGroq(
    `EMAIL TYPE: Confirmation of fitness program request. RECIPIENT: ${firstName || 'Beautiful'} PROGRAM: ${program}
Write 2 short paragraphs (blank line between):
- Para 1: Confirm request received for ${program}. Make her feel great about her decision.
- Para 2: Team will review and be in touch soon. End with encouragement.
Plain text only, no greeting, no sign-off.`
  ) || `We've received your request for the ${program} program and we're genuinely excited for you. This is exactly the kind of step that changes things — and we don't take that lightly.\n\nOur team will review your request and reach out to you very soon with everything you need to get started. You've got this.`;
}

// ════════════════════════════════════════════════════════════════════════════
//  EMAIL DESIGN SYSTEM
// ════════════════════════════════════════════════════════════════════════════

const BASE_CSS = `
  body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
  table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}
  img{-ms-interpolation-mode:bicubic;border:0;height:auto;line-height:100%;outline:none;text-decoration:none}
  body{margin:0!important;padding:0!important;background-color:#f4f0f8}
  a{color:inherit}
  @media only screen and (max-width:620px){
    .ew{width:100%!important;border-radius:0!important}
    .ep{padding:28px 20px!important}
    .eh1{font-size:26px!important;line-height:1.2!important}
    .egrid td{display:block!important;width:100%!important;padding:0 0 12px!important}
  }
`;

const GRAD = {
  purple: 'background:linear-gradient(145deg,#1a0533 0%,#6b21a8 45%,#a855f7 75%,#ec4899 100%)',
  rose:   'background:linear-gradient(145deg,#1a0020 0%,#86198f 40%,#db2777 70%,#f97316 100%)',
  dark:   'background:linear-gradient(145deg,#0f0f23 0%,#1e1b4b 40%,#4c1d95 70%,#7c3aed 100%)',
  teal:   'background:linear-gradient(145deg,#042f2e 0%,#0f766e 40%,#14b8a6 70%,#6366f1 100%)',
};

// ── Product card — simple, clean: image + title + badge + price + CTA ─────────
function cProductCard(product, promoCode) {
  const priceNum    = parseFloat((product.price || '$0').replace('$', ''));
  const oldPriceNum = parseFloat((product.oldPrice || '$0').replace('$', ''));
  const disc        = oldPriceNum > 0 ? Math.round((1 - priceNum / oldPriceNum) * 100) : 0;

  return `
<table width="100%" cellpadding="0" cellspacing="0" role="presentation"
  style="margin-bottom:12px;border-radius:16px;overflow:hidden;background:#fff;border:1px solid #ede9fe;box-shadow:0 2px 12px rgba(109,40,217,0.07);">
  <tr>
    <td width="110" style="padding:0;vertical-align:top;">
      <a href="${product.url}" target="_blank">
        <img src="${product.image}" width="110" height="110"
             style="display:block;width:110px;height:110px;object-fit:cover;border-radius:16px 0 0 16px;"
             alt="${product.title}">
      </a>
    </td>
    <td style="padding:16px 18px;vertical-align:middle;">
      <span style="display:inline-block;padding:2px 10px;border-radius:20px;background:linear-gradient(90deg,#7c3aed,#db2777);font-family:'DM Sans',Arial,sans-serif;font-size:10px;font-weight:700;color:#fff;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:8px;">${product.badge}</span>
      <p style="margin:0 0 8px;font-family:'Cinzel',Georgia,serif;font-size:13px;font-weight:700;color:#1e1b4b;line-height:1.3;">${product.title}</p>
      <p style="margin:0 0 12px;">
        <span style="font-family:'DM Sans',Arial,sans-serif;font-size:17px;font-weight:800;color:#7c3aed;">${product.price}</span>
        <span style="font-family:'DM Sans',Arial,sans-serif;font-size:12px;color:#9ca3af;text-decoration:line-through;margin-left:8px;">${product.oldPrice}</span>
        ${disc > 0 ? `<span style="font-family:'DM Sans',Arial,sans-serif;font-size:11px;font-weight:700;color:#db2777;margin-left:6px;">&#8722;${disc}%</span>` : ''}
      </p>
      ${promoCode ? `<p style="margin:0 0 12px;display:inline-block;padding:4px 10px;border-radius:8px;background:#fdf4ff;border:1.5px dashed #a855f7;font-family:'DM Sans',Arial,sans-serif;font-size:11px;color:#6b21a8;">Code: <strong>${promoCode}</strong></p>` : ''}
      <a href="${product.url}" target="_blank"
         style="display:inline-block;padding:9px 22px;border-radius:20px;background:linear-gradient(135deg,#7c3aed,#db2777);font-family:'DM Sans',Arial,sans-serif;font-size:12px;font-weight:700;color:#fff;text-decoration:none;">
        Shop Now &rarr;
      </a>
    </td>
  </tr>
</table>`;
}

function cPromoBlock(code, label, tagline) {
  return `
<table width="100%" cellpadding="0" cellspacing="0" role="presentation"
  style="margin:28px 0;border-radius:20px;overflow:hidden;background:linear-gradient(135deg,#1e1b4b 0%,#4c1d95 50%,#6b21a8 100%);">
  <tr>
    <td style="padding:28px 32px;text-align:center;">
      <p style="margin:0 0 6px;font-family:'DM Sans',Arial,sans-serif;font-size:11px;font-weight:600;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.15em;">${tagline}</p>
      <p style="margin:0 0 4px;font-family:'Cinzel',Georgia,serif;font-size:36px;font-weight:700;color:#fff;letter-spacing:0.12em;">${code}</p>
      <p style="margin:0 0 16px;font-family:'DM Sans',Arial,sans-serif;font-size:13px;color:rgba(255,255,255,0.75);">${label}</p>
      <div style="width:48px;height:2px;background:linear-gradient(90deg,#a855f7,#ec4899);margin:0 auto;border-radius:2px;"></div>
    </td>
  </tr>
</table>`;
}

function cDivider() {
  return `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:28px 0;">
  <tr><td style="height:1px;background:linear-gradient(90deg,transparent,#ede9fe,transparent);"></td></tr>
</table>`;
}

function cCTA(label, url) {
  return `
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:32px 0 8px;">
  <tr>
    <td align="center">
      <a href="${url}" target="_blank"
         style="display:inline-block;padding:17px 52px;border-radius:50px;background:linear-gradient(135deg,#7c3aed 0%,#a855f7 50%,#db2777 100%);font-family:'DM Sans',Arial,sans-serif;font-size:15px;font-weight:800;color:#fff;text-decoration:none;letter-spacing:0.04em;box-shadow:0 6px 24px rgba(124,58,237,0.40);">
        ${label}
      </a>
    </td>
  </tr>
</table>`;
}

function cCheckList(items) {
  return `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:8px;">
  ${items.map(item => `
  <tr>
    <td width="28" style="vertical-align:top;padding-top:3px;">
      <div style="width:20px;height:20px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#db2777);text-align:center;line-height:20px;font-size:11px;color:#fff;">&#10003;</div>
    </td>
    <td style="padding-left:6px;font-family:'DM Sans',Arial,sans-serif;font-size:14px;color:#374151;line-height:1.65;padding-bottom:10px;">${item}</td>
  </tr>`).join('')}
</table>`;
}

function cParagraphs(text) {
  if (!text) return '';
  return text.split('\n').filter(p => p.trim().length > 0).map(p =>
    `<p style="margin:0 0 18px;font-family:'DM Sans',Arial,sans-serif;font-size:15px;color:#374151;line-height:1.75;">${p}</p>`
  ).join('');
}

function buildEmail({ preheader, gradStyle, topTag, headline, subHeadline, bodyHTML, footerNote }) {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>CurvaFit</title>
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=DM+Sans:ital,wght@0,400;0,500;0,700;0,800;1,400&display=swap" rel="stylesheet">
  <style>${BASE_CSS}</style>
</head>
<body style="margin:0;padding:0;background-color:#f4f0f8;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:#f4f0f8;line-height:1px;">
${preheader}&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;
</div>
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f4f0f8;padding:40px 16px;">
  <tr><td align="center">
    <table class="ew" width="600" cellpadding="0" cellspacing="0" role="presentation"
           style="max-width:600px;width:100%;border-radius:24px;overflow:hidden;box-shadow:0 20px 60px rgba(109,40,217,0.15);">
      <tr>
        <td style="${gradStyle};">
          <div style="height:3px;background:linear-gradient(90deg,#f9a8d4,#c084fc,#818cf8,#f9a8d4,#c084fc);"></div>
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td style="padding:40px 44px 36px;text-align:center;">
                <a href="${SITE_URL}" target="_blank" style="text-decoration:none;display:inline-block;margin-bottom:22px;">
                  <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto;">
                    <tr>
                      <td style="border:1.5px solid rgba(255,255,255,0.30);border-radius:12px;padding:10px 26px;background:rgba(255,255,255,0.10);">
                        <span style="font-family:'Cinzel',Georgia,serif;font-size:19px;font-weight:700;color:#fff;letter-spacing:0.18em;">CURVA<span style="color:#f9a8d4;">FIT</span></span>
                      </td>
                    </tr>
                  </table>
                </a>
                ${topTag ? `<br><span style="display:inline-block;padding:5px 18px;border-radius:20px;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.25);font-family:'DM Sans',Arial,sans-serif;font-size:11px;font-weight:700;color:rgba(255,255,255,0.90);letter-spacing:0.10em;text-transform:uppercase;">${topTag}</span><br>` : ''}
                <h1 class="eh1" style="margin:${topTag ? '16px' : '0'} 0 0;font-family:'Cinzel',Georgia,serif;font-size:32px;font-weight:700;color:#fff;line-height:1.2;letter-spacing:0.02em;">${headline}</h1>
                ${subHeadline ? `<p style="margin:10px 0 0;font-family:'DM Sans',Arial,sans-serif;font-size:15px;color:rgba(255,255,255,0.75);line-height:1.5;">${subHeadline}</p>` : ''}
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td class="ep" style="background:#fff;padding:40px 44px;">
          ${bodyHTML}
        </td>
      </tr>
      <tr>
        <td style="background:#faf5ff;padding:24px 44px;text-align:center;border-top:1px solid #ede9fe;">
          <p style="margin:0 0 14px;font-family:'DM Sans',Arial,sans-serif;font-size:11px;color:#9ca3af;letter-spacing:0.08em;text-transform:uppercase;">Follow our community</p>
          <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto;">
            <tr>
              <td style="padding:0 5px;"><a href="${(settings && settings.social_links && settings.social_links.instagram) || 'https://instagram.com/curvafit'}" target="_blank" style="display:inline-block;width:38px;height:38px;border-radius:10px;background:linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045);text-align:center;line-height:38px;font-size:18px;text-decoration:none;">&#x1F4F7;</a></td>
              <td style="padding:0 5px;"><a href="${(settings && settings.social_links && settings.social_links.facebook) || 'https://facebook.com/curvafit'}" target="_blank" style="display:inline-block;width:38px;height:38px;border-radius:10px;background:#1877f2;text-align:center;line-height:38px;font-size:18px;text-decoration:none;">&#x1F44D;</a></td>
              <td style="padding:0 5px;"><a href="${(settings && settings.social_links && settings.social_links.tiktok) || 'https://tiktok.com/@curvafit'}" target="_blank" style="display:inline-block;width:38px;height:38px;border-radius:10px;background:#010101;text-align:center;line-height:38px;font-size:18px;text-decoration:none;">&#x1F3B5;</a></td>
              <td style="padding:0 5px;"><a href="${(settings && settings.contact && settings.contact.whatsapp_url) || 'https://wa.me/18292677434'}" target="_blank" style="display:inline-block;width:38px;height:38px;border-radius:10px;background:#25d366;text-align:center;line-height:38px;font-size:18px;text-decoration:none;">&#x1F4AC;</a></td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="background:#1e1b4b;padding:24px 44px;text-align:center;">
          <p style="margin:0 0 10px;font-family:'Cinzel',Georgia,serif;font-size:12px;color:rgba(255,255,255,0.45);letter-spacing:0.12em;">CURVAFIT</p>
          <p style="margin:0 0 12px;font-family:'DM Sans',Arial,sans-serif;font-size:11px;color:rgba(255,255,255,0.35);line-height:1.6;">${footerNote || 'You received this email from CurvaFit.'}</p>
          <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto;">
            <tr>
              <td style="padding:0 10px;"><a href="${SITE_URL}/shop.html" target="_blank" style="font-family:'DM Sans',Arial,sans-serif;font-size:11px;color:#a78bfa;text-decoration:none;">Shop</a></td>
              <td style="padding:0 10px;border-left:1px solid rgba(255,255,255,0.12);"><a href="${SITE_URL}/policies/privacy.html" target="_blank" style="font-family:'DM Sans',Arial,sans-serif;font-size:11px;color:#a78bfa;text-decoration:none;">Privacy</a></td>
              <td style="padding:0 10px;border-left:1px solid rgba(255,255,255,0.12);"><a href="${SITE_URL}/contact.html" target="_blank" style="font-family:'DM Sans',Arial,sans-serif;font-size:11px;color:#a78bfa;text-decoration:none;">Contact</a></td>
              <td style="padding:0 10px;border-left:1px solid rgba(255,255,255,0.12);"><a href="${SITE_URL}/policies/refund.html" target="_blank" style="font-family:'DM Sans',Arial,sans-serif;font-size:11px;color:#a78bfa;text-decoration:none;">Refunds</a></td>
            </tr>
          </table>
          <p style="margin:14px 0 0;font-family:'DM Sans',Arial,sans-serif;font-size:10px;color:rgba(255,255,255,0.20);">&copy; ${new Date().getFullYear()} CurvaFit &mdash; Built for real women.</p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

// ════════════════════════════════════════════════════════════════════════════
//  EMAIL COMPOSERS — all receive catalog = { featured, promos, settings }
// ════════════════════════════════════════════════════════════════════════════

async function composeWelcome(firstName, catalog) {
  const { featured, promos, settings } = catalog;
  const name  = firstName || 'Beautiful';
  const copy  = await generateWelcomeCopy(name);
  const promo = promos[0];

  const programs  = settings.programs || {};
  const progNames = Object.values(programs).map(p => p.label || '').filter(Boolean);
  const progLine  = progNames.length
    ? `Coaching programs: ${progNames.join(' · ')}`
    : 'Coaching programs from beginner to advanced';
  const supportEmail = (settings.contact_emails || {}).general || 'support@curvafit.com';

  const bodyHTML = `
    <p style="margin:0 0 6px;font-family:'DM Sans',Arial,sans-serif;font-size:13px;font-weight:700;color:#a855f7;letter-spacing:0.06em;text-transform:uppercase;">Hey ${name} &#x1F44B;</p>
    ${cParagraphs(copy)}
    ${cDivider()}
    ${cPromoBlock(promo.code, promo.label, '&#x1F381; Your welcome gift — use it on your first order')}
    <p style="margin:0 0 16px;font-family:'Cinzel',Georgia,serif;font-size:15px;font-weight:700;color:#1e1b4b;">What's waiting for you:</p>
    ${cCheckList([
      `${featured.length}+ premium fitness products designed for curvy women`,
      progLine,
      'A community of real women on their transformation journey',
      'Expert nutrition guidance built around your body',
    ])}
    ${cCTA('Explore the Shop &rarr;', `${SITE_URL}/shop.html`)}
    ${cDivider()}
    <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:13px;color:#9ca3af;text-align:center;line-height:1.6;">
      Questions? We're always here.<br>
      <a href="mailto:${supportEmail}" style="color:#7c3aed;text-decoration:none;font-weight:700;">${supportEmail}</a>
    </p>`;

  return {
    subject: `Welcome to CurvaFit, ${name}! Your gift is inside &#x1F49C;`,
    html: buildEmail({
      preheader:   `You're officially part of CurvaFit — and we built this for exactly you.`,
      gradStyle:   GRAD.purple,
      topTag:      'Welcome to the family',
      headline:    'You made it. &#x1F49C;',
      subHeadline: 'CurvaFit was built for women exactly like you.',
      bodyHTML,
      footerNote:  `You received this because you created a CurvaFit account. <a href="${SITE_URL}/contact.html" style="color:#a78bfa;">Manage preferences</a>`,
    }),
  };
}

async function composeNewsletter(firstName, catalog) {
  const { settings } = catalog;
  const name = firstName || 'Beautiful';
  const copy = await generateNewsletterCopy(name);

  const bodyHTML = `
    <p style="margin:0 0 6px;font-family:'DM Sans',Arial,sans-serif;font-size:13px;font-weight:700;color:#a855f7;letter-spacing:0.06em;text-transform:uppercase;">Subscription confirmed &#x2713;</p>
    <p style="margin:0 0 28px;font-family:'DM Sans',Arial,sans-serif;font-size:15px;color:#374151;line-height:1.75;">${copy}</p>
    ${cDivider()}
    <p style="margin:0 0 16px;font-family:'Cinzel',Georgia,serif;font-size:15px;font-weight:700;color:#1e1b4b;">Here's what's coming your way:</p>
    <table class="egrid" width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td width="50%" style="padding:0 6px 12px 0;vertical-align:top;">
          <div style="background:#faf5ff;border-radius:16px;padding:20px;border:1px solid #ede9fe;">
            <p style="margin:0 0 6px;font-size:22px;">&#x1F4A1;</p>
            <p style="margin:0 0 6px;font-family:'Cinzel',Georgia,serif;font-size:13px;font-weight:700;color:#1e1b4b;">Weekly Tips</p>
            <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:12px;color:#6b7280;line-height:1.55;">Practical wellness &amp; weight loss tips that actually work for curvy bodies.</p>
          </div>
        </td>
        <td width="50%" style="padding:0 0 12px 6px;vertical-align:top;">
          <div style="background:#fdf2f8;border-radius:16px;padding:20px;border:1px solid #fce7f3;">
            <p style="margin:0 0 6px;font-size:22px;">&#x1F381;</p>
            <p style="margin:0 0 6px;font-family:'Cinzel',Georgia,serif;font-size:13px;font-weight:700;color:#1e1b4b;">Exclusive Deals</p>
            <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:12px;color:#6b7280;line-height:1.55;">Subscriber-only discount codes before they go public.</p>
          </div>
        </td>
      </tr>
      <tr>
        <td width="50%" style="padding:0 6px 0 0;vertical-align:top;">
          <div style="background:#f0fdf4;border-radius:16px;padding:20px;border:1px solid #dcfce7;">
            <p style="margin:0 0 6px;font-size:22px;">&#x2728;</p>
            <p style="margin:0 0 6px;font-family:'Cinzel',Georgia,serif;font-size:13px;font-weight:700;color:#1e1b4b;">New Arrivals</p>
            <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:12px;color:#6b7280;line-height:1.55;">You'll be first to know when new products launch.</p>
          </div>
        </td>
        <td width="50%" style="padding:0 0 0 6px;vertical-align:top;">
          <div style="background:#eff6ff;border-radius:16px;padding:20px;border:1px solid #dbeafe;">
            <p style="margin:0 0 6px;font-size:22px;">&#x1F4AA;</p>
            <p style="margin:0 0 6px;font-family:'Cinzel',Georgia,serif;font-size:13px;font-weight:700;color:#1e1b4b;">Real Stories</p>
            <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:12px;color:#6b7280;line-height:1.55;">Success stories from real women in our community.</p>
          </div>
        </td>
      </tr>
    </table>
    ${cCTA('Discover the Shop &rarr;', `${SITE_URL}/shop.html`)}`;

  return {
    subject: `You're in! &#x1F48C; The CurvaFit insider list just got better`,
    html: buildEmail({
      preheader:   `Your subscription is confirmed — exclusive tips, deals, and real stories incoming.`,
      gradStyle:   GRAD.rose,
      topTag:      'Newsletter confirmed',
      headline:    "You're officially inside. &#x1F48C;",
      subHeadline: 'The best of CurvaFit, delivered to your inbox.',
      bodyHTML,
      footerNote:  `You subscribed to the CurvaFit newsletter. <a href="${SITE_URL}/contact.html" style="color:#a78bfa;">Unsubscribe</a>`,
    }),
  };
}

async function composeReviewThanks(firstName, catalog) {
  const { featured, promos } = catalog;
  const name  = firstName || 'Beautiful';
  const copy  = await generateReviewThanksCopy(name);
  const promo = promos[Math.floor(Math.random() * promos.length)];
  const productsToShow = featured.slice(0, 3);

  const bodyHTML = `
    <p style="margin:0 0 6px;font-family:'DM Sans',Arial,sans-serif;font-size:13px;font-weight:700;color:#a855f7;letter-spacing:0.06em;text-transform:uppercase;">Thank you, ${name} &#x1F31F;</p>
    ${cParagraphs(copy)}
    ${cDivider()}
    ${cPromoBlock(promo.code, promo.label, '&#x2728; Your exclusive thank-you offer')}
    <p style="margin:0 0 16px;font-family:'Cinzel',Georgia,serif;font-size:15px;font-weight:700;color:#1e1b4b;">Handpicked for you:</p>
    ${productsToShow.map(p => cProductCard(p, promo.code)).join('')}
    ${cCTA(`Shop with ${promo.code} &rarr;`, `${SITE_URL}/shop.html`)}
    ${cDivider()}
    <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:13px;color:#9ca3af;text-align:center;">
      Your review is now helping other women make the right choice. &#x1F49C;
    </p>`;

  return {
    subject: `Thank you for your review, ${name}! Here's something special &#x1F31F;`,
    html: buildEmail({
      preheader:   `Your honest words are helping thousands of women — here's our thank-you.`,
      gradStyle:   GRAD.rose,
      topTag:      'Your review matters',
      headline:    'Thank you. Truly. &#x1F31F;',
      subHeadline: 'Your words are helping real women every day.',
      bodyHTML,
      footerNote:  `You received this because you submitted a product review on CurvaFit.`,
    }),
  };
}

async function composeAbandonedCart(firstName, cartQty, catalog) {
  const { featured, promos } = catalog;
  const name  = firstName || 'Beautiful';
  const copy  = await generateCartCopy(name, cartQty);
  const promo = promos[1] || promos[0];
  const productsToShow = featured.slice(0, 2);

  const bodyHTML = `
    <p style="margin:0 0 6px;font-family:'DM Sans',Arial,sans-serif;font-size:13px;font-weight:700;color:#a855f7;letter-spacing:0.06em;text-transform:uppercase;">Hey ${name} &#x1F6D2;</p>
    ${cParagraphs(copy)}
    ${cDivider()}
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="margin:0 0 24px;background:#faf5ff;border-radius:20px;border:2px dashed #c084fc;">
      <tr>
        <td style="padding:28px;text-align:center;">
          <p style="margin:0 0 6px;font-size:40px;">&#x1F6D2;</p>
          <p style="margin:0 0 4px;font-family:'Cinzel',Georgia,serif;font-size:18px;font-weight:700;color:#4c1d95;">
            ${cartQty} item${cartQty > 1 ? 's' : ''} waiting for you
          </p>
          <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:13px;color:#7c3aed;">Your cart is saved — but not forever.</p>
        </td>
      </tr>
    </table>
    ${cPromoBlock(promo.code, promo.label, '&#x26A1; Complete your order with this offer')}
    <p style="margin:0 0 16px;font-family:'Cinzel',Georgia,serif;font-size:15px;font-weight:700;color:#1e1b4b;">You might also love:</p>
    ${productsToShow.map(p => cProductCard(p, promo.code)).join('')}
    ${cCTA('Complete My Order &rarr;', `${SITE_URL}/checkout.html`)}`;

  return {
    subject: `${name}, your cart is waiting &#x1F6D2; — ${promo.code} inside`,
    html: buildEmail({
      preheader:   `${cartQty} item${cartQty > 1 ? 's' : ''} still in your cart — complete your order with an exclusive offer.`,
      gradStyle:   GRAD.dark,
      topTag:      `${cartQty} item${cartQty > 1 ? 's' : ''} in your cart`,
      headline:    "Don't leave empty-handed. &#x1F6D2;",
      subHeadline: 'Your items are waiting — and so is your offer.',
      bodyHTML,
      footerNote:  `You received this because you had items in your CurvaFit cart.`,
    }),
  };
}

async function composePlanRequest(firstName, program, catalog) {
  const { featured, promos, settings } = catalog;
  const name  = firstName || 'Beautiful';
  const copy  = await generatePlanCopy(name, program || 'fitness');
  const promo = promos[0];
  const productsToShow = featured.slice(0, 2);

  // Try to get program price from settings
  const programs  = settings.programs || {};
  const progKey   = Object.keys(programs).find(k =>
    (programs[k].label || '').toLowerCase().includes((program || '').toLowerCase().split(' ')[0])
  );
  const progPrice = progKey ? ` — $${programs[progKey].price}` : '';

  const bodyHTML = `
    <p style="margin:0 0 6px;font-family:'DM Sans',Arial,sans-serif;font-size:13px;font-weight:700;color:#a855f7;letter-spacing:0.06em;text-transform:uppercase;">Request received &#x2705;</p>
    ${cParagraphs(copy)}
    ${cDivider()}
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="margin:0 0 24px;background:#f0fdf4;border-radius:20px;border:2px solid #86efac;">
      <tr>
        <td style="padding:28px;text-align:center;">
          <p style="margin:0 0 6px;font-size:36px;">&#x1F3CB;&#xFE0F;</p>
          <p style="margin:0 0 4px;font-family:'Cinzel',Georgia,serif;font-size:16px;font-weight:700;color:#14532d;">${program || 'Fitness Plan'}${progPrice}</p>
          <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:13px;color:#15803d;">Our team will be in touch within 24 hours.</p>
        </td>
      </tr>
    </table>
    ${cPromoBlock(promo.code, promo.label, '&#x1F381; A gift while you wait')}
    <p style="margin:0 0 16px;font-family:'Cinzel',Georgia,serif;font-size:15px;font-weight:700;color:#1e1b4b;">Get started with these:</p>
    ${productsToShow.map(p => cProductCard(p, promo.code)).join('')}
    ${cCTA('Explore the Shop &rarr;', `${SITE_URL}/shop.html`)}`;

  return {
    subject: `We received your program request, ${name}! &#x1F3CB;&#xFE0F;`,
    html: buildEmail({
      preheader:   `Your ${program || 'fitness'} program request is confirmed — our team will be in touch soon.`,
      gradStyle:   GRAD.teal,
      topTag:      'Program request confirmed',
      headline:    "We've got your request. &#x1F3CB;&#xFE0F;",
      subHeadline: "Your transformation journey is about to get very real.",
      bodyHTML,
      footerNote:  `You received this because you requested a CurvaFit program.`,
    }),
  };
}

// ════════════════════════════════════════════════════════════════════════════
//  GOOGLE SHEETS HELPERS
// ════════════════════════════════════════════════════════════════════════════

function getSheets() {
  const credentials = {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key:  (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  };
  if (!credentials.client_email || !credentials.private_key) {
    throw new Error('Missing Google credentials: GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY');
  }
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

async function readRange(sheets, spreadsheetId, range) {
  if (!spreadsheetId) { console.warn(`[Sheets] Missing spreadsheet ID for: ${range}`); return []; }
  try {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    return res.data.values || [];
  } catch (e) {
    console.warn(`[Sheets] readRange failed (${range}):`, e.message);
    return [];
  }
}

async function appendRow(sheets, spreadsheetId, range, values) {
  if (!spreadsheetId) { console.warn(`[Sheets] Missing spreadsheet ID for append: ${range}`); return; }
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId, range,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: { values: [values] },
    });
  } catch (e) {
    console.warn(`[Sheets] appendRow failed (${range}):`, e.message);
  }
}

const LOG_RANGE = 'EmailLog!A:C';

async function loadSentLog(sheets) {
  const rows = await readRange(sheets, process.env.GOOGLE_SHEET_ID_ACCOUNTS, LOG_RANGE);
  const set  = new Set();
  rows.forEach(r => { if (r[0] && r[1]) set.add(`${r[0].toLowerCase()}||${r[1]}`); });
  console.log(`[EmailLog] Loaded ${set.size} sent records`);
  return set;
}

async function markSent(sheets, email, type) {
  await appendRow(sheets, process.env.GOOGLE_SHEET_ID_ACCOUNTS, LOG_RANGE,
    [email.toLowerCase(), type, new Date().toISOString().slice(0, 10)]
  );
}

function wasSent(log, email, type) {
  return log.has(`${email.toLowerCase()}||${type}`);
}

async function deliver(to, subject, html) {
  if (!process.env.RESEND_API_KEY) {
    console.error('[Resend] Missing RESEND_API_KEY env var');
    return false;
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  try {
    const { data, error } = await resend.emails.send({ from: FROM_EMAIL, to: [to], subject, html });
    if (error) { console.error(`[Resend] ✗ ${to}:`, JSON.stringify(error)); return false; }
    console.log(`[Resend] ✓ Sent to ${to} | ID: ${data?.id}`);
    return true;
  } catch (e) {
    console.error(`[Resend] ✗ ${to}:`, e.message);
    return false;
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  MAIN HANDLER
// ════════════════════════════════════════════════════════════════════════════
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const results = { sent: [], skipped: [], errors: [] };
  let trigger = null, triggerData = {};

  if (event.body) {
    try { const b = JSON.parse(event.body); trigger = b.trigger || null; triggerData = b; }
    catch (_) {}
  }

  try {
    // ── Load products.data.json dynamically — ONCE per invocation ────────
    console.log('[Handler] Loading products.data.json dynamically...');
    const rawData = await loadProductsData();
    const catalog = parseProductsData(rawData);
    console.log(`[Handler] ${catalog.featured.length} products · ${catalog.promos.length} promos loaded from live data`);

    const sheets  = getSheets();
    const sentLog = await loadSentLog(sheets);

    // ── Shared send helper ────────────────────────────────────────────────
    const trySend = async (email, type, composeFn, ...args) => {
      if (!email || !email.includes('@')) {
        console.warn(`[trySend] Invalid email: "${email}"`); return false;
      }
      if (wasSent(sentLog, email, type)) {
        results.skipped.push({ email, type, reason: 'already sent' }); return false;
      }
      try {
        console.log(`[trySend] Composing ${type} for ${email}`);
        // catalog is always the last arg — all composers accept it
        const { subject, html } = await composeFn(...args, catalog);
        const ok = await deliver(email, subject, html);
        if (ok) {
          await markSent(sheets, email, type);
          sentLog.add(`${email.toLowerCase()}||${type}`);
          results.sent.push({ email, type });
        } else {
          results.errors.push({ email, type, reason: 'Resend delivery failed' });
        }
        return ok;
      } catch (e) {
        console.error(`[trySend] Error for ${email} / ${type}:`, e.message);
        results.errors.push({ email, type, reason: e.message });
        return false;
      }
    };

    // ════════════════════════════════════════════════════════════════════
    //  SINGLE-TRIGGER MODE (called from save-account.js, save-review.js…)
    // ════════════════════════════════════════════════════════════════════
    if (trigger) {
      console.log(`[Handler] Trigger mode: ${trigger}`);
      const { email, firstName = '', lastName = '', newsletter = 'no', cartQty = 0, program = '' } = triggerData;

      if (!email || !email.includes('@')) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Valid email required' }) };
      }

      const name = firstName || lastName || 'Beautiful';

      if (trigger === T.WELCOME) {
        await trySend(email, T.WELCOME, composeWelcome, name);
      }

      if (trigger === T.NEWSLETTER) {
        if (String(newsletter).toLowerCase().trim() === 'yes') {
          if (!wasSent(sentLog, email, T.WELCOME)) {
            await trySend(email, T.NEWSLETTER, composeNewsletter, name);
          } else {
            results.skipped.push({ email, type: T.NEWSLETTER, reason: 'Welcome just sent — queued for next batch' });
          }
        }
      }

      if (trigger === T.REVIEW_THANKS) {
        await trySend(email, T.REVIEW_THANKS, composeReviewThanks, name);
      }

      if (trigger === T.CART_ABANDON) {
        const qty = parseInt(cartQty) || 0;
        if (qty > 0) {
          await trySend(email, T.CART_ABANDON, composeAbandonedCart, name, qty);
        } else {
          results.skipped.push({ email, type: T.CART_ABANDON, reason: 'cartQty is 0' });
        }
      }

      if (trigger === T.PLAN_REQUEST) {
        await trySend(email, T.PLAN_REQUEST, composePlanRequest, name, program);
      }

      return { statusCode: 200, headers, body: JSON.stringify({ success: true, trigger, results }) };
    }

    // ════════════════════════════════════════════════════════════════════
    //  BATCH SCAN MODE (GET request — run manually or via scheduler)
    // ════════════════════════════════════════════════════════════════════
    console.log('[Handler] Batch scan mode');

    // ── Accounts (save-account.js → Feuille 1) ──────────────────────────
    const accountRows = await readRange(sheets, process.env.GOOGLE_SHEET_ID_ACCOUNTS, 'Feuille 1!A:R');
    console.log(`[Batch] Account rows: ${accountRows.length}`);

    for (const row of accountRows) {
      const lastName   = (row[0]  || '').trim();
      const firstName  = (row[1]  || '').trim();
      const email      = (row[2]  || '').trim();
      const newsletter = (row[5]  || '').trim().toLowerCase();
      const reviews    = parseInt(row[8]  || 0, 10);
      const cartQty    = parseInt(row[14] || 0, 10);

      if (!email || !email.includes('@')) continue;
      const name = firstName || lastName || 'Beautiful';

      if (!wasSent(sentLog, email, T.WELCOME)) {
        await trySend(email, T.WELCOME, composeWelcome, name);
        await sleep(600); continue;
      }
      if (newsletter === 'yes' && !wasSent(sentLog, email, T.NEWSLETTER)) {
        await trySend(email, T.NEWSLETTER, composeNewsletter, name);
        await sleep(600); continue;
      }
      if (reviews > 0 && !wasSent(sentLog, email, T.REVIEW_THANKS)) {
        await trySend(email, T.REVIEW_THANKS, composeReviewThanks, name);
        await sleep(600); continue;
      }
      if (cartQty > 0 && !wasSent(sentLog, email, T.CART_ABANDON)) {
        await trySend(email, T.CART_ABANDON, composeAbandonedCart, name, cartQty);
        await sleep(600); continue;
      }
      results.skipped.push({ email, reason: 'no action needed' });
    }

    // ── Newsletter-only footer subscribers ──────────────────────────────
    for (const row of accountRows) {
      const firstName  = (row[1] || '').trim();
      const lastName   = (row[0] || '').trim();
      const email      = (row[2] || '').trim();
      const newsletter = (row[5] || '').trim().toLowerCase();
      if (!firstName && !lastName && email && email.includes('@')
          && newsletter === 'yes'
          && !wasSent(sentLog, email, T.NEWSLETTER)) {
        await trySend(email, T.NEWSLETTER, composeNewsletter, '');
        await sleep(600);
      }
    }

    // ── Plan requests (save-plan-request.js → MembersPending-Plan) ──────
    const planRows = await readRange(sheets, process.env.PENDING_PLAN_PROGRAM_SHEET_ID, 'MembersPeding-Plan!A:H');
    console.log(`[Batch] Plan request rows: ${planRows.length}`);

    for (const row of planRows) {
      const firstName = (row[1] || '').trim();
      const lastName  = (row[2] || '').trim();
      const email     = (row[3] || '').trim();
      const program   = (row[5] || '').trim();
      const status    = (row[7] || '').trim().toLowerCase();

      if (!email || !email.includes('@') || status !== 'pending') continue;
      const name = firstName || lastName || 'Beautiful';
      if (!wasSent(sentLog, email, T.PLAN_REQUEST)) {
        await trySend(email, T.PLAN_REQUEST, composePlanRequest, name, program);
        await sleep(600);
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

  } catch (fatal) {
    console.error('[Handler] Fatal error:', fatal.message, fatal.stack);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: fatal.message }),
    };
  }
};