import { Client, ConnectConfig } from 'ssh2';
import fs from 'fs';
import log from 'electron-log';
import { SSH_CONNECT_TIMEOUT, SSH_COMMAND_TIMEOUT, SSH_KEEPALIVE_INTERVAL, SSH_KEEPALIVE_MAX_COUNT } from '../../shared/constants';

interface SshConnection {
  client: Client;
  serverId: string;
}

export class SshService {
  private connections: Map<string, SshConnection> = new Map();

  async connect(serverId: string, config: {
    host: string;
    port: number;
    username: string;
    authType: 'password' | 'key';
    password?: string;
    privateKeyPath?: string;
    privateKeyPassphrase?: string;
  }): Promise<void> {
    const existing = this.connections.get(serverId);
    if (existing) {
      existing.client.end();
      this.connections.delete(serverId);
    }

    const client = new Client();
    const connectConfig: ConnectConfig = {
      host: config.host,
      port: config.port,
      username: config.username,
      readyTimeout: SSH_CONNECT_TIMEOUT,
      keepaliveInterval: SSH_KEEPALIVE_INTERVAL,
      keepaliveCountMax: SSH_KEEPALIVE_MAX_COUNT,
    };

    if (config.authType === 'password' && config.password) {
      connectConfig.password = config.password;
    } else if (config.authType === 'key' && config.privateKeyPath) {
      connectConfig.privateKey = fs.readFileSync(config.privateKeyPath);
      if (config.privateKeyPassphrase) {
        connectConfig.passphrase = config.privateKeyPassphrase;
      }
    }

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        client.end();
        reject(new Error('SSH_CONNECT_TIMEOUT'));
      }, SSH_CONNECT_TIMEOUT);

      client.on('ready', () => {
        clearTimeout(timeout);
        this.connections.set(serverId, { client, serverId });
        log.info(`SSH connected: ${config.host}:${config.port}`);
        resolve();
      });

      client.on('error', (err) => {
        clearTimeout(timeout);
        this.connections.delete(serverId);
        log.error(`SSH error for ${serverId}: ${err.message}`);
        reject(err);
      });

      client.on('close', () => {
        this.connections.delete(serverId);
        log.info(`SSH disconnected: ${serverId}`);
      });

      client.connect(connectConfig);
    });
  }

  async executeCommand(serverId: string, command: string): Promise<string> {
    const conn = this.connections.get(serverId);
    if (!conn) {
      throw new Error('SSH_NOT_CONNECTED');
    }

    return new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('SSH_COMMAND_TIMEOUT'));
      }, SSH_COMMAND_TIMEOUT);

      conn.client.exec(command, (err, stream) => {
        if (err) {
          clearTimeout(timeout);
          reject(err);
          return;
        }

        let stdout = '';
        let stderr = '';

        stream.on('data', (data: Buffer) => {
          stdout += data.toString();
        });

        stream.stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
        });

        stream.on('close', () => {
          clearTimeout(timeout);
          if (stderr && !stdout) {
            reject(new Error(stderr.trim()));
          } else {
            resolve(stdout);
          }
        });
      });
    });
  }

  disconnect(serverId: string): void {
    const conn = this.connections.get(serverId);
    if (conn) {
      conn.client.end();
      this.connections.delete(serverId);
    }
  }

  disconnectAll(): void {
    for (const [id, conn] of this.connections) {
      conn.client.end();
      this.connections.delete(id);
    }
  }

  isConnected(serverId: string): boolean {
    return this.connections.has(serverId);
  }
}

export const sshService = new SshService();
