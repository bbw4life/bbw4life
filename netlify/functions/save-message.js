// netlify/functions/save-message.js
const { google } = require('googleapis');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ success: false, error: "Method not allowed" }) };
    }

    try {
        const body = JSON.parse(event.body);
        const { firstName, lastName, email, subject, message } = body;

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
        const spreadsheetId = process.env.GOOGLE_SHEET_ID_MESSAGES;

        function formatDate() {
            const d = new Date();
            return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear().toString().slice(-2)}`;
        }

        // ✅ CORRECTION ICI : values est déjà [[...]], on ne met PAS [values]
        const values = [[
            normalize(firstName),
            normalize(lastName),
            normalize(email),
            subject,
            message,
            formatDate()
        ]];

        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: "ContactMessages!A:F",
            valueInputOption: "RAW",
            insertDataOption: "INSERT_ROWS",
            resource: { values }   // ← CORRIGÉ (plus de [values])
        });

        return { statusCode: 200, body: JSON.stringify({ success: true }) };
    } catch (error) {
        console.error("SAVE MESSAGE ERROR:", error.message);
        return { 
            statusCode: 500, 
            body: JSON.stringify({ success: false, error: error.message }) 
        };
    }
};