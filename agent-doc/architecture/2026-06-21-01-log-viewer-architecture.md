# 架构设计文档：日志浏览优化

## 1. 修改概述

本次修改不改变整体系统架构，仅在现有日志浏览功能基础上进行4项优化：
- SSH_COMMAND_TIMEOUT 超时值调整
- 文件列表显示文件名(Basename) + 倒序排列
- 左右面板拖拽分割
- 日志文件分片滚动加载

## 2. 受影响模块

| 模块 | 修改类型 | 说明 |
|------|---------|------|
| src/shared/constants.ts | 常量修改 | SSH_COMMAND_TIMEOUT 5000→30000 |
| src/main/ipc/index.ts | 逻辑优化 | LOG_READ 分片加载使用dd+base64路径 |
| src/renderer/pages/ServerDetailPage.tsx | UI重写 | 日志浏览Modal全面改造 |
| src/main/services/SshService.ts | 无修改 | 复用现有executeCommand |

## 3. 数据流（分片加载）

```
用户滚动到底部
  → 前端检测 scrollTop + scrollHeight ≈ clientHeight
  → 调用 window.electronAPI.logs.read(serverId, filePath, offset, 65536)
  → IPC invoke log:read
  → 主机构造 dd if=filePath bs=1 skip=offset count=65536 2>/dev/null | base64
  → SSH executeCommand 返回 base64
  → IPC Handler base64解码后返回字符串
  → 前端追加到已显示内容末尾
```

## 4. 分割面板布局

使用 flex 布局 + 原生 mouse 事件实现拖拽：

```
Modal (flex container)
├── 左侧面板 (width: 动态)
│   └── 文件列表 (List, 仅显示 basename)
├── 拖拽分割条 (8px, cursor: col-resize, onMouseDown)
└── 右侧面板 (flex: 1)
    └── 文件内容 (pre-wrap, 滚动事件监听)
```
