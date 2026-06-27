// detect-abandoned-cart.js
process.removeAllListeners('warning');
const { google } = require("googleapis");
const fetch = require("node-fetch");
const { notifyCartAbandoned } = require('./notify-email');

const ABANDON_THRESHOLD_MINUTES = 20;

function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });
  return google.sheets({ version: "v4", auth });
}

const SPREADSHEET_ID   = process.env.SHEET_ID_BBW4LIFE_PENDING_ORDERS;
const TEMP_TAB          = "Temp_Orders";
const TEMP_RANGE         = `${TEMP_TAB}!A:D`;
const ABANDONED_TAB     = "Abandoned_Carts";
const ABANDONED_RANGE    = `${ABANDONED_TAB}!A:J`;

// ── Crée l'onglet Abandoned_Carts s'il n'existe pas, avec en-têtes ──
async function ensureAbandonedTabExists(sheets) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const exists = meta.data.sheets.some(s => s.properties.title === ABANDONED_TAB);
  if (exists) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    resource: {
      requests: [{
        addSheet: { properties: { title: ABANDONED_TAB } }
      }]
    }
  });

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${ABANDONED_TAB}!A:J`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    resource: {
      values: [[
        "Order ID", "Email", "First Name", "Last Name",
        "Cart JSON", "Shipping JSON", "Promo Code",
        "Created At", "Status", "Restart Link"
      ]]
    }
  });
  console.log(`[ABANDONED CART] Onglet "${ABANDONED_TAB}" créé avec en-têtes`);
}

// ── Charge settings depuis products.data.json (pour les promos) ──
async function getSettings() {
  try {
    const BASE_URL = process.env.BASE_URL || '';
    const res = await fetch(`${BASE_URL}/products.data.json`);
    if (!res.ok) throw new Error('Failed to fetch products.data.json');
    const data = await res.json();
    return data.find(p => p.type === 'settings') || {};
  } catch (err) {
    console.warn('[ABANDONED CART] Could not load products.data.json:', err.message);
    return {};
  }
}

function pickRandomPromo(settings) {
  const promos = settings.promos || [];
  if (!promos.length) return null;
  return promos[Math.floor(Math.random() * promos.length)];
}

async function notifyTelegramAbandoned(orderId, shipping, cart, promo) {
  try {
    const itemCount = (cart || []).reduce((sum, i) => sum + (parseInt(i.quantity) || 1), 0);
    const fullName  = shipping.fullName || `${shipping.firstName || ''} ${shipping.lastName || ''}`.trim();
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text:
          `🛒 <b>Pdg Francenel, un panier vient d'être abandonné !</b>\n\n` +
          `🆔 <b>Order ID:</b> ${orderId}\n` +
          `👤 <b>Client:</b> ${fullName || 'N/A'}\n` +
          `📧 <b>Email:</b> ${shipping.email || 'N/A'}\n` +
          `📦 <b>Articles:</b> ${itemCount}\n` +
          `🎁 <b>Code promo envoyé:</b> ${promo ? `${promo.code} (${promo.percent}%)` : 'aucun disponible'}`,
        parse_mode: "HTML"
      })
    });
  } catch (e) {
    console.warn("[ABANDONED CART] Telegram notify failed:", e.message);
  }
}

async function deleteTempOrderRow(sheets, rowIndex) {
  const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheetObj  = sheetMeta.data.sheets.find(s => s.properties.title === TEMP_TAB);
  const sheetId   = sheetObj ? sheetObj.properties.sheetId : 0;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    resource: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: sheetId,
            dimension: "ROWS",
            startIndex: rowIndex,
            endIndex: rowIndex + 1
          }
        }
      }]
    }
  });
}

exports.handler = async () => {
  console.log('[ABANDONED CART] 🚀 Démarrage - ' + new Date().toISOString());
  try {
    const sheets = getSheetsClient();
    await ensureAbandonedTabExists(sheets);

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: TEMP_RANGE
    });
    const rows = res.data.values || [];

    if (rows.length === 0) {
      console.log('[ABANDONED CART] Aucun panier en cours');
      return { statusCode: 200, body: JSON.stringify({ success: true, processed: 0 }) };
    }

    const now = new Date();
    const settings = await getSettings();

    // On traite du bas vers le haut pour que les suppressions de lignes
    // n'invalident pas les indices des lignes restant à traiter.
    let processed = 0;
    for (let i = rows.length - 1; i >= 0; i--) {
      const row = rows[i];
      const [orderId, cartJson, shippingJson, createdAt] = row;

      if (!orderId || !createdAt) continue;

      const createdDate = new Date(createdAt);
      const minutesElapsed = (now - createdDate) / (1000 * 60);

      if (minutesElapsed < ABANDON_THRESHOLD_MINUTES) continue;

      let cart = [];
      let shipping = {};
      try { cart = JSON.parse(cartJson || "[]"); } catch {}
      try { shipping = JSON.parse(shippingJson || "{}"); } catch {}

      const email = (shipping.email || '').trim();

      console.log(`[ABANDONED CART] Détecté : ${orderId} | ${minutesElapsed.toFixed(1)} min écoulées`);

      const promo = pickRandomPromo(settings);
      const restartLink = `${process.env.BASE_URL || ''}/checkout.html?restore=${encodeURIComponent(orderId)}`;

      // ── Sauvegarder dans Abandoned_Carts ──
      try {
        await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: ABANDONED_RANGE,
          valueInputOption: "RAW",
          insertDataOption: "INSERT_ROWS",
          resource: {
            values: [[
              orderId,
              email,
              shipping.firstName || '',
              shipping.lastName  || '',
              cartJson     || "[]",
              shippingJson || "{}",
              promo ? promo.code : '',
              new Date().toISOString(),
              "abandoned",
              restartLink
            ]]
          }
        });
      } catch (e) {
        console.error(`[ABANDONED CART] Échec sauvegarde ${orderId}:`, e.message);
        continue; // ne pas supprimer le temp order si la sauvegarde a échoué
      }

      // ── Notifier Telegram ──
      await notifyTelegramAbandoned(orderId, shipping, cart, promo);

      // ── Envoyer l'email de relance au client ──
      if (email && email.includes('@')) {
        const emailResult = await notifyCartAbandoned({
          email,
          firstName:    shipping.firstName || '',
          items:        cart,
          promoCode:    promo ? promo.code    : null,
          promoPercent: promo ? promo.percent : null,
          restartLink
        });
        if (emailResult.success) {
          console.log(`[ABANDONED CART] ✅ Email de relance envoyé à ${email}`);
        } else {
          console.warn(`[ABANDONED CART] Échec envoi email à ${email}:`, emailResult.error);
        }
      }

      // ── Supprimer la ligne de Temp_Orders pour ne pas la retraiter ──
      try {
        await deleteTempOrderRow(sheets, i);
      } catch (e) {
        console.error(`[ABANDONED CART] Échec suppression Temp_Orders ligne ${i}:`, e.message);
      }

      processed++;
      await new Promise(r => setTimeout(r, 500));
    }

    console.log(`[ABANDONED CART] ✅ FIN - Traités: ${processed}`);
    return { statusCode: 200, body: JSON.stringify({ success: true, processed }) };

  } catch (error) {
    console.error("[ABANDONED CART] ERROR:", error.message);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
  }
};