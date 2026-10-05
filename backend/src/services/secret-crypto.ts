import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { config } from '../config.js';

const algorithm = 'aes-256-gcm';
const key = createHash('sha256').update(config.integrationEncryptionKey).digest();

export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return {
    encrypted: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64')
  };
}

export function decryptSecret(input: { encrypted: string; iv: string; tag: string }) {
  const decipher = createDecipheriv(algorithm, key, Buffer.from(input.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(input.tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(input.encrypted, 'base64')),
    decipher.final()
  ]).toString('utf8');
}
