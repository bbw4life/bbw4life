// _lib/password.js
// Hashing de mot de passe avec le module natif Node "crypto" (scrypt).
// Choix : aucune dépendance de hashing (bcrypt, argon2...) n'est présente dans
// package.json — plutôt que d'ajouter une nouvelle dépendance npm sans
// autorisation explicite, on utilise crypto.scryptSync (inclus dans Node.js),
// avec un salt aléatoire par mot de passe, stocké au format "salt:hash" (hex).
process.removeAllListeners('warning');
const crypto = require('crypto');

const SALT_BYTES = 16;   // 32 caractères hex
const KEY_LENGTH = 64;   // 128 caractères hex

// Format strict "salt:hash" en hexadécimal — sert à distinguer un mot de passe
// déjà hashé d'un ancien mot de passe stocké en clair (migration progressive).
const HASH_FORMAT_RE = /^[0-9a-f]{32}:[0-9a-f]{128}$/i;

function isHashedPassword(stored) {
  return typeof stored === 'string' && HASH_FORMAT_RE.test(stored.trim());
}

function hashPassword(plainPassword) {
  const salt = crypto.randomBytes(SALT_BYTES).toString('hex');
  const hash = crypto.scryptSync(String(plainPassword), salt, KEY_LENGTH).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(plainPassword, storedHash) {
  if (!isHashedPassword(storedHash)) return false;
  const [salt, hashHex] = storedHash.trim().split(':');
  try {
    const expected = Buffer.from(hashHex, 'hex');
    const actual = crypto.scryptSync(String(plainPassword), salt, KEY_LENGTH);
    if (expected.length !== actual.length) return false;
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

module.exports = { hashPassword, verifyPassword, isHashedPassword };
