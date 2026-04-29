import crypto from 'crypto';

const ALGO = 'aes-256-cbc';

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY ?? 'digygo_default_encryption_key_32b';
  return Buffer.from(raw.padEnd(32, '0').slice(0, 32));
}

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(stored: string): string {
  const [ivHex, dataHex] = stored.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const data = Buffer.from(dataHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
