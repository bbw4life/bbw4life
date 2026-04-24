const { google } = require('googleapis');

exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });

    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.CURVAFIT_ANALITIQUE_SHEET_ID;

    if (event.httpMethod === "GET") {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "CurvafitAnalitique!A:O"
      });
      const rows = res.data.values || [];
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, rows }) };
    }

    if (event.httpMethod === "POST") {
      if (!event.body) return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: "No body" }) };
      const data = JSON.parse(event.body);

      // ── Géolocalisation IP ──
      let country = "Unknown";
      let city    = "Unknown";

      try {
        // Récupère l'IP réelle du visiteur — plusieurs headers possibles selon le proxy
        const rawIp =
          (event.headers["x-nf-client-connection-ip"] || "").trim() ||   // Netlify native header (le plus fiable)
          (event.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
          (event.headers["x-real-ip"] || "").trim() ||
          (event.headers["client-ip"] || "").trim() ||
          "";

        const ip = rawIp.replace(/^::ffff:/, ""); // Normalise les IPv4-mapped IPv6

        if (ip && ip !== "127.0.0.1" && ip !== "::1" && ip !== "") {
          // Essai 1 : ip-api.com (gratuit, 1000 req/min)
          const geoRes  = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,city&lang=en`);
          const geoData = await geoRes.json();

          if (geoData.status === "success") {
            country = geoData.country || "Unknown";
            city    = geoData.city    || "Unknown";
          } else {
            // Essai 2 : ipapi.co comme fallback
            const fallbackRes  = await fetch(`https://ipapi.co/${ip}/json/`);
            const fallbackData = await fallbackRes.json();
            if (!fallbackData.error) {
              country = fallbackData.country_name || "Unknown";
              city    = fallbackData.city         || "Unknown";
            }
          }
        }
      } catch (geoErr) {
        console.warn("[ANALYTICS] Geo lookup failed:", geoErr.message);
      }

      const row = [[
        data.timestamp    || new Date().toISOString(),
        data.sessionId    || "",
        country,
        city,
        data.pageUrl      || "",
        data.pageTitle    || "",
        data.timeOnPage   || 0,
        data.clicks       || 0,
        data.menuClicks   || 0,
        data.scrollDepth  || 0,
        data.referrer     || "direct",
        data.device       || "desktop",
        data.browser      || "unknown",
        data.screenWidth  || 0,
        data.actionsCount || 0
      ]];

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: "CurvafitAnalitique!A:O",
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        resource: { values: row }
      });

      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ success: false, error: "Method not allowed" }) };

  } catch (err) {
    console.error("[ANALYTICS]", err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
};