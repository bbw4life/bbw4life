// save-pending-order.js
const { google } = require('googleapis');
exports.handler = async (event) => {
  console.log('[SAVE PENDING] Function invoked');
  try {
    if (!event.body) return response(400, { success: false, error: "No data received" });
    const body = JSON.parse(event.body);
    let { shipping, item, payment_provider, payment_id, status = "pending_stock" } = body;
    if (!payment_id) throw new Error("Missing payment_id");
    const normalize = (str) => str ? str.normalize("NFKD").replace(/[\u0300-\u036f]/g, "") : "";
    const fullName = shipping.fullName || `${shipping.firstName || ''} ${shipping.lastName || ''}`.trim();
    shipping.fullName = normalize(fullName);
    shipping.email = normalize(shipping.email);
    shipping.phone = normalize(shipping.phone);
    shipping.country = normalize(shipping.country || "United States"); // string (nom complet)
    shipping.state = normalize(shipping.state);
    shipping.city = normalize(shipping.city);
    shipping.postalCode = normalize(shipping.postalCode);
    shipping.address = normalize(shipping.address);
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });
    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const now = new Date().toISOString();
    const internalOrderId = `PENDING_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const values = [[
      internalOrderId,
      payment_provider,
      payment_id,
      shipping.fullName || "",
      shipping.email || "",
      shipping.phone || "",
      shipping.country || "United States",
      shipping.state || "",
      shipping.city || "",
      shipping.postalCode || "",
      shipping.address || "",
      "", 
      item.variantsid || "",
      item.quantity || 1,
      status,
      "paid",
      now,
     shipping.shipping_method || "Standard Shipping"
    ]];
   const rangesToTry = ["Feuille 1!A:R", "PendingOrders!A:R", "Sheet1!A:R"];
    let success = false;
    for (const range of rangesToTry) {
      try {
        const appendRes = await sheets.spreadsheets.values.append({
          spreadsheetId, range, valueInputOption: "RAW", insertDataOption: "INSERT_ROWS", resource: { values }
        });
        console.log(`[SAVE PENDING] ✅ SAUVEGARDE OK dans ${range}`);
        success = true;
        break;
      } catch (err) {
        console.log(`[SAVE PENDING] Échec avec ${range}`);
      }
    }
    if (!success) throw new Error("Aucun onglet n'a fonctionné");
    return response(200, { success: true });
  } catch (error) {
    console.error("SAVE PENDING ERROR:", error.message);
    return response(500, { success: false, error: error.message });
  }
};
function response(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}