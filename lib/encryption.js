import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const IV_LENGTH = 16; // For AES, this is always 16

/**
 * Encrypts a string using AES-256-CBC
 * @param {string} text 
 * @returns {string} Encrypted string in format: iv:encryptedData
 */
export function encrypt(text) {
  if (!text) return text;

  // Ensure the key is exactly 32 bytes
  const key = crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest();

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);

  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

/**
 * Decrypts a string using AES-256-CBC
 * @param {string} text Encrypted string in format: iv:encryptedData
 * @returns {string} Decrypted string
 */
export function decrypt(text) {
  if (!text || !text.includes(':')) return text;

  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');

    // Ensure the key is exactly 32 bytes
    const key = crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest();

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString();
  } catch (error) {
    console.error('Decryption failed:', error.message);
    // If decryption fails, it might be an unencrypted legacy string
    return text;
  }
}
