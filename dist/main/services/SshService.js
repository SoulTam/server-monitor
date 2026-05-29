"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sshService = exports.SshService = void 0;
const ssh2_1 = require("ssh2");
const fs_1 = __importDefault(require("fs"));
const electron_log_1 = __importDefault(require("electron-log"));
const constants_1 = require("../../shared/constants");
class SshService {
    connections = new Map();
    async connect(serverId, config) {
        const existing = this.connections.get(serverId);
        if (existing) {
            existing.client.end();
            this.connections.delete(serverId);
        }
        const client = new ssh2_1.Client();
        const connectConfig = {
            host: config.host,
            port: config.port,
            username: config.username,
            readyTimeout: constants_1.SSH_CONNECT_TIMEOUT,
            keepaliveInterval: constants_1.SSH_KEEPALIVE_INTERVAL,
            keepaliveCountMax: constants_1.SSH_KEEPALIVE_MAX_COUNT,
        };
        if (config.authType === 'password' && config.password) {
            connectConfig.password = config.password;
        }
        else if (config.authType === 'key' && config.privateKeyPath) {
            connectConfig.privateKey = fs_1.default.readFileSync(config.privateKeyPath);
            if (config.privateKeyPassphrase) {
                connectConfig.passphrase = config.privateKeyPassphrase;
            }
        }
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                client.end();
                reject(new Error('SSH_CONNECT_TIMEOUT'));
            }, constants_1.SSH_CONNECT_TIMEOUT);
            client.on('ready', () => {
                clearTimeout(timeout);
                this.connections.set(serverId, { client, serverId });
                electron_log_1.default.info(`SSH connected: ${config.host}:${config.port}`);
                resolve();
            });
            client.on('error', (err) => {
                clearTimeout(timeout);
                this.connections.delete(serverId);
                electron_log_1.default.error(`SSH error for ${serverId}: ${err.message}`);
                reject(err);
            });
            client.on('close', () => {
                this.connections.delete(serverId);
                electron_log_1.default.info(`SSH disconnected: ${serverId}`);
            });
            client.connect(connectConfig);
        });
    }
    async executeCommand(serverId, command) {
        const conn = this.connections.get(serverId);
        if (!conn) {
            throw new Error('SSH_NOT_CONNECTED');
        }
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('SSH_COMMAND_TIMEOUT'));
            }, constants_1.SSH_COMMAND_TIMEOUT);
            conn.client.exec(command, (err, stream) => {
                if (err) {
                    clearTimeout(timeout);
                    reject(err);
                    return;
                }
                let stdout = '';
                let stderr = '';
                stream.on('data', (data) => {
                    stdout += data.toString();
                });
                stream.stderr.on('data', (data) => {
                    stderr += data.toString();
                });
                stream.on('close', () => {
                    clearTimeout(timeout);
                    if (stderr && !stdout) {
                        reject(new Error(stderr.trim()));
                    }
                    else {
                        resolve(stdout);
                    }
                });
            });
        });
    }
    disconnect(serverId) {
        const conn = this.connections.get(serverId);
        if (conn) {
            conn.client.end();
            this.connections.delete(serverId);
        }
    }
    disconnectAll() {
        for (const [id, conn] of this.connections) {
            conn.client.end();
            this.connections.delete(id);
        }
    }
    isConnected(serverId) {
        return this.connections.has(serverId);
    }
}
exports.SshService = SshService;
exports.sshService = new SshService();
