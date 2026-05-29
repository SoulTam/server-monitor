import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

const testDir = path.join(os.tmpdir(), 'server-monitor-test-crypto');

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => testDir),
  },
}));

describe('crypto', () => {
  beforeEach(() => {
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
    const keyPath = path.join(testDir, '.key');
    if (fs.existsSync(keyPath)) fs.unlinkSync(keyPath);
    vi.resetModules();
  });

  afterEach(() => {
    const keyPath = path.join(testDir, '.key');
    if (fs.existsSync(keyPath)) fs.unlinkSync(keyPath);
  });

  it('encrypts and decrypts a string back to original', async () => {
    const { encrypt, decrypt } = await import('../src/main/utils/crypto');
    const text = 'hello-secret-password-123';
    const encrypted = encrypt(text);
    expect(encrypted).not.toBe(text);
    expect(decrypt(encrypted)).toBe(text);
  });

  it('produces different ciphertext for same plaintext (random IV)', async () => {
    const { encrypt, decrypt } = await import('../src/main/utils/crypto');
    const text = 'same-text';
    const e1 = encrypt(text);
    const e2 = encrypt(text);
    expect(e1).not.toBe(e2);
    expect(decrypt(e1)).toBe(text);
    expect(decrypt(e2)).toBe(text);
  });

  it('persists key file on first encrypt', async () => {
    const { encrypt } = await import('../src/main/utils/crypto');
    const keyPath = path.join(testDir, '.key');
    encrypt('test');
    expect(fs.existsSync(keyPath)).toBe(true);
  });
});
