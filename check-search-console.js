require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const SITE_URL = process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL;
const SITEMAP_PATH = path.join(__dirname, 'sitemap.xml');
const LOG_FILE = path.join(__dirname, 'search-console-report.log');

const INSPECT_DELAY_MS = 1200;

function requireEnv() {
  const missing = [];
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) missing.push('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  if (!process.env.GOOGLE_PRIVATE_KEY) missing.push('GOOGLE_PRIVATE_KEY');
  if (!SITE_URL) missing.push('GOOGLE_SEARCH_CONSOLE_SITE_URL');
  if (missing.length) {
    console.error(`Variables d'environnement manquantes dans .env : ${missing.join(', ')}`);
    process.exit(1);
  }
}

function extractUrlsFromSitemap() {
  if (!fs.existsSync(SITEMAP_PATH)) {
    console.error(`sitemap.xml introuvable à ${SITEMAP_PATH}`);
    process.exit(1);
  }
  const xml = fs.readFileSync(SITEMAP_PATH, 'utf8');
  const matches = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)];
  return matches.map((m) => m[1].trim());
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getSearchConsoleClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/webmasters'],
  });
  return google.searchconsole({ version: 'v1', auth });
}

async function inspectUrl(client, url) {
  const response = await client.urlInspection.index.inspect({
    requestBody: {
      inspectionUrl: url,
      siteUrl: SITE_URL,
    },
  });

  const result = response.data.inspectionResult || {};
  const indexResult = result.indexStatusResult || {};

  return {
    url,
    verdict: indexResult.verdict || 'UNKNOWN',
    coverageState: indexResult.coverageState || 'N/A',
    robotsTxtState: indexResult.robotsTxtState || 'N/A',
    indexingState: indexResult.indexingState || 'N/A',
    lastCrawlTime: indexResult.lastCrawlTime || 'N/A',
    pageFetchState: indexResult.pageFetchState || 'N/A',
    googleCanonical: indexResult.googleCanonical || 'N/A',
  };
}

function appendLog(lines) {
  fs.appendFileSync(LOG_FILE, lines.join('\n') + '\n');
}

async function main() {
  requireEnv();

  const urls = extractUrlsFromSitemap();
  if (urls.length === 0) {
    console.log('Aucune URL trouvée dans sitemap.xml.');
    return;
  }

  console.log(`Inspection de ${urls.length} URL(s) via Google Search Console...\n`);

  const client = await getSearchConsoleClient();

  const indexed = [];
  const notIndexed = [];
  const failed = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const index = i + 1;

    try {
      const result = await inspectUrl(client, url);
      const isIndexed = result.verdict === 'PASS' && result.coverageState.toLowerCase().includes('submitted and indexed');

      if (isIndexed) {
        indexed.push(result);
        console.log(`URL ${index}/${urls.length} : INDEXÉE — ${url}`);
      } else {
        notIndexed.push(result);
        console.log(`URL ${index}/${urls.length} : NON INDEXÉE (${result.coverageState}) — ${url}`);
      }

      appendLog([
        `[${new Date().toISOString()}] ${url} | verdict: ${result.verdict} | coverageState: ${result.coverageState} | robotsTxtState: ${result.robotsTxtState} | indexingState: ${result.indexingState} | pageFetchState: ${result.pageFetchState} | lastCrawlTime: ${result.lastCrawlTime}`,
      ]);
    } catch (err) {
      console.error(`URL ${index}/${urls.length} : ÉCHEC — ${url} — ${err.message}`);
      appendLog([
        `[${new Date().toISOString()}] ${url} | ERREUR: ${err.message}`,
      ]);
      failed.push({ url, error: err.message });
    }

    if (index < urls.length) {
      await sleep(INSPECT_DELAY_MS);
    }
  }

  console.log('\nInspection terminée.');
  console.log(`Indexées : ${indexed.length}/${urls.length}`);
  console.log(`Non indexées : ${notIndexed.length}/${urls.length}`);
  console.log(`Échecs : ${failed.length}/${urls.length}`);

  if (notIndexed.length) {
    console.log('\n--- Pages NON indexées (avec raison Google) ---');
    for (const r of notIndexed) {
      console.log(`  - ${r.url}`);
      console.log(`      coverageState : ${r.coverageState}`);
      console.log(`      indexingState : ${r.indexingState}`);
      console.log(`      pageFetchState: ${r.pageFetchState}`);
    }
  }

  if (failed.length) {
    console.log('\n--- Échecs d\'inspection ---');
    for (const f of failed) {
      console.log(`  - ${f.url} : ${f.error}`);
    }
  }

  console.log(`\nRésumé complet enregistré dans ${LOG_FILE}`);
}

main().catch((err) => {
  console.error('Erreur fatale :', err);
  process.exit(1);
});
