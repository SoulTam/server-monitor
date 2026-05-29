"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encrypt = encrypt;
exports.decrypt = decrypt;
const crypto_1 = __importDefault(require("crypto"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const electron_1 = require("electron");
const electron_log_1 = __importDefault(require("electron-log"));
const ALGORITHM = 'aes-256-cbc';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
let encryptionKey = null;
function getKeyPath() {
    return path_1.default.join(electron_1.app.getPath('userData'), '.key');
}
function loadOrCreateKey() {
    if (encryptionKey)
        return encryptionKey;
    const keyPath = getKeyPath();
    if (fs_1.default.existsSync(keyPath)) {
        encryptionKey = fs_1.default.readFileSync(keyPath);
        electron_log_1.default.info('Encryption key loaded');
    }
    else {
        encryptionKey = crypto_1.default.randomBytes(KEY_LENGTH);
        fs_1.default.writeFileSync(keyPath, encryptionKey, { mode: 0o600 });
        electron_log_1.default.info('Encryption key generated');
    }
    return encryptionKey;
}
function encrypt(text) {
    const key = loadOrCreateKey();
    const iv = crypto_1.default.randomBytes(IV_LENGTH);
    const cipher = crypto_1.default.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}
function decrypt(encrypted) {
    const key = loadOrCreateKey();
    const [ivHex, encryptedText] = encrypted.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto_1.default.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}
