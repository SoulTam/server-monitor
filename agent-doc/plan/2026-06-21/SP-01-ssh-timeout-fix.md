# SP-01: SSH超时修复

## 基本信息
| 字段 | 值 |
|------|-----|
| 类型 | B |
| 技术栈 | Node.js |
| 对应蓝图章节 | ④ 技术设计Agent产出 — SSH超时修复 |
| 前置依赖 | 无 |

## 最终结果（从结果蓝图逐字拷贝）

### SSH超时修复
**根因分析**：`src/shared/constants.ts:31` 中 `SSH_COMMAND_TIMEOUT = 5000`（5秒），当通过 `cat` 全量读取大日志文件时，SSH 传输时间超过5秒就会触发超时错误。

**修改方案**：将 `SSH_COMMAND_TIMEOUT` 从 5000 改为 30000（30秒）。

### API完整定义（涉及部分）
| 方法 | 路径 | 功能 | 请求参数 | 响应格式 | 错误码 |
|------|------|------|---------|---------|--------|
| invoke | log:list | 列出远程日志文件 | { serverId: string } | { success, data: string[] } | SERVER_NOT_FOUND, LOGS_PATH_NOT_CONFIGURED, SSH_NOT_CONNECTED, SSH_COMMAND_TIMEOUT |
| invoke | log:read | 读取日志文件（支持分片） | { serverId, filePath, offset?, length? } | { success, data: string } | 同上 + ACCESS_DENIED |
## 验收标准
- constants.ts 中 SSH_COMMAND_TIMEOUT = 30000
- 读取大文件不再出现 SSH_COMMAND_TIMEOUT 错误

## 执行步骤
### Step 1: 修改超时常量
- 文件: `src/shared/constants.ts`
- 操作: 第31行 `SSH_COMMAND_TIMEOUT = 5000` → `SSH_COMMAND_TIMEOUT = 30000`

### Step 2: 验证
- 确认 `tsc --noEmit -p tsconfig.node.json` 通过
- 确认无其他位置引用该常量需要同步修改

## 执行产出物
| 预期产出 | 路径 |
|---------|------|
| 修改后的 constants.ts | src/shared/constants.ts |

## 核查Agent自动检查
| 结果 | 后续动作 |
|------|---------|
| ⏳ 待核查 | 执行后自动触发 |
