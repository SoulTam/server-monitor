"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serverConfigService = exports.ServerConfigService = void 0;
const DataService_1 = require("../database/DataService");
const crypto_1 = require("../utils/crypto");
const constants_1 = require("../../shared/constants");
class ServerConfigService {
    createServer(input) {
        const encryptedPassword = input.password ? (0, crypto_1.encrypt)(input.password) : undefined;
        const encryptedPassphrase = input.privateKeyPassphrase ? (0, crypto_1.encrypt)(input.privateKeyPassphrase) : undefined;
        return DataService_1.dataService.saveServer({
            name: input.name,
            ip: input.ip,
            port: input.port ?? constants_1.DEFAULT_SERVER_CONFIG.port,
            username: input.username,
            authType: input.authType,
            password: encryptedPassword,
            privateKeyPath: input.privateKeyPath,
            privateKeyPassphrase: encryptedPassphrase,
            monitorInterval: input.monitorInterval ?? constants_1.DEFAULT_SERVER_CONFIG.monitorInterval,
            monitorItems: input.monitorItems ?? [...constants_1.DEFAULT_SERVER_CONFIG.monitorItems],
            cpuThreshold: input.cpuThreshold ?? constants_1.DEFAULT_SERVER_CONFIG.cpuThreshold,
            memoryThreshold: input.memoryThreshold ?? constants_1.DEFAULT_SERVER_CONFIG.memoryThreshold,
            diskThreshold: input.diskThreshold ?? constants_1.DEFAULT_SERVER_CONFIG.diskThreshold,
            networkThreshold: input.networkThreshold ?? constants_1.DEFAULT_SERVER_CONFIG.networkThreshold,
            status: 'idle',
        });
    }
    updateServer(input) {
        const fields = { ...input };
        if (input.password) {
            fields.password = (0, crypto_1.encrypt)(input.password);
        }
        else {
            delete fields.password;
        }
        if (input.privateKeyPassphrase) {
            fields.privateKeyPassphrase = (0, crypto_1.encrypt)(input.privateKeyPassphrase);
        }
        else {
            delete fields.privateKeyPassphrase;
        }
        DataService_1.dataService.updateServer(input.id, fields);
    }
    deleteServer(id) {
        const server = DataService_1.dataService.getServer(id);
        if (server && server.status === 'monitoring') {
            throw new Error('Cannot delete a server that is currently being monitored');
        }
        DataService_1.dataService.deleteServer(id);
    }
    listServers() {
        const servers = DataService_1.dataService.listServers();
        return servers.map((s) => {
            const latest = DataService_1.dataService.getLatestMetrics(s.id);
            const activeAlerts = DataService_1.dataService.getAlerts({ serverId: s.id, status: 'active' }, 1, 1);
            return {
                ...s,
                password: undefined,
                privateKeyPassphrase: undefined,
                latestMetrics: {
                    cpu: latest.cpu,
                    memory: latest.memory,
                    disk: latest.disk,
                },
                activeAlertCount: activeAlerts.total,
            };
        });
    }
    getServer(id) {
        const server = DataService_1.dataService.getServer(id);
        if (!server)
            return undefined;
        const result = { ...server };
        if (result.password)
            result.password = (0, crypto_1.decrypt)(result.password);
        if (result.privateKeyPassphrase)
            result.privateKeyPassphrase = (0, crypto_1.decrypt)(result.privateKeyPassphrase);
        return result;
    }
    getServerForDisplay(id) {
        const server = DataService_1.dataService.getServer(id);
        if (!server)
            return undefined;
        const latest = DataService_1.dataService.getLatestMetrics(id);
        const activeAlerts = DataService_1.dataService.getAlerts({ serverId: id, status: 'active' }, 1, 1);
        return {
            ...server,
            password: undefined,
            privateKeyPassphrase: undefined,
            latestMetrics: { cpu: latest.cpu, memory: latest.memory, disk: latest.disk },
            activeAlertCount: activeAlerts.total,
        };
    }
}
exports.ServerConfigService = ServerConfigService;
exports.serverConfigService = new ServerConfigService();
