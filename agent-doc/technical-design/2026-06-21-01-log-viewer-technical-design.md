# 技术设计文档：日志浏览优化

## 1. SSH_COMMAND_TIMEOUT 修复

### 根因分析
`src/shared/constants.ts:31` 中 `SSH_COMMAND_TIMEOUT = 5000`（5秒），当通过 `cat` 全量读取大日志文件时，SSH 传输时间超过5秒就会触发超时错误。

### 修改方案
将 `SSH_COMMAND_TIMEOUT` 从 5000 改为 30000（30秒）。

```typescript
// src/shared/constants.ts
export const SSH_COMMAND_TIMEOUT = 30000; // 5000 → 30000
```

### 同时：改用分片读取替代全量 cat
现有 LOG_READ 处理器已支持 `offset`/`length` 参数走 `dd+base64` 分片路径。前端改为始终传递 offset/length 参数，不再使用全量 cat 路径，从根本上避免大文件超时。

## 2. 文件列表：仅显示文件名 + 倒序排列

### 位置
`src/renderer/pages/ServerDetailPage.tsx`

### 修改内容
```typescript
// 提取并排序（在 handleOpenLogs 中）
const basenameList = (res.data as string[])
  .map(fp => ({ fullPath: fp, name: fp.replace(/\\/g, '/').split('/').pop() || fp }))
  .sort((a, b) => b.name.localeCompare(a.name)); // 倒序 Z→A

// List renderItem 显示 item.name
// handleReadLog 使用 item.fullPath
```

## 3. 拖拽分割面板

### 实现方式
原生 React + mouse 事件，不引入第三方库。

```typescript
// 状态
const [leftWidth, setLeftWidth] = useState(320);
const [isDragging, setIsDragging] = useState(false);

// 鼠标事件
const handleMouseDown = () => setIsDragging(true);

useEffect(() => {
  if (!isDragging) return;
  const handleMouseMove = (e: MouseEvent) => {
    const modalBody = /* 获取Modal内容区域 */;
    const rect = modalBody.getBoundingClientRect();
    const newWidth = Math.max(200, Math.min(e.clientX - rect.left, rect.width - 300));
    setLeftWidth(newWidth);
  };
  const handleMouseUp = () => setIsDragging(false);
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
  return () => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };
}, [isDragging]);
```

## 4. 分片滚动加载

### 状态设计
```typescript
const [logOffset, setLogOffset] = useState(0);
const [logContent, setLogContent] = useState('');
const [hasMore, setHasMore] = useState(true);
const [loading, setLoading] = useState(false);
const CHUNK_SIZE = 65536; // 64KB
```

### 加载流程
```typescript
const loadChunk = async (filePath: string, offset: number) => {
  setLoading(true);
  const res = await window.electronAPI.logs.read(id!, filePath, offset, CHUNK_SIZE);
  if (res.success) {
    const chunk = res.data as string;
    if (chunk.length < CHUNK_SIZE) setHasMore(false);
    setLogContent(prev => prev + chunk);
    setLogOffset(prev => prev + chunk.length); // 注意：实际字节数可能小于CHUNK_SIZE
  }
  setLoading(false);
};
```

### 滚动检测
```typescript
const handleContentScroll = (e: React.UIEvent<HTMLDivElement>) => {
  const el = e.currentTarget;
  if (el.scrollHeight - el.scrollTop - el.clientHeight < 100 && hasMore && !loading) {
    loadChunk(selectedFilePath, logOffset);
  }
};
```

### 兼容 JSON 格式化
首次加载时尝试 JSON.parse，若为 JSON 则格式化显示，后续分片按纯文本追加。
