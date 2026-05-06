import { createConnection } from 'mysql2/promise';
import crypto from 'crypto';

const KEY = crypto.createHash('sha256').update('chatflow-secret-32-char-local-key').digest();

function decrypt(text) {
  if (!text || !text.includes(':')) return text;
  try {
    const parts = text.split(':');
    const iv = Buffer.from(parts.shift(), 'hex');
    const enc = Buffer.from(parts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', KEY, iv);
    let dec = decipher.update(enc);
    dec = Buffer.concat([dec, decipher.final()]);
    return dec.toString();
  } catch (e) {
    return text;
  }
}

const conn = await createConnection({ host: 'localhost', user: 'root', database: 'whatsapp_api' });
const [rows] = await conn.execute("SELECT whatsapp FROM integrations WHERE userId = '6fbc547a-4a0b-4a6e-a152-92893348a8da'");
await conn.end();

const raw = rows[0]?.whatsapp;
const decrypted = decrypt(raw);
let wa;
try { wa = JSON.parse(decrypted); } catch(e) { wa = decrypted; }

console.log('📋 Decrypted WA integration:');
console.log('   phoneNumberId:', wa.phoneNumberId);
console.log('   businessAccountId:', wa.businessAccountId);
console.log('   accessToken (first 30):', wa.accessToken?.substring(0, 30) + '...');
console.log('');

// Test the token via WhatsApp API
const testTo = '917210562014'; // customer phone
const url = `https://graph.facebook.com/v22.0/${wa.phoneNumberId}/messages`;
console.log(`🚀 Sending test message to ${testTo} via ${url}`);

const res = await fetch(url, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${wa.accessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    messaging_product: 'whatsapp',
    to: testTo,
    type: 'text',
    text: { body: 'Test from automation engine ✅' }
  })
});

const result = await res.json();
console.log('📬 API Response:', JSON.stringify(result, null, 2));
