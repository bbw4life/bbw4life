/* ══════════════════════════════════════════════════════
   LIVE CHAT — polling frontend (toutes les 3-5s tant que la
   page reste ouverte, cf. script.js). Renvoie les messages
   "agent" pour un chat_id donné, plus le statut de session
   (pending / answered / closed) pour que le frontend sache
   quand arrêter le polling.
══════════════════════════════════════════════════════ */
const { getLiveChatRowsFor, findOpenStatusFor } = require('./_lib/live-chat-sheet');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'GET')     return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  const chatId = (event.queryStringParameters || {}).chatId;
  if (!chatId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'chatId is required' }) };
  }

  try {
    const rows = await getLiveChatRowsFor(chatId);
    const status = await findOpenStatusFor(chatId);

    const agentMessages = rows
      .filter(r => r[1] === 'agent')
      .map(r => ({ message: r[2], timestamp: r[3] }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, status: status || 'pending', messages: agentMessages })
    };
  } catch (e) {
    console.error('[live-chat] get-live-chat-messages FAILED:', e.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to fetch messages' }) };
  }
};
