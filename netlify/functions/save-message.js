// netlify/functions/save-message.js
process.removeAllListeners('warning');
const { google } = require('googleapis');
const { notifyTelegram } = require('./notify-telegram');
const { notifyContactReply } = require('./notify-email');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ success: false, error: "Method not allowed" }) };
    }

    try {
        const body = JSON.parse(event.body);
        const { firstName, lastName, email, subject, category, message } = body;

        if (!firstName || !lastName || !email || !subject || !message) {
            throw new Error("All fields are required");
        }

        const normalize = (str) => str ? str.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() : "";

        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
            },
            scopes: ["https://www.googleapis.com/auth/spreadsheets"]
        });

        const sheets = google.sheets({ version: "v4", auth });
        const spreadsheetId = process.env.SHEET_ID_BBW4LIFE_ACCOUNTS;

        function formatDate() {
            const d = new Date();
            return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear().toString().slice(-2)}`;
        }

        const values = [[
            normalize(firstName),
            normalize(lastName),
            normalize(email),
            subject,
            category || "N/A",
            message,
            formatDate()
        ]];

        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: "bbw4life-contact-messages!A:G",
            valueInputOption: "RAW",
            insertDataOption: "INSERT_ROWS",
            resource: { values }
        });

        await notifyTelegram(
        `📩 <b>Pdg Francenel, un client vient de vous envoyer un message depuis la page contact!</b>\n\n` +
        `👤 <b>Nom:</b> ${firstName} ${lastName}\n` +
        `📧 <b>Email:</b> ${email}\n` +
        `📌 <b>Sujet:</b> ${subject}\n` +
        `🗂️ <b>Catégorie:</b> ${category || 'N/A'}`
        );

        // ── Email Contact Auto-Reply ──
        notifyContactReply({ email, firstName, lastName, subject, category: category || 'N/A' }).catch(e => console.error('[save-message] notifyContactReply failed:', e.message));

        return { statusCode: 200, body: JSON.stringify({ success: true }) };
    } catch (error) {
        console.error("SAVE MESSAGE ERROR:", error.message);
        return { 
            statusCode: 500, 
            body: JSON.stringify({ success: false, error: error.message }) 
        };
    }
};