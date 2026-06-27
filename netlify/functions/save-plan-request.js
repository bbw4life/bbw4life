// netlify/functions/save-plan-request.js
process.removeAllListeners('warning');
const { google } = require('googleapis');
const { notifyTelegram } = require('./notify-telegram');
const { notifyPlanRequest } = require('./notify-email');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  try {
    
    const {
      firstName,
      lastName,
      email,
      phone,
      program,
      productId,
      size,
      color,
      consent
    } = JSON.parse(event.body);

    if (!firstName || !lastName || !email || !program) {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Missing required fields' }) };
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key:  process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const sheets        = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.SHEET_ID_BBW4LIFE_PLAN_REQUEST;

    function formatDate() {
      const d = new Date();
      return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear().toString().slice(-2)} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
    }

    
    const values = [[
      formatDate(),      
      firstName,         
      lastName,          
      email,             
      phone || '',       
      program,           
      productId || '',   
      size || '',        
      color || '',       
      consent || 'Yes',  
      'Pending'          
    ]];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range:            'bbw4life-plan-request!A:K',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource:         { values }
    });

    notifyPlanRequest({ email, firstName, lastName, program, productId, size, color }).catch(() => {});

    await notifyTelegram(
    `⏳ <b>Pdg Francenel, un client vient de mettre en attente un des design BBW4LIFE!</b>\n\n` +
    `👤 <b>Nom:</b> ${firstName} ${lastName}\n` +
    `📧 <b>Email:</b> ${email}\n` +
    `🎨 <b>Produit:</b> ${program}`
  );

    return { statusCode: 200, body: JSON.stringify({ success: true }) };

  } catch (error) {
    console.error('PLAN REQUEST ERROR:', error.message);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
  }
};