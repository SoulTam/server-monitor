# Server Monitor

一款本地 Windows 桌面应用，通过 SSH 远程监控 Linux 服务器的 CPU、内存、磁盘和网络指标，支持阈值报警、趋势图表和日志浏览。

## 功能特性

- **实时监控** — SSH 连接远程服务器，周期性采集 CPU、内存、磁盘、网络四项核心指标
- **趋势图表** — 服务器详情页展示 1小时/6小时/24小时/7天 的历史趋势折线图
- **阈值报警** — 自定义每项指标的报警阈值，超阈值时应用内弹窗通知，支持自动恢复
- **多服务器管理** — 卡片式布局展示所有服务器，支持搜索过滤、添加/编辑/删除
- **日志浏览** — 配置远程日志目录路径后，可在线浏览和读取日志文件，JSON 内容自动格式化
- **系统托盘** — 关闭窗口最小化到托盘，后台持续监控
- **密码加密** — SSH 密码使用 AES-256-CBC 加密存储

## 技术栈

| 类别 | 技术 |
|------|------|
| 前端框架 | React 18 + TypeScript |
| 构建工具 | Vite 5 |
| 桌面框架 | Electron 32 |
| UI 组件库 | Ant Design 5 |
| 图表库 | Recharts 2 |
| 状态管理 | Zustand |
| 数据库 | SQLite (better-sqlite3) |
| SSH 连接 | ssh2 |
| 打包 | electron-builder |

## 环境要求

- Node.js >= 18.0.0
- npm >= 9.0.0
- Windows 10+
- Visual Studio Build Tools 2022（编译 better-sqlite3 原生模块时需要）

## 快速开始

```bash
# 克隆项目
git clone <repo-url>
cd server-monitor

# 安装依赖
npm install

# 启动开发模式（Vite HMR + Electron 窗口）
npm run dev:electron
```

开发模式下，Vite 开发服务器启动后会自动打开 Electron 窗口，渲染进程支持热更新。

## 构建打包

```bash
# 构建生产版本
npm run build

# 打包为 Windows 安装包（NSIS）
npm run package

# 打包为免安装便携版
npm run package:portable
```

构建产物位于 `dist/` 目录，安装包位于 `out/` 目录。

## 项目结构

```
server-monitor/
├── src/
│   ├── main/                    # Electron 主进程
│   │   ├── index.ts             # 应用入口、窗口创建、IPC 注册
│   │   ├── database/
│   │   │   ├── index.ts         # SQLite 数据库初始化与迁移
│   │   │   └── DataService.ts   # 数据访问层
│   │   ├── ipc/
│   │   │   └── index.ts         # IPC 通道注册
│   │   ├── services/
│   │   │   ├── ServerConfigService.ts  # 服务器配置 CRUD
│   │   │   ├── SshService.ts           # SSH 连接管理
│   │   │   ├── CollectService.ts       # 指标采集（CPU/内存/磁盘/网络）
│   │   │   ├── AlertService.ts         # 阈值报警检测
│   │   │   └── TrayService.ts          # 系统托盘
│   │   ├── jobs/
│   │   │   └── DataCleanupJob.ts       # 定时数据清理
│   │   └── utils/
│   │       ├── crypto.ts        # AES-256 加密/解密
│   │       └── logger.ts        # 日志配置
│   ├── preload/
│   │   └── index.ts             # contextBridge 暴露 IPC API
│   ├── renderer/                # React 渲染进程
│   │   ├── App.tsx              # 根组件与路由
│   │   ├── main.tsx             # 渲染进程入口
│   │   ├── components/
│   │   │   ├── Layout.tsx       # 应用布局（标题栏 + 内容区 + 状态栏）
│   │   │   ├── TitleBar.tsx     # 自定义标题栏与导航
│   │   │   ├── StatusBar.tsx    # 底部状态栏
│   │   │   ├── ServerCard.tsx   # 服务器卡片
│   │   │   ├── ServerFormModal.tsx  # 服务器添加/编辑表单
│   │   │   ├── RealtimeBar.tsx  # 实时指标条
│   │   │   ├── TrendChart.tsx   # 趋势图表
│   │   │   ├── MiniChart.tsx    # 迷你趋势图
│   │   │   ├── AlertPopup.tsx   # 报警弹窗
│   │   │   └── AlertFilter.tsx  # 报警筛选栏
│   │   ├── pages/
│   │   │   ├── ServerListPage.tsx     # 服务器列表页
│   │   │   ├── ServerDetailPage.tsx   # 服务器详情页
│   │   │   └── AlertRecordsPage.tsx   # 报警记录页
│   │   ├── stores/
│   │   │   ├── serverStore.ts   # 服务器列表状态
│   │   │   ├── monitorStore.ts  # 实时监控数据
│   │   │   └── alertStore.ts    # 报警状态
│   │   └── styles/
│   │       └── global.css       # 全局样式
│   └── shared/                  # 主进程与渲染进程共享
│       ├── types.ts             # 通用类型定义
│       ├── ipc-types.ts         # IPC 输入/输出类型
│       └── constants.ts         # IPC 通道常量
├── tests/                       # 单元测试
├── dist/                        # 构建输出
├── out/                         # 打包输出
└── resources/                   # 静态资源（图标等）
```

## 使用说明

### 添加服务器

1. 点击首页工具栏的 **+ 添加服务器** 按钮
2. 填写服务器名称、IP 地址、SSH 端口、用户名
3. 选择认证方式（密码或私钥），填写对应凭据
4. 配置监控周期（最小 5 秒）和监控指标
5. 设置各项指标的报警阈值
6. 点击确认完成添加

### 启动监控

在服务器卡片上点击 **启动监控** 按钮，应用将建立 SSH 连接并按配置周期采集指标。卡片上实时显示 CPU、内存、磁盘、网络的最新数值和迷你趋势图。

### 查看详情

点击服务器卡片进入详情页，可查看：
- 实时指标条（四项指标当前值）
- 系统信息（主机名、OS、CPU 型号等）
- 历史趋势图表（切换 1h/6h/24h/7d 时间范围）
- 日志浏览（需先配置日志目录路径）

### 报警通知

当指标超过设定的阈值时：
1. 应用内弹出报警通知弹窗
2. 指标回落到阈值以下时自动恢复
3. 可在报警记录页查看所有历史报警

### 日志配置与浏览

1. 在服务器详情页，点击 **配置日志** 按钮
2. 输入远程服务器上的日志目录路径（如 `/var/log/myapp`）
3. 保存后按钮变为 **浏览日志**
4. 点击后左侧显示目录下的文件列表，右侧显示文件内容
5. JSON 格式日志自动缩进格式化显示
6. 浏览日志时也可随时点击 **修改路径** 重新配置

## 开发命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 仅启动 Vite 开发服务器 |
| `npm run dev:electron` | 启动 Vite + Electron 完整开发模式 |
| `npm run build` | 构建生产版本 |
| `npm run package` | 构建并打包为 NSIS 安装包 |
| `npm run package:portable` | 构建并打包为便携版 |
| `npm run test` | 运行单元测试 |
| `npm run test:coverage` | 运行测试并生成覆盖率报告 |
| `npm run lint` | 代码规范检查 |
| `npm run format` | 代码格式化 |
| `npm run build:main` | 仅编译主进程 |
| `npm run build:renderer` | 仅构建渲染进程 |

## 打包部署

### 安装包构建

```bash
npm run package
```

执行后 `out/` 目录下生成 `server-monitor Setup x.x.x.exe` 安装包。用户双击安装包即可完成安装，应用自动注册到开始菜单和桌面快捷方式。

### 便携版构建

```bash
npm run package:portable
```

生成免安装的 `server-monitor x.x.x.exe`，直接运行即可使用，所有数据保存在 `%APPDATA%/server-monitor/` 目录。

### 数据存储位置

| 数据类型 | 存储路径 |
|---------|---------|
| SQLite 数据库 | `%APPDATA%/server-monitor/server-monitor.db` |
| AES 加密密钥 | `%APPDATA%/server-monitor/key.bin` |
| 应用日志 | `%APPDATA%/server-monitor/logs/` |

## 许可证

MIT
