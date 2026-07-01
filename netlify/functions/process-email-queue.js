process.removeAllListeners('warning');

exports.handler = async () => {
  try {
    const base = process.env.BASE_URL || 'https://bbw4life.com';
    const res = await fetch(
      `${base}/.netlify/functions/send-email-auto?action=process-queue&secret=${process.env.REPORT_SECRET}`
    );
    const data = await res.json();
    console.log('[Scheduled Queue]', JSON.stringify(data));
    return { statusCode: 200, body: JSON.stringify(data) };
  } catch (e) {
    console.error('[Scheduled Queue] Error:', e.message);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};