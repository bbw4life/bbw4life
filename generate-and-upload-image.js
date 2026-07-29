require('dotenv').config();
const fs = require('fs');
const path = require('path');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-10';

const PROMPTS_FILE = path.join(__dirname, 'prompts.json');
const OUTPUT_DIR = path.join(__dirname, 'tmp-images');
const LOG_FILE = path.join(__dirname, 'image-urls.log');

function requireEnv() {
  const missing = [];
  if (!OPENAI_API_KEY) missing.push('OPENAI_API_KEY');
  if (!SHOPIFY_ACCESS_TOKEN) missing.push('SHOPIFY_ACCESS_TOKEN');
  if (!SHOPIFY_STORE_DOMAIN) missing.push('SHOPIFY_STORE_DOMAIN');
  if (missing.length) {
    console.error(`Variables d'environnement manquantes dans .env : ${missing.join(', ')}`);
    process.exit(1);
  }
}

function loadPrompts() {
  if (!fs.existsSync(PROMPTS_FILE)) {
    console.error(`Fichier introuvable : ${PROMPTS_FILE}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(PROMPTS_FILE, 'utf8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    console.error(`prompts.json invalide (JSON malformé) : ${err.message}`);
    process.exit(1);
  }
  if (!Array.isArray(data)) {
    console.error('prompts.json doit contenir un tableau.');
    process.exit(1);
  }
  return data;
}

function assignFilenames(entries) {
  const counters = {};
  return entries.map((entry) => {
    const name = entry.name;
    if (!(name in counters)) {
      counters[name] = entry.startIndex ? entry.startIndex - 1 : 0;
    }
    counters[name] += 1;
    return { ...entry, filename: `${name}-${counters[name]}` };
  });
}

async function generateImage(prompt) {
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-image-2',
      prompt,
      quality: 'medium',
      n: 1,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const item = data.data && data.data[0];
  if (!item) {
    throw new Error('Réponse OpenAI sans image.');
  }

  if (item.b64_json) {
    return { buffer: Buffer.from(item.b64_json, 'base64'), usage: data.usage || null };
  }

  if (item.url) {
    const imgRes = await fetch(item.url);
    if (!imgRes.ok) {
      throw new Error(`Échec du téléchargement de l'image générée (${imgRes.status})`);
    }
    const arrayBuffer = await imgRes.arrayBuffer();
    return { buffer: Buffer.from(arrayBuffer), usage: data.usage || null };
  }

  throw new Error('Réponse OpenAI sans url ni b64_json.');
}

async function editImage(prompt, referenceImagePath) {
  const absolutePath = path.isAbsolute(referenceImagePath)
    ? referenceImagePath
    : path.join(__dirname, referenceImagePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Image de référence introuvable : ${absolutePath}`);
  }

  const imageBuffer = fs.readFileSync(absolutePath);
  const imageMime = mimeTypeForFile(absolutePath);

  const form = new FormData();
  form.append('model', 'gpt-image-2');
  form.append('prompt', prompt);
  form.append('quality', 'medium');
  form.append('n', '1');
  form.append('image', new Blob([imageBuffer], { type: imageMime }), path.basename(absolutePath));

  const response = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: form,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const item = data.data && data.data[0];
  if (!item) {
    throw new Error('Réponse OpenAI sans image.');
  }

  if (item.b64_json) {
    return { buffer: Buffer.from(item.b64_json, 'base64'), usage: data.usage || null };
  }

  if (item.url) {
    const imgRes = await fetch(item.url);
    if (!imgRes.ok) {
      throw new Error(`Échec du téléchargement de l'image générée (${imgRes.status})`);
    }
    const arrayBuffer = await imgRes.arrayBuffer();
    return { buffer: Buffer.from(arrayBuffer), usage: data.usage || null };
  }

  throw new Error('Réponse OpenAI sans url ni b64_json.');
}

function mimeTypeForFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  return 'image/png';
}

async function getImageBuffer(entry) {
  if (entry.referenceImage) {
    return editImage(entry.prompt, entry.referenceImage);
  }
  return generateImage(entry.prompt);
}

function saveImageLocally(buffer, filename) {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  const filePath = path.join(OUTPUT_DIR, `${filename}.png`);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

async function shopifyGraphQL(query, variables) {
  const url = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Shopify API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  if (data.errors) {
    throw new Error(`Shopify GraphQL error: ${JSON.stringify(data.errors)}`);
  }
  return data.data;
}

async function uploadToShopify(buffer, filename) {
  const stagedQuery = `
    mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets {
          url
          resourceUrl
          parameters { name value }
        }
        userErrors { field message }
      }
    }
  `;
  const stagedVariables = {
    input: [
      {
        filename: `${filename}.png`,
        mimeType: 'image/png',
        httpMethod: 'POST',
        resource: 'FILE',
      },
    ],
  };

  const stagedData = await shopifyGraphQL(stagedQuery, stagedVariables);
  const stagedErrors = stagedData.stagedUploadsCreate.userErrors;
  if (stagedErrors && stagedErrors.length) {
    throw new Error(`stagedUploadsCreate userErrors: ${JSON.stringify(stagedErrors)}`);
  }
  const target = stagedData.stagedUploadsCreate.stagedTargets[0];

  const form = new FormData();
  for (const param of target.parameters) {
    form.append(param.name, param.value);
  }
  form.append('file', new Blob([buffer], { type: 'image/png' }), `${filename}.png`);

  const uploadRes = await fetch(target.url, {
    method: 'POST',
    body: form,
  });
  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Échec upload vers staged target (${uploadRes.status}): ${errText}`);
  }

  const fileCreateQuery = `
    mutation fileCreate($files: [FileCreateInput!]!) {
      fileCreate(files: $files) {
        files {
          id
          fileStatus
          alt
          preview { image { url } }
          ... on MediaImage {
            image { url }
          }
        }
        userErrors { field message }
      }
    }
  `;
  const fileCreateVariables = {
    files: [
      {
        originalSource: target.resourceUrl,
        contentType: 'IMAGE',
        alt: filename,
      },
    ],
  };

  const fileCreateData = await shopifyGraphQL(fileCreateQuery, fileCreateVariables);
  const fileErrors = fileCreateData.fileCreate.userErrors;
  if (fileErrors && fileErrors.length) {
    throw new Error(`fileCreate userErrors: ${JSON.stringify(fileErrors)}`);
  }

  const createdFile = fileCreateData.fileCreate.files[0];
  const finalUrl = await resolveFileUrl(createdFile.id);
  return finalUrl;
}

async function resolveFileUrl(fileId, attempt = 1) {
  const query = `
    query getFile($id: ID!) {
      node(id: $id) {
        ... on MediaImage {
          fileStatus
          image { url }
        }
      }
    }
  `;
  const data = await shopifyGraphQL(query, { id: fileId });
  const node = data.node;

  if (node && node.image && node.image.url) {
    return node.image.url;
  }

  if (attempt >= 10) {
    throw new Error(`Timeout en attendant l'URL finale Shopify pour le fichier ${fileId}`);
  }

  await sleep(1500);
  return resolveFileUrl(fileId, attempt + 1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function appendLog(lines) {
  fs.appendFileSync(LOG_FILE, lines.join('\n') + '\n');
}

async function main() {
  requireEnv();

  const rawEntries = loadPrompts();
  if (rawEntries.length === 0) {
    console.log('prompts.json est vide — rien à traiter.');
    return;
  }

  const entries = assignFilenames(rawEntries);
  const total = entries.length;
  const failed = [];

  console.log(`Démarrage du traitement de ${total} prompt(s)...\n`);

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const index = i + 1;

    try {
      const mode = entry.referenceImage ? 'édition avec image de référence' : 'génération';
      console.log(`Image ${index}/${total} : ${mode} de "${entry.filename}"...`);
      const { buffer, usage } = await getImageBuffer(entry);

      if (usage) {
        console.log(`Image ${index}/${total} : usage OpenAI -> ${JSON.stringify(usage)}`);
      } else {
        console.log(`Image ${index}/${total} : aucun champ usage retourné par l'API OpenAI pour cet appel.`);
      }

      saveImageLocally(buffer, entry.filename);

      const shopifyUrl = await uploadToShopify(buffer, entry.filename);

      console.log(`Image ${index}/${total} : ${entry.filename} générée et uploadée avec succès -> ${shopifyUrl}`);

      appendLog([
        `[${new Date().toISOString()}] ${entry.filename} | prompt: ${entry.prompt} | referenceImage: ${entry.referenceImage || '-'} | usage: ${usage ? JSON.stringify(usage) : '-'} | url: ${shopifyUrl}`,
      ]);
    } catch (err) {
      console.error(`Image ${index}/${total} : ÉCHEC pour "${entry.filename}" — ${err.message}`);
      appendLog([
        `[${new Date().toISOString()}] ${entry.filename} | prompt: ${entry.prompt} | referenceImage: ${entry.referenceImage || '-'} | ERREUR: ${err.message}`,
      ]);
      failed.push({ ...entry, error: err.message });
    }
  }

  console.log('\nTraitement terminé.');
  console.log(`Succès : ${total - failed.length}/${total}`);

  if (failed.length) {
    console.log(`\nÉchecs (${failed.length}) :`);
    for (const f of failed) {
      console.log(`  - ${f.filename} (${f.name}) : ${f.error}`);
    }
  }
}

main().catch((err) => {
  console.error('Erreur fatale :', err);
  process.exit(1);
});
