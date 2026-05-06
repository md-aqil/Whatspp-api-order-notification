import { createConnection } from 'mysql2/promise';
import crypto from 'crypto';

// Try to decrypt with 'undefined' key (what happened when ENCRYPTION_KEY was missing)
const OLD_KEY = crypto.createHash('sha256').update('undefined').digest();
const NEW_KEY = crypto.createHash('sha256').update('chatflow-secret-32-char-local-key').digest();

function tryDecrypt(text, key) {
  if (!text || !text.includes(':')) return null;
  try {
    const parts = text.split(':');
    const iv = Buffer.from(parts.shift(), 'hex');
    const enc = Buffer.from(parts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let dec = decipher.update(enc);
    dec = Buffer.concat([dec, decipher.final()]);
    return dec.toString();
  } catch (e) {
    return null;
  }
}

function encryptWith(text, key) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let enc = cipher.update(text);
  enc = Buffer.concat([enc, cipher.final()]);
  return iv.toString('hex') + ':' + enc.toString('hex');
}

const conn = await createConnection({ host: 'localhost', user: 'root', database: 'whatsapp_api' });

const [rows] = await conn.execute("SELECT userId, whatsapp FROM integrations WHERE userId = '6fbc547a-4a0b-4a6e-a152-92893348a8da'");

for (const row of rows) {
  const raw = row.whatsapp;
  console.log('Raw value type:', typeof raw);
  console.log('Raw preview:', String(raw).substring(0, 60));
  
  // Try decrypt with 'undefined' key
  const dec1 = tryDecrypt(raw, OLD_KEY);
  if (dec1) {
    console.log('✅ Decrypted with OLD key (undefined):', dec1.substring(0, 80));
    // Re-encrypt with new key and JSON.stringify for MySQL JSON column
    const reEncrypted = JSON.stringify(encryptWith(dec1, NEW_KEY));
    await conn.execute("UPDATE integrations SET whatsapp = ? WHERE userId = ?", [reEncrypted, row.userId]);
    console.log('✅ Re-encrypted with NEW key and saved!');
  } else {
    // Try decrypt with new key
    const dec2 = tryDecrypt(raw, NEW_KEY);
    if (dec2) {
      console.log('✅ Already encrypted with NEW key:', dec2.substring(0, 80));
    } else {
      console.log('❌ Could not decrypt with either key. Raw value might be plain JSON.');
      // Check if it's already plain JSON
      try {
        const parsed = JSON.parse(raw);
        console.log('📋 Already plain JSON:', JSON.stringify(parsed).substring(0, 100));
      } catch(e) {
        console.log('❌ Not plain JSON either. Need to re-enter integration manually.');
      }
    }
  }
}

await conn.end();
