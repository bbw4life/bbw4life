// netlify/functions/get-google-client-id.js
// Expose le Client ID OAuth Google au frontend — c'est une donnée publique
// par design (Google Identity Services l'utilise côté navigateur), à ne pas
// confondre avec GOOGLE_CLIENT_SECRET (jamais utilisé, jamais exposé).
exports.handler = async () => {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: process.env.GOOGLE_CLIENT_ID || '' })
  };
};
