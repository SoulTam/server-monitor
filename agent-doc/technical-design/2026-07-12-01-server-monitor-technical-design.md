<!-- 创建时间: 2026-07-12 11:30 -->
<!-- 最后修改: 2026-07-12 11:30 -->

# 技术设计文档 — 日志尾部浏览 & 单实例锁

## 日志尾部浏览

### SSH 命令设计

**读取末尾 N 行**（logs:tail）：
```bash
tail -n 500 /path/to/file
```

**加载更早 N 行**（logs:tailMore）：
需要获取 currentlyShownLines 行中第 1 行之前的 N 行。使用 `wc -l` 配合 `head` + `tail`：
```bash
wc -l < /path/to/file
```
假设文件共 T 行，当前已展示到第 L 行（从文件开头算），需要获取第 L-N 到 L 行的内容：
```bash
head -n $L /path/to/file | tail -n $N
```

### IPC 设计

**新增常量**（`src/shared/constants.ts`）：
```
LOG_TAIL = 'logs:tail'
LOG_TAIL_MORE = 'logs:tailMore'
```

**新增 IPC 类型**（`src/shared/ipc-types.ts`）：
```typescript
interface LogTailPayload {
  serverId: string;
  filePath: string;
  nLines?: number;
}

interface LogTailMorePayload {
  serverId: string;
  filePath: string;
  beforeLine: string;   // 当前展示的第一行内容（用于定位）
  nLines?: number;
}
```

### Preload 暴露 API
```typescript
logs: {
  list: ...,        // 已有
  read: ...,        // 已有
  tail: (serverId: string, filePath: string, nLines?: number): Promise<IpcResponse<string>> => ...,
  tailMore: (serverId: string, filePath: string, beforeLine: string, nLines?: number): Promise<IpcResponse<string>> => ...,
}
```

### 安全校验
与现有 `LOG_READ` 一致，校验 `filePath.startsWith(server.logsPath)`。

### 前端交互

**打开文件**：
```typescript
const handleReadLog = async (filePath: string) => {
  setLogContent('');
  setReadingFromEnd(true);  // 新状态：当前处于尾部浏览模式
  const res = await window.electronAPI.logs.tail(id!, filePath, TAIL_LINES);
  if (res.success) {
    setLogContent(res.data as string);
    // 自动滚动到底部
    nextTick(() => scrollToBottom());
  }
};
```

**向上滚动加载更早**（检测到滚动到顶部）：
```typescript
const handleContentScroll = () => {
  const el = logContentRef.current;
  if (!el) return;
  // 滚动到顶部时加载更早内容
  if (el.scrollTop < 100 && hasMoreRef.current && !loadingRef.current && readingFromEnd) {
    const firstLine = lines[0];
    loadEarlierChunk(firstLine);
  }
  // 保留原有搜索时的无限滚动逻辑
};
```

**加载更早内容后的展示**：
将新内容插入到现有内容之前，保持滚动位置在原有第一行处，不跳转。

### 增量追加（实时更新）
在尾部浏览模式下，启动一个定时器（如每 5s）：
1. 执行 `wc -c` 获取文件当前大小
2. 与上次读取的 offset 对比
3. 如果有新增，读取新增部分追加到内容末尾
4. 如果用户当前在底部，自动滚动跟随；否则只追加不滚动

## 单实例锁

### 实现位置
`src/main/index.ts`，在 `app.whenReady()` 之前。

### 实现代码
```typescript
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = getMainWindow();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });
}
```

### 影响范围
无其他模块影响。桌面快捷方式 / EXE 双击时，第二个进程直接退出，已有窗口弹出并聚焦。
