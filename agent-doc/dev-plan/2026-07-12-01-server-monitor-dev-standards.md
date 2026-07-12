<!-- 创建时间: 2026-07-12 11:30 -->
<!-- 最后修改: 2026-07-12 11:30 -->

# 开发规范文档

## 代码风格
- 遵循项目现有风格（TypeScript, 2 空格缩进, 单引号）
- 新增 IPC 通道命名遵循现有 `logs:xxx` 模式
- Mermaid 图表使用 `flowchart TD` 语法

## 安全规范
- 所有 SSH 命令中的 `filePath` 必须验证在 `server.logsPath` 前缀下（路径穿越防护）
- 使用 `exec` 而非 `eval` 执行命令
- 单实例锁不影响应用安全

## 测试规范
| 类型 | 覆盖范围 | 工具 |
|------|---------|------|
| 单元测试 | logs:tail 路径校验逻辑 | Vitest |
| 手动测试 | 单实例锁：双击快捷方式验证只开一个窗口 | 手动 |
| 手动测试 | 滚动加载更早日志：打开大文件，向上滚动 | 手动 |

## Git 提交规范
- commit 格式：`类型(范围): 描述`
- 本次提交：`feat(logs): 日志尾部浏览` + `feat(app): Electron 单实例锁`

## 文件修改清单
| 文件 | 变更类型 | 变更内容 |
|------|---------|---------|
| src/main/index.ts | 修改 | 添加 `requestSingleInstanceLock` |
| src/main/ipc/index.ts | 修改 | 新增 LOG_TAIL / LOG_TAIL_MORE 处理器 |
| src/shared/constants.ts | 修改 | 新增 IPC 通道常量 |
| src/shared/ipc-types.ts | 修改 | 新增参数类型 |
| src/preload/index.ts | 修改 | 暴露 logs.tail / logs.tailMore |
| src/renderer/pages/ServerDetailPage.tsx | 修改 | 尾部浏览交互逻辑 |
