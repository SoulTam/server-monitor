import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import log from 'electron-log';

const ALGORITHM = 'aes-256-cbc';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;

let encryptionKey: Buffer | null = null;

function getKeyPath(): string {
  return path.join(app.getPath('userData'), '.key');
}

function loadOrCreateKey(): Buffer {
  if (encryptionKey) return encryptionKey;

  const keyPath = getKeyPath();
  if (fs.existsSync(keyPath)) {
    encryptionKey = fs.readFileSync(keyPath);
    log.info('Encryption key loaded');
  } else {
    encryptionKey = crypto.randomBytes(KEY_LENGTH);
    fs.writeFileSync(keyPath, encryptionKey, { mode: 0o600 });
    log.info('Encryption key generated');
  }
  return encryptionKey;
}

export function encrypt(text: string): string {
  const key = loadOrCreateKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export function decrypt(encrypted: string): string {
  const key = loadOrCreateKey();
  const [ivHex, encryptedText] = encrypted.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
