process.removeAllListeners('warning');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const ALLOWED_HOST = 'cdn.shopify.com';
const DEFAULT_WATERMARK_TEXT = 'bbw4life.com';

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getWatermarkSetting() {
  try {
    const dataPath = path.join(__dirname, '../../products.data.json');
    const raw = fs.readFileSync(dataPath, 'utf8');
    const allProducts = JSON.parse(raw);
    const settings = allProducts.find((p) => p.type === 'settings') || {};
    return settings.watermark || {};
  } catch (e) {
    console.error('[watermark-image] Could not read watermark setting:', e.message);
    return {};
  }
}

function buildWatermarkSvg(width, height, text) {
  const fontSize = Math.max(18, Math.round(width * 0.055));
  const y = Math.round(height * 0.90);
  const safeText = escapeXml(text);

  return Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <style>
        .wm {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-weight: 900;
          font-size: ${fontSize}px;
          letter-spacing: ${Math.round(fontSize * 0.12)}px;
          fill: rgba(80,60,60,0.34);
        }
      </style>
      <text x="50%" y="${y}" text-anchor="middle" class="wm">${safeText}</text>
    </svg>
  `);
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const { src } = event.queryStringParameters || {};

  if (!src) {
    return {
      statusCode: 400,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Missing src parameter' })
    };
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(src);
  } catch (e) {
    return {
      statusCode: 400,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Invalid src URL' })
    };
  }

  if (parsedUrl.hostname !== ALLOWED_HOST) {
    return {
      statusCode: 400,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'src host not allowed' })
    };
  }

  try {
    const imgResponse = await fetch(parsedUrl.toString());
    if (!imgResponse.ok) {
      return {
        statusCode: 502,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: `Upstream image fetch failed (${imgResponse.status})` })
      };
    }

    const inputBuffer = Buffer.from(await imgResponse.arrayBuffer());
    const image = sharp(inputBuffer);

    const wmSetting = getWatermarkSetting();
    const watermarkEnabled = (wmSetting.show || 'no').toLowerCase().trim() === 'yes';

    let pipeline = image;
    if (watermarkEnabled) {
      const metadata = await image.metadata();
      const width = metadata.width || 1200;
      const height = metadata.height || 1200;
      const text = wmSetting.text || DEFAULT_WATERMARK_TEXT;
      const watermarkSvg = buildWatermarkSvg(width, height, text);
      pipeline = image.composite([{ input: watermarkSvg, top: 0, left: 0 }]);
    }

    const outputBuffer = await pipeline
      .jpeg({ quality: 88 })
      .toBuffer();

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable'
      },
      body: outputBuffer.toString('base64'),
      isBase64Encoded: true
    };
  } catch (error) {
    console.error('[watermark-image] Error:', error.message);
    return {
      statusCode: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};
