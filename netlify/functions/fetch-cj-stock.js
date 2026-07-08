// fetch-cj-stock.js
process.removeAllListeners('warning');

const SEP = "═".repeat(80);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

exports.handler = async (event) => {
  const logs = [];
  const log = (msg) => { console.log(msg); logs.push(msg); };

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ success: false, error: "Method not allowed, use POST" })
    };
  }

  let vids = [];
  try {
    const body = JSON.parse(event.body || '{}');
    vids = Array.isArray(body.vids) ? body.vids.filter(Boolean) : [];
  } catch {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ success: false, error: "Invalid JSON body" })
    };
  }

  if (!vids.length) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ success: true, stocks: {}, logs: ["Aucun vid fourni."] })
    };
  }

  if (!process.env.CJ_API_KEY) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ success: false, error: "CJ_API_KEY missing in env", logs })
    };
  }

  log(SEP);
  log(`  CJ STOCK — RÉCUPÉRATION POUR ${vids.length} VARIANT(S)`);
  log(SEP);

  try {
    const token = await getCJAccessToken();
    log("  🔑  Access token CJ obtenu");

    const stocks = {};

    for (const vid of vids) {
      try {
        const url = `https://developers.cjdropshipping.com/api2.0/v1/product/stock/queryByVid?vid=${encodeURIComponent(vid)}`;
        const response = await fetch(url, {
          method: "GET",
          headers: { "CJ-Access-Token": token }
        });
        const responseText = await response.text();

        let data = {};
        try { data = JSON.parse(responseText); } catch {}

        if (data.result === true && Array.isArray(data.data)) {
          // Somme du stock total tous entrepôts confondus (totalInventoryNum)
          const total = data.data.reduce((sum, w) => sum + (Number(w.totalInventoryNum) || 0), 0);
          stocks[vid] = total;
          log(`  ✅  ${vid}  →  ${total} en stock  (${data.data.length} entrepôt(s))`);
        } else {
          stocks[vid] = null;
          const errMsg = data.message || responseText.slice(0, 150) || 'réponse invalide';
          log(`  ⚠️  ${vid}  →  ERREUR : ${errMsg}`);
        }
      } catch (err) {
        stocks[vid] = null;
        log(`  ❌  ${vid}  →  EXCEPTION : ${err.message}`);
      }

      // Pause entre chaque appel pour respecter le rate-limit CJ
      await sleep(350);
    }

    log(SEP);
    log("  ✅  FIN");

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ success: true, stocks, logs })
    };

  } catch (error) {
    console.error("[CJ STOCK ERROR]", error.message);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ success: false, error: error.message, logs })
    };
  }
};