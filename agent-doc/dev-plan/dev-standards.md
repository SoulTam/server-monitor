# Server Monitor - 开发规范文档

## 1. 项目结构规范

### 1.1 目录结构

```
server-monitor/
├── src/
│   ├── main/                        # Electron主进程代码
│   │   ├── index.ts                 # 主进程入口
│   │   ├── ipc-handlers.ts          # IPC通道注册汇总
│   │   ├── services/                # 业务服务层
│   │   │   ├── ssh.service.ts       # SSH连接管理服务
│   │   │   ├── collector.service.ts # 数据采集服务
│   │   │   ├── alert.service.ts     # 报警检测服务
│   │   │   ├── server.service.ts    # 服务器配置CRUD服务
│   │   │   └── tray.service.ts      # 系统托盘服务
│   │   ├── database/                # SQLite数据库层
│   │   │   ├── index.ts             # 数据库初始化与连接
│   │   │   ├── migrations/          # 数据库迁移脚本
│   │   │   │   └── 001-init.ts      # 初始建表迁移
│   │   │   ├── server.repo.ts       # servers表操作
│   │   │   ├── metrics.repo.ts      # metrics表操作
│   │   │   └── alert.repo.ts        # alerts表操作
│   │   └── utils/                   # 工具函数
│   │       ├── crypto.ts            # AES-256加密/解密
│   │       ├── ssh-parser.ts        # SSH命令输出解析
│   │       └── logger.ts            # electron-log封装
│   ├── renderer/                    # React前端代码
│   │   ├── index.html               # HTML入口
│   │   ├── main.tsx                 # React应用入口
│   │   ├── App.tsx                  # 根组件与路由
│   │   ├── components/              # 通用组件
│   │   │   ├── ServerCard/          # 服务器卡片组件
│   │   │   │   ├── index.tsx
│   │   │   │   └── style.module.css
│   │   │   ├── MetricChart/         # 指标图表组件
│   │   │   │   ├── index.tsx
│   │   │   │   └── style.module.css
│   │   │   ├── AlertNotification/   # 报警弹窗组件
│   │   │   │   ├── index.tsx
│   │   │   │   └── style.module.css
│   │   │   ├── ServerForm/          # 服务器配置表单
│   │   │   │   ├── index.tsx
│   │   │   │   └── style.module.css
│   │   │   └── StatusIndicator/     # 状态指示灯
│   │   │       ├── index.tsx
│   │   │       └── style.module.css
│   │   ├── pages/                   # 页面组件
│   │   │   ├── ServerList/          # 服务器列表页
│   │   │   │   ├── index.tsx
│   │   │   │   └── style.module.css
│   │   │   ├── ServerDetail/        # 服务器详情页
│   │   │   │   ├── index.tsx
│   │   │   │   └── style.module.css
│   │   │   └── AlertHistory/        # 报警记录页
│   │   │       ├── index.tsx
│   │   │       └── style.module.css
│   │   ├── hooks/                   # 自定义hooks
│   │   │   ├── useIpc.ts            # IPC通信封装
│   │   │   ├── useServerList.ts     # 服务器列表数据
│   │   │   ├── useServerDetail.ts   # 服务器详情数据
│   │   │   ├── useMetrics.ts        # 监控指标数据
│   │   │   └── useAlerts.ts         # 报警数据
│   │   ├── stores/                  # 状态管理
│   │   │   ├── serverStore.ts       # 服务器状态
│   │   │   ├── monitorStore.ts      # 监控实时数据状态
│   │   │   └── alertStore.ts        # 报警状态
│   │   ├── types/                   # TypeScript类型定义
│   │   │   ├── server.ts            # 服务器相关类型
│   │   │   ├── metric.ts            # 指标相关类型
│   │   │   ├── alert.ts             # 报警相关类型
│   │   │   └── ipc.ts               # IPC通道类型
│   │   └── styles/                  # 全局样式
│   │       ├── global.css           # 全局基础样式
│   │       └── variables.css        # CSS变量（主题色等）
│   ├── shared/                      # 主进程与渲染进程共享
│   │   ├── types.ts                 # 共享TypeScript类型
│   │   ├── constants.ts             # 共享常量（IPC通道名等）
│   │   └── validators.ts            # 共享校验函数
│   └── preload/
│       └── index.ts                 # Electron preload脚本
├── resources/                       # 资源文件
│   ├── icon.ico                     # 应用图标
│   └── tray-icon.ico                # 托盘图标
├── tests/                           # 测试文件
│   ├── unit/                        # 单元测试
│   │   ├── main/
│   │   │   ├── services/
│   │   │   ├── database/
│   │   │   └── utils/
│   │   └── renderer/
│   │       ├── hooks/
│   │       └── components/
│   └── e2e/                         # 端到端测试
├── electron-builder.yml             # electron-builder打包配置
├── vite.config.ts                   # Vite配置
├── tsconfig.json                    # TypeScript配置
├── tsconfig.node.json               # Node端TypeScript配置
├── package.json                     # 项目配置
├── .eslintrc.cjs                    # ESLint配置
├── .prettierrc                      # Prettier配置
└── .gitignore                       # Git忽略配置
```

### 1.2 命名规范

| 类别 | 规范 | 示例 |
|------|------|------|
| 文件名（组件目录） | PascalCase，每个组件一个目录 | `ServerCard/index.tsx` |
| 文件名（组件文件） | PascalCase | `ServerCard/index.tsx` |
| 文件名（Service） | camelCase + `.service.ts` | `ssh.service.ts` |
| 文件名（Repository） | camelCase + `.repo.ts` | `server.repo.ts` |
| 文件名（Hook） | camelCase，以 `use` 开头 | `useIpc.ts` |
| 文件名（Store） | camelCase + `Store.ts` | `serverStore.ts` |
| 文件名（工具函数） | camelCase | `crypto.ts` |
| 文件名（类型定义） | camelCase | `server.ts` |
| 文件名（样式文件） | 与组件同名 + `.module.css` | `style.module.css` |
| 文件名（测试文件） | 与源文件同名 + `.test.ts` | `ssh.service.test.ts` |
| React组件名 | PascalCase | `ServerCard` |
| 变量名 | camelCase | `serverList` |
| 常量名 | UPPER_SNAKE_CASE | `DEFAULT_INTERVAL` |
| 函数名 | camelCase | `connectSsh` |
| 类名 | PascalCase | `SshService` |
| 接口名 | PascalCase，不加 `I` 前缀 | `ServerConfig` |
| 类型别名 | PascalCase | `MetricType` |
| Enum名 | PascalCase | `MonitorStatus` |
| Enum成员 | PascalCase | `MonitorStatus.Idle` |
| CSS Module类名 | camelCase | `.cardWrapper` |
| IPC通道名 | `模块:动作` 格式 | `server:create` |
| 事件名 | `模块:事件` 格式 | `monitor:metrics` |

### 1.3 代码风格

**ESLint配置要点** (`.eslintrc.cjs`)：

```js
module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  rules: {
    'react/react-in-jsx-scope': 'off',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/explicit-function-return-type': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-console': 'warn',
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
};
```

**Prettier配置** (`.prettierrc`)：

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "endOfLine": "auto",
  "bracketSpacing": true,
  "arrowParens": "always"
}
```

---

## 2. 开发环境

### 2.1 环境要求

| 工具 | 版本要求 | 说明 |
|------|---------|------|
| Node.js | >= 18.0.0 | 推荐使用LTS版本 18.x 或 20.x |
| npm | >= 9.0.0 | 随Node.js安装 |
| Git | >= 2.30 | 版本控制 |
| Windows | >= 10 | 开发与目标运行平台 |
| Visual Studio Build Tools | 2022 | 编译better-sqlite3原生模块所需 |

### 2.2 依赖安装

```bash
npm install
```

如遇better-sqlite3编译失败，需确认已安装Visual Studio Build Tools的C++桌面开发工作负载，然后重新执行：

```bash
npm rebuild better-sqlite3
```

### 2.3 开发模式启动

```bash
npm run dev
```

此命令同时启动Vite开发服务器和Electron主进程，支持热更新。

### 2.4 构建与打包

```bash
npm run build           # 构建生产版本（编译TypeScript + 打包前端）
npm run package         # 构建并打包为Windows安装包（exe）
npm run package:portable # 打包为免安装便携版
```

### 2.5 调试方法

**渲染进程调试**：应用运行时按 `Ctrl+Shift+I` 打开DevTools。

**主进程调试**：在VS Code中使用以下launch配置：

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Main Process",
      "type": "node",
      "request": "launch",
      "cwd": "${workspaceFolder}",
      "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron",
      "runtimeArgs": ["."],
      "env": {
        "ELECTRON_DISABLE_SECURITY_WARNINGS": "true"
      },
      "console": "integratedTerminal",
      "sourceMaps": true,
      "outFiles": ["${workspaceFolder}/dist/main/**/*.js"]
    }
  ]
}
```

**日志查看**：主进程日志通过electron-log输出到以下位置：

- 控制台：开发模式下直接输出
- 日志文件：`%USERPROFILE%\AppData\Roaming\server-monitor\logs\main.log`

---

## 3. 编码规范

### 3.1 前端编码规范

#### 3.1.1 React组件规范

组件采用函数式组件 + Hooks，禁止使用class组件：

```tsx
import React from 'react';
import type { ServerConfig } from '@shared/types';

interface ServerCardProps {
  server: ServerConfig;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
}

const ServerCard: React.FC<ServerCardProps> = ({ server, onStart, onStop }) => {
  return (
    <div className={styles.cardWrapper}>
      {}
    </div>
  );
};

export default ServerCard;
```

规范要点：

- 每个组件一个独立目录，包含 `index.tsx` 和 `style.module.css`
- 组件必须有明确的 `Props` 类型定义，使用 `interface` 声明并命名为 `ComponentNameProps`
- 组件使用 `React.FC` 类型，且必须显式声明泛型参数
- 组件内部逻辑复杂时（超过3个state或超过50行），拆分为自定义Hook
- 组件导出统一使用 `export default`，文件顶部不做命名导出
- 列表渲染必须使用 `key` 属性，优先使用业务ID而非数组索引
- 条件渲染使用三元表达式或逻辑与运算符，复杂条件提取为变量

#### 3.1.2 Hook使用规范

```tsx
import { useState, useEffect, useCallback, useRef } from 'react';

const useServerList = () => {
  const [servers, setServers] = useState<ServerConfig[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const refreshRef = useRef<ReturnType<typeof setTimeout>>();

  const fetchServers = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI.invoke('server:list', {});
      setServers(result);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServers();
    return () => {
      if (refreshRef.current) clearTimeout(refreshRef.current);
    };
  }, [fetchServers]);

  return { servers, loading, refresh: fetchServers };
};

export default useServerList;
```

规范要点：

- 自定义Hook文件放置于 `src/renderer/hooks/` 目录，以 `use` 开头命名
- Hook返回值使用对象解构形式（非数组），便于调用方按需取值
- `useEffect` 必须声明依赖数组，不允许省略
- `useEffect` 内的异步操作必须定义内部async函数后调用，不可直接将回调标记为async
- `useCallback` 包裹传递给子组件的回调函数，声明正确的依赖
- 使用 `useRef` 存储不需要触发重渲染的可变值（如定时器ID、SSH连接实例）
- 组件卸载时必须清理副作用（定时器、事件监听、IPC监听）

#### 3.1.3 状态管理规范

使用Zustand作为状态管理库：

```tsx
import { create } from 'zustand';
import type { ServerConfig, MonitorStatus } from '@shared/types';

interface ServerState {
  servers: ServerConfig[];
  statuses: Record<string, MonitorStatus>;
  setServers: (servers: ServerConfig[]) => void;
  updateStatus: (id: string, status: MonitorStatus) => void;
}

const useServerStore = create<ServerState>((set) => ({
  servers: [],
  statuses: {},
  setServers: (servers) => set({ servers }),
  updateStatus: (id, status) =>
    set((state) => ({
      statuses: { ...state.statuses, [id]: status },
    })),
}));

export default useServerStore;
```

规范要点：

- 每个业务领域一个Store文件，放置于 `src/renderer/stores/`
- Store命名格式：`use{Name}Store`
- Store内状态和操作必须定义TypeScript接口
- 禁止在Store外部直接修改Store内部状态
- 异步操作放在组件或Hook中调用，Store只负责同步状态更新

#### 3.1.4 样式规范

使用CSS Modules + Ant Design 5组件库：

```css
.cardWrapper {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 16px;
  transition: box-shadow 0.3s ease;
}

.cardWrapper:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.statusOnline {
  color: var(--success-color);
}

.statusOffline {
  color: var(--error-color);
}
```

规范要点：

- 使用CSS Modules，文件命名为 `style.module.css`
- 类名使用camelCase，与组件内引用方式一致
- 颜色、间距、字号等使用CSS变量，定义在 `src/renderer/styles/variables.css`
- 禁止使用内联style属性（动态计算的样式除外）
- Ant Design组件的主题定制使用ConfigProvider，不覆盖组件内部CSS
- 响应式布局使用CSS Grid或Flexbox，卡片区域使用 `grid-template-columns: repeat(auto-fill, minmax(360px, 1fr))`

#### 3.1.5 TypeScript类型规范

```tsx
type MetricType = 'cpu' | 'memory' | 'disk' | 'network';

type MonitorStatus = 'idle' | 'monitoring' | 'error';

interface ServerConfig {
  id: string;
  name: string;
  ip: string;
  port: number;
  username: string;
  authType: 'password' | 'key';
  passwordEncrypted?: string;
  privateKeyPath?: string;
  monitorInterval: number;
  monitorItems: MetricType[];
  thresholds: {
    cpu: number;
    memory: number;
    disk: number;
    network: number;
  };
}

interface IpcResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

type TimeRange = '1h' | '6h' | '24h' | '7d';
```

规范要点：

- 共享类型放置于 `src/shared/types.ts`，渲染进程和主进程均可引用
- 仅渲染进程使用的类型放置于 `src/renderer/types/`
- 联合类型使用 `type` 定义，对象结构使用 `interface` 定义
- 禁止使用 `any`，确需宽泛类型时使用 `unknown` 并做类型守卫
- 所有函数参数和返回值必须有类型注解
- IPC通信的请求和响应必须定义对应的类型
- 枚举使用 `enum` 关键字定义时成员值必须为字符串字面量；简单联合类型优先使用 `type`
- 可选属性使用 `?` 标记，并在使用处做null检查

### 3.2 主进程编码规范

#### 3.2.1 Service类规范

```ts
import type { ServerConfig } from '../../shared/types';

class SshService {
  private connections: Map<string, ssh2.Client>;

  constructor() {
    this.connections = new Map();
  }

  async connect(config: ServerConfig): Promise<void> {
    const client = new ssh2.Client();
    return new Promise((resolve, reject) => {
      client.on('ready', () => {
        this.connections.set(config.id, client);
        resolve();
      });
      client.on('error', (err) => {
        reject(err);
      });
      client.connect({
        host: config.ip,
        port: config.port,
        username: config.username,
        password: config.authType === 'password' ? decrypt(config.passwordEncrypted!) : undefined,
        privateKey: config.authType === 'key' ? fs.readFileSync(config.privateKeyPath!) : undefined,
        readyTimeout: 10000,
      });
    });
  }

  disconnect(serverId: string): void {
    const client = this.connections.get(serverId);
    if (client) {
      client.end();
      this.connections.delete(serverId);
    }
  }

  isConnected(serverId: string): boolean {
    return this.connections.has(serverId);
  }

  executeCommand(serverId: string, command: string): Promise<string> {
    const client = this.connections.get(serverId);
    if (!client) {
      throw new Error(`SSH connection not found for server: ${serverId}`);
    }
    return new Promise((resolve, reject) => {
      client.exec(command, (err, stream) => {
        if (err) return reject(err);
        let output = '';
        stream.on('data', (data: Buffer) => {
          output += data.toString();
        });
        stream.on('close', () => {
          resolve(output.trim());
        });
        stream.stderr.on('data', (data: Buffer) => {
          logger.warn(`SSH stderr for ${serverId}: ${data.toString()}`);
        });
      });
    });
  }

  disconnectAll(): void {
    for (const [id, client] of this.connections) {
      client.end();
      this.connections.delete(id);
    }
  }
}

export default SshService;
```

规范要点：

- 每个Service对应一个业务领域，文件放置于 `src/main/services/`
- Service使用class定义，通过constructor注入依赖
- Service实例在主进程入口创建，作为单例使用
- 内部状态使用 `private` 修饰符
- 异步操作返回 `Promise`，禁止使用回调形式
- 必须实现资源清理方法（如 `disconnectAll`），在应用退出时调用
- 错误通过 `throw new Error()` 抛出，由IPC handler捕获并返回错误响应
- 日志使用封装的logger，禁止直接使用 `console.log`

#### 3.2.2 IPC Handler规范

```ts
import { ipcMain } from 'electron';
import type { IpcResponse } from '../../shared/types';

const registerServerHandlers = (
  serverService: ServerService,
  sshService: SshService,
) => {
  ipcMain.handle('server:create', async (_event, params): Promise<IpcResponse> => {
    try {
      const server = await serverService.create(params);
      return { success: true, data: server };
    } catch (error) {
      logger.error('Failed to create server', error);
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('server:list', async (_event, _params): Promise<IpcResponse> => {
    try {
      const servers = await serverService.findAll();
      return { success: true, data: servers };
    } catch (error) {
      logger.error('Failed to list servers', error);
      return { success: false, error: (error as Error).message };
    }
  });
};

export default registerServerHandlers;
```

规范要点：

- IPC通道名定义在 `src/shared/constants.ts`，禁止硬编码字符串
- 渲染进程→主进程通信使用 `ipcMain.handle` / `ipcRenderer.invoke`（请求-响应模式）
- 主进程→渲染进程推送使用 `BrowserWindow.webContents.send`（单向推送模式）
- 所有handler必须使用try-catch包裹，返回统一的 `IpcResponse` 格式
- `_event` 参数使用下划线前缀标记未使用
- handler中不做业务逻辑，只做参数校验、调用Service、返回结果
- 每个模块的handler注册函数在 `ipc-handlers.ts` 中统一调用

#### 3.2.3 数据库操作规范

```ts
import Database from 'better-sqlite3';
import type { ServerConfig } from '../../shared/types';

class ServerRepo {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  create(server: Omit<ServerConfig, 'id' | 'createdAt' | 'updatedAt'>): ServerConfig {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO servers (id, name, ip, port, username, auth_type, password_encrypted,
        private_key_path, monitor_interval, monitor_items, cpu_threshold,
        memory_threshold, disk_threshold, network_threshold, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id, server.name, server.ip, server.port, server.username, server.authType,
      server.passwordEncrypted ?? null, server.privateKeyPath ?? null,
      server.monitorInterval, JSON.stringify(server.monitorItems),
      server.thresholds.cpu, server.thresholds.memory,
      server.thresholds.disk, server.thresholds.network,
      'idle', now, now,
    );
    return this.findById(id)!;
  }

  findById(id: string): ServerConfig | null {
    const stmt = this.db.prepare('SELECT * FROM servers WHERE id = ?');
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    return row ? this.mapRow(row) : null;
  }

  findAll(): ServerConfig[] {
    const stmt = this.db.prepare('SELECT * FROM servers ORDER BY created_at DESC');
    const rows = stmt.all() as Record<string, unknown>[];
    return rows.map(this.mapRow);
  }

  private mapRow(row: Record<string, unknown>): ServerConfig {
    return {
      id: row.id as string,
      name: row.name as string,
      {}
    };
  }
}

export default ServerRepo;
```

规范要点：

- 每个表对应一个Repo类，文件放置于 `src/main/database/`
- 数据库连接在 `src/main/database/index.ts` 中初始化，通过依赖注入传递给Repo
- 所有SQL语句使用参数化查询（`?` 占位符），禁止字符串拼接SQL
- better-sqlite3的同步API即可满足需求，不需要异步封装
- 写操作使用 `prepare().run()`，读操作使用 `prepare().get()` 或 `prepare().all()`
- 批量写操作使用 `db.transaction()` 包裹
- 数据库行到领域对象的映射统一在Repo内完成，外部不接触原始行数据
- 数据库迁移脚本放置于 `src/main/database/migrations/`，按序号命名

### 3.3 安全编码规范

#### 3.3.1 密码加密

```ts
import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;

const getEncryptionKey = (): Buffer => {
  const keyPath = path.join(app.getPath('userData'), '.enc-key');
  if (fs.existsSync(keyPath)) {
    return Buffer.from(fs.readFileSync(keyPath, 'utf-8'), 'hex');
  }
  const key = crypto.randomBytes(KEY_LENGTH);
  fs.writeFileSync(keyPath, key.toString('hex'), { mode: 0o600 });
  return key;
};

const encrypt = (plaintext: string): string => {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf-8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
};

const decrypt = (encryptedText: string): string => {
  const key = getEncryptionKey();
  const [ivHex, encrypted] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf-8');
  decrypted += decipher.final('utf-8');
  return decrypted;
};
```

规范要点：

- SSH密码使用AES-256-CBC加密后存入数据库
- 加密密钥在应用首次启动时生成，存储在用户数据目录
- 密钥文件权限设置为仅当前用户可读（Windows通过ACL限制）
- 加密结果格式为 `IV:密文`，每次加密使用随机IV
- 内存中密码使用后立即清除（变量置空），避免长期驻留
- 禁止在日志中输出密码或加密密钥

#### 3.3.2 SSH连接管理

```ts
const SSH_CONFIG = {
  readyTimeout: 10000,
  keepaliveInterval: 10000,
  keepaliveCountMax: 3,
  algorithms: {
    kex: ['ecdh-sha2-nistp256', 'ecdh-sha2-nistp384', 'diffie-hellman-group-exchange-sha256'],
    cipher: ['aes256-gcm@openssh.com', 'aes256-ctr'],
    hmac: ['hmac-sha2-256', 'hmac-sha2-512'],
  },
};
```

规范要点：

- SSH连接超时设置为10秒（`readyTimeout: 10000`）
- 启用keepalive机制防止空闲连接断开
- 限制加密算法为安全级别较高的选项
- 应用退出时必须断开所有SSH连接（`app.on('before-quit')` 中调用 `disconnectAll`）
- 连接断开后自动重试最多3次，间隔5秒
- 禁止将SSH连接对象通过IPC传递到渲染进程

#### 3.3.3 输入校验

渲染进程端校验：

```ts
const validateServerConfig = (config: unknown): config is CreateServerParams => {
  if (typeof config !== 'object' || config === null) return false;
  const c = config as Record<string, unknown>;
  if (typeof c.name !== 'string' || c.name.length === 0 || c.name.length > 50) return false;
  if (typeof c.ip !== 'string' || !/^(\d{1,3}\.){3}\d{1,3}$/.test(c.ip)) return false;
  if (typeof c.port !== 'number' || c.port < 1 || c.port > 65535) return false;
  if (typeof c.username !== 'string' || c.username.length === 0 || c.username.length > 50) return false;
  if (!['password', 'key'].includes(c.authType as string)) return false;
  if (typeof c.monitorInterval !== 'number' || c.monitorInterval < 5) return false;
  return true;
};
```

主进程端校验：

- 主进程接收IPC请求时必须重新校验参数，不信任渲染进程传来的数据
- IP地址校验IPv4格式
- 端口范围校验1-65535
- 监控周期最小5秒
- 阈值范围校验：CPU/内存/磁盘 0-100，网络为正整数
- SSH命令参数禁止包含用户直接输入的内容，只允许执行预定义的命令模板

---

## 4. Git规范

### 4.1 分支策略

| 分支 | 命名格式 | 用途 | 生命周期 |
|------|---------|------|---------|
| main | `main` | 生产发布分支，始终保持可发布状态 | 永久 |
| develop | `develop` | 开发集成分支，最新开发成果 | 永久 |
| feature | `feature/<模块>-<简述>` | 新功能开发 | 合并后删除 |
| fix | `fix/<模块>-<简述>` | 缺陷修复 | 合并后删除 |

分支流转规则：

- `feature` / `fix` 分支从 `develop` 创建，完成后通过PR合并回 `develop`
- `develop` 积累足够功能后，合并到 `main` 并打版本标签
- 禁止直接向 `main` 提交代码，必须通过PR
- `feature` 分支命名示例：`feature/server-config-form`、`feature/ssh-connection`
- `fix` 分支命名示例：`fix/alert-duplicate-check`、`fix/ssh-reconnect`

### 4.2 提交消息规范

采用Conventional Commits格式：

```
type(scope): description

[optional body]
```

**type取值**：

| type | 含义 |
|------|------|
| feat | 新功能 |
| fix | 缺陷修复 |
| docs | 文档变更 |
| style | 代码格式调整（不影响逻辑） |
| refactor | 重构（非新功能非修复） |
| perf | 性能优化 |
| test | 测试相关 |
| chore | 构建/工具/依赖变更 |

**scope取值**：

| scope | 对应模块 |
|-------|---------|
| main | 主进程代码 |
| renderer | 渲染进程代码 |
| shared | 共享代码 |
| db | 数据库相关 |
| ssh | SSH连接相关 |
| alert | 报警相关 |
| monitor | 监控采集相关 |
| ui | 界面相关 |
| build | 构建/打包相关 |

**提交消息示例**：

```
feat(ssh): 实现SSH连接与命令执行服务
fix(alert): 修复同一指标重复创建报警的问题
refactor(db): 将数据库操作重构为Repository模式
chore(build): 配置electron-builder打包参数
```

规范要点：

- description使用中文，简明扼要，不超过50字符
- 禁止提交无意义的消息（如 `update`、`fix bug`、`wip`）
- 一个提交只做一件事，避免混合多个不相关的变更
- 代码格式化单独提交，不与功能变更混在一起

### 4.3 禁止提交的内容

`.gitignore` 必须包含以下条目：

```gitignore
node_modules/
dist/
out/
release/
.env
.env.*
*.log
*.sqlite
*.sqlite-journal
.enc-key
.DS_Store
Thumbs.db
```

额外注意事项：

- 禁止提交用户数据文件（SQLite数据库、加密密钥）
- 禁止提交包含真实密码或密钥的配置文件
- 禁止提交IDE配置目录（`.vscode/`、`.idea/`），但允许提交共享的launch.json
- 禁止提交打包输出目录（`out/`、`release/`）

---

## 5. 测试规范

### 5.1 测试工具选型

| 工具 | 用途 |
|------|------|
| Vitest | 单元测试运行器 |
| @testing-library/react | React组件测试 |
| happy-dom | 组件测试的DOM环境 |
| better-sqlite3（内存模式） | 数据库层测试 |

### 5.2 测试覆盖率要求

| 模块 | 行覆盖率要求 | 分支覆盖率要求 |
|------|-------------|---------------|
| src/main/utils/ | >= 90% | >= 80% |
| src/main/database/ | >= 80% | >= 70% |
| src/main/services/ | >= 70% | >= 60% |
| src/renderer/hooks/ | >= 80% | >= 70% |
| src/renderer/components/ | >= 60% | >= 50% |
| 整体 | >= 70% | >= 60% |

Vitest覆盖率配置：

```ts
// vite.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/main/database/migrations/**'],
    },
  },
});
```

### 5.3 测试文件命名规范

| 规范 | 示例 |
|------|------|
| 单元测试文件 | `ssh.service.test.ts` |
| 组件测试文件 | `ServerCard.test.tsx` |
| Hook测试文件 | `useServerList.test.ts` |
| 工具函数测试文件 | `crypto.test.ts` |
| 测试辅助文件 | `helpers.ts`、`fixtures.ts` |

### 5.4 测试目录结构

```
tests/
├── unit/
│   ├── main/
│   │   ├── services/
│   │   │   ├── ssh.service.test.ts
│   │   │   ├── collector.service.test.ts
│   │   │   ├── alert.service.test.ts
│   │   │   └── server.service.test.ts
│   │   ├── database/
│   │   │   ├── server.repo.test.ts
│   │   │   ├── metrics.repo.test.ts
│   │   │   └── alert.repo.test.ts
│   │   └── utils/
│   │       ├── crypto.test.ts
│   │       ├── ssh-parser.test.ts
│   │       └── logger.test.ts
│   └── renderer/
│       ├── hooks/
│       │   ├── useIpc.test.ts
│       │   ├── useServerList.test.ts
│       │   └── useMetrics.test.ts
│       └── components/
│           ├── ServerCard.test.tsx
│           ├── MetricChart.test.tsx
│           └── AlertNotification.test.tsx
├── e2e/
│   └── app.launch.test.ts
├── helpers/
│   ├── mock-ssh.ts
│   ├── mock-database.ts
│   └── fixtures.ts
└── vitest.config.ts
```

### 5.5 测试编写规范

**Service层测试示例**：

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SshService from '../../../src/main/services/ssh.service';

describe('SshService', () => {
  let sshService: SshService;

  beforeEach(() => {
    sshService = new SshService();
  });

  it('should connect to server successfully', async () => {
    const config = createMockServerConfig();
    await expect(sshService.connect(config)).resolves.toBeUndefined();
    expect(sshService.isConnected(config.id)).toBe(true);
  });

  it('should disconnect and remove connection', () => {
    const config = createMockServerConfig();
    await sshService.connect(config);
    sshService.disconnect(config.id);
    expect(sshService.isConnected(config.id)).toBe(false);
  });
});
```

**Repository层测试示例**（使用内存数据库）：

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import ServerRepo from '../../../src/main/database/server.repo';
import { runMigrations } from '../../../src/main/database';

describe('ServerRepo', () => {
  let db: Database.Database;
  let repo: ServerRepo;

  beforeEach(() => {
    db = new Database(':memory:');
    runMigrations(db);
    repo = new ServerRepo(db);
  });

  it('should create and find server by id', () => {
    const server = repo.create(createMockServerInput());
    const found = repo.findById(server.id);
    expect(found).not.toBeNull();
    expect(found!.name).toBe(server.name);
  });
});
```

规范要点：

- 测试文件顶部import `describe`、`it`、`expect`、`vi` 等，不从全局获取
- 每个测试用例只验证一个行为
- Mock外部依赖（SSH连接、文件系统），不依赖真实远程服务器
- 数据库测试使用 `:memory:` 模式，每个测试用例前重新初始化
- 组件测试使用 `@testing-library/react` 的 `render` 和 `screen`，不测试内部实现细节
- 测试辅助函数放置于 `tests/helpers/` 目录
- 运行测试命令：`npm run test`
- 运行覆盖率命令：`npm run test:coverage`
- 提交前必须确保所有测试通过：`npm run test -- --run`
