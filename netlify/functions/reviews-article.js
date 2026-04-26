// netlify/functions/reviews-article.js
const { google } = require('googleapis');

const SHEET_NAME = 'bbw4life-reviews-article';

async function getSheets() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key:  process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  return google.sheets({ version: 'v4', auth });
}

// Colonnes :
// A=articleId | B=firstName | C=lastName | D=avatar | E=rating | F=reviewText | G=date | H=likes | I=shares

async function getAllRows(sheets) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SHEET_ID_BBW4LIFE_REVIEWS_ARTICLE,
    range: `${SHEET_NAME}!A:I`
  });
  return res.data.values || [];
}

async function ensureHeader(sheets) {
  const rows = await getAllRows(sheets);
  if (rows.length === 0) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.SHEET_ID_BBW4LIFE_REVIEWS_ARTICLE,
      range: `${SHEET_NAME}!A1`,
      valueInputOption: 'RAW',
      resource: {
        values: [['articleId', 'firstName', 'lastName', 'avatar', 'rating', 'reviewText', 'date', 'likes', 'shares']]
      }
    });
  }
}

// Récupère toutes les reviews d'un article
function getReviewsFromRows(rows, articleId) {
  return rows
    .filter((r, i) => i > 0 && r[0] === articleId && r[1])
    .map(r => ({
      firstName: r[1] || '',
      lastName:  r[2] || '',
      avatar:    r[3] || '',
      rating:    parseInt(r[4] || '5'),
      text:      r[5] || '',
      date:      r[6] || ''
    }));
}

function getStatsFromRows(rows, articleId) {
  const articleRows = rows.filter((r, i) => i > 0 && r[0] === articleId);
  if (articleRows.length === 0) return { likes: 0, shares: 0, reviewsCount: 0 };

  const likes  = parseInt(articleRows[0][7] || '0');
  const shares = parseInt(articleRows[0][8] || '0');
  const reviewsCount = articleRows.filter(r => r[1]).length;

  return { likes, shares, reviewsCount };
}

async function updateStatsOnAllRows(sheets, rows, articleId, likes, shares) {
  const updates = [];
  rows.forEach((r, i) => {
    if (i > 0 && r[0] === articleId) {
      updates.push(
        sheets.spreadsheets.values.update({
          spreadsheetId: process.env.SHEET_ID_BBW4LIFE_REVIEWS_ARTICLE,
          range: `${SHEET_NAME}!H${i + 1}:I${i + 1}`,
          valueInputOption: 'RAW',
          resource: { values: [[likes, shares]] }
        })
      );
    }
  });
  if (updates.length > 0) await Promise.all(updates);
}

async function appendStatsRow(sheets, articleId) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.SHEET_ID_BBW4LIFE_REVIEWS_ARTICLE,
    range: `${SHEET_NAME}!A:I`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    resource: {
      values: [[articleId, '', '', '', '', '', '', 0, 0]]
    }
  });
}

// ════════════════════════════════════════════════════════════════
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const sheets = await getSheets();

    // ── GET ──────────────────────────────────────────────────────
    if (event.httpMethod === 'GET') {
      const articleId = (event.queryStringParameters || {}).articleId;
      if (!articleId) {
        return {
          statusCode: 400, headers,
          body: JSON.stringify({ success: false, error: 'articleId required' })
        };
      }

      const rows    = await getAllRows(sheets);
      const stats   = getStatsFromRows(rows, articleId);
      const reviews = getReviewsFromRows(rows, articleId);

      return {
        statusCode: 200, headers,
        body: JSON.stringify({
          success:      true,
          likes:        stats.likes,
          shares:       stats.shares,
          reviewsCount: stats.reviewsCount,
          reviews
        })
      };
    }

    // ── POST ─────────────────────────────────────────────────────
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { action, articleId } = body;

      if (!articleId) {
        return {
          statusCode: 400, headers,
          body: JSON.stringify({ success: false, error: 'articleId required' })
        };
      }

      await ensureHeader(sheets);
      let rows  = await getAllRows(sheets);
      const stats = getStatsFromRows(rows, articleId);

      const articleExists = rows.some((r, i) => i > 0 && r[0] === articleId);
      if (!articleExists) {
        await appendStatsRow(sheets, articleId);
        rows = await getAllRows(sheets);
      }

      // ── like ─────────────────────────────────────────────────
      if (action === 'like') {
        const newLikes = stats.likes + 1;
        await updateStatsOnAllRows(sheets, rows, articleId, newLikes, stats.shares);
        return {
          statusCode: 200, headers,
          body: JSON.stringify({ success: true, likes: newLikes })
        };
      }

      // ── share ────────────────────────────────────────────────
      if (action === 'share') {
        const newShares = stats.shares + 1;
        await updateStatsOnAllRows(sheets, rows, articleId, stats.likes, newShares);
        return {
          statusCode: 200, headers,
          body: JSON.stringify({ success: true, shares: newShares })
        };
      }

      // ── add-review ───────────────────────────────────────────
      if (action === 'add-review') {
        const { firstName, lastName, avatar, text, rating } = body;

        if (!firstName || !lastName || !text) {
          return {
            statusCode: 400, headers,
            body: JSON.stringify({ success: false, error: 'firstName, lastName and text are required' })
          };
        }

        const date = new Date().toLocaleDateString('en-US', {
          year: 'numeric', month: 'short', day: 'numeric'
        });

        await sheets.spreadsheets.values.append({
          spreadsheetId: process.env.SHEET_ID_BBW4LIFE_REVIEWS_ARTICLE,
          range: `${SHEET_NAME}!A:I`,
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          resource: {
            values: [[
              articleId,
              firstName.trim(),
              lastName.trim(),
              avatar || '',
              parseInt(rating) || 5,
              text.trim(),
              date,
              stats.likes,
              stats.shares
            ]]
          }
        });

        const newReviewsCount = stats.reviewsCount + 1;

        return {
          statusCode: 200, headers,
          body: JSON.stringify({ success: true, reviewsCount: newReviewsCount })
        };
      }

      return {
        statusCode: 400, headers,
        body: JSON.stringify({ success: false, error: 'Unknown action' })
      };
    }

    return {
      statusCode: 405, headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };

  } catch (err) {
    console.error('reviews-article ERROR:', err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
};