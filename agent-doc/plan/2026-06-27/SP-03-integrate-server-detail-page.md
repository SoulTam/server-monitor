<!-- 创建时间: 2026-06-27 09:40 -->
<!-- 最后修改: 2026-06-27 09:40 -->

# SP-03 — 集成：`ServerDetailPage` 接入嵌套 JSON 渲染 + 全链路验收

## 0. 前置依赖

SP-02（组件）

## 1. 唯一职责

在 `src/renderer/pages/ServerDetailPage.tsx` 中：

- 引入 `LogLineRenderer`；将现有"日志内容区"渲染切换到 LogLineRenderer
- 引入新 state `expandedNestedKeys: Set<string>`
- 全局键盘 Esc → 清空 expandedNestedKeys
- 不影响搜索高亮、分片加载、文件列表、日志路径配置等现有功能

> 必须**仅修改** `ServerDetailPage.tsx`；不动 utils、components、store、main、preload、shared。

## 2. 结果定义（逐字拷贝自结果蓝图 §① / §② / §③ / §④ 与本 SP 负责部分）

### 2.1 状态变化

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `expandedNestedKeys` | `Set<string>` | `new Set()` | 形态 `L:K`；切换由 LogLineRenderer.onToggle 返回值 + 父 current `expanded` props 协调 |

### 2.2 集成点（替换/新增）

**替换**：当前日志内容区：
```jsx
<div ref={logContentRef} ...>
  {!logContent && <span>选择文件以查看内容</span>}
  {logContent && !debouncedSearch && logContent}
  {logContent && debouncedSearch && (<span dangerouslySetInnerHTML={...} />)}
  {loading && ...}
  ...
</div>
```

**替换为**：
```jsx
<div ref={logContentRef} ...>
  {!logContent && <span>选择文件以查看内容</span>}
  {logContent && lines.map((line, i) => (
    <LogLineRenderer
      key={i}
      rawLine={line}
      lineIndex={i}
      highlight={debouncedSearch || undefined}
      expandedKeys={expandedNestedKeys}
      onToggle={(li, ki, next) => {
        const k = `${li}:${ki}`;
        setExpandedNestedKeys(prev => {
          const ns = new Set(prev);
          if (next) ns.add(k); else ns.delete(k);
          return ns;
        });
      }}
    />
  ))}
  {loading && ...}
  ...
</div>
```

### 2.3 lines 准备

新增：
```ts
const lines = useMemo(() => logContent ? logContent.split('\n') : [], [logContent]);
```

> 现状 `logContent` 是**整段字符串**：`{rawLines.map(formatJsonLine).join('\n')}` 后。
> 在 split 之前我们**不**改 formatJsonLine 行为（保留 raw）；切到 LogLineRenderer 后，每一行的 pretty 化将交由组件内部 useMemo 路径。
> 折中：保留 formatJsonLine 调用在 setLogContent 处（不变），并在渲染时 rawLine 直接传给 LogLineRenderer。

### 2.4 全局 Esc 监听

```ts
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setExpandedNestedKeys(prev => prev.size > 0 ? new Set() : prev);
    }
  };
  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
}, []);
```

### 2.5 边缘行为

| 事件 | 行为 |
|------|------|
| 切换文件 (`handleReadLog`) | `setExpandedNestedKeys(new Set())` |
| 修改日志路径 (`handleSaveConfig`) | 不动；若 Modal 关闭重开则 `useMemo` 清理 |
| 新分片加载 (`loadChunk`) | `setExpandedNestedKeys(new Set())`（新行 L 编号变化，旧 key 可能失效） |
| 搜索关键字变化 | 不动；`<mark>` 由 LogLineRenderer 内部命中处理 |
| Modal 关闭 | modal 关闭时 useState 自然保留；下次打开前 `setExpandedNestedKeys(new Set())` 在 `setLogsModalVisible(false)` 的回调中实现 |

### 2.6 不修改的边界

- `formatJsonLine` 行为不变
- `log:list` / `log:read` / `log:stat` / `server:getDetail` / `server:update` 等 IPC 调用不变
- scroll 事件 / search / split panel 配置不变
- 主进程、preload、shared 全部不变
- `package.json` 不变（确认无新增依赖）

---

## 3. 验收标准

### 3.1 文件改动
- `src/renderer/pages/ServerDetailPage.tsx` 改动净增量 < 100 行（粗略，若超出先 review）
- 无其他文件改动

### 3.2 行为

| Case | 期望 |
|------|------|
| 打开 Modal 选择文件 | 正常逐行渲染；命中点显示折叠按钮 |
| 点击 ▶ | 该行就地展开 pretty；按钮变为 × 收起 |
| 点击 [复制 raw] | 复制成功提示；剪贴板含 rawValue（用户复制后可见非转义形式）|
| 点击 [复制 pretty] | 复制成功提示；剪贴板含 pretty 文本 |
| 点击 [× 收起] | 折叠回原状态 |
| 在展开时按 Esc | 全部收起 |
| 切换日志文件 | 全部收起；新文件正常渲染 |
| 滚动到底加载新分片 | 新分片拼接前先收起所有（避免旧 L:K 失效） |
| 输入搜索关键字 | 命中位置出现 `<mark>`；命中在折叠/展开处的可见行为见蓝图 §③「搜索兼容」 |
| 拖动 split panel / 最大化 | 不与嵌套组件交互，行为照旧 |
| 修改日志路径 | 行为照旧；不影响嵌套组件 |
| 启动监控 / 停止监控 / 返回 | 不受影响 |

### 3.3 编译 / lint / test / build
- `npm run lint` 通过
- `npm test` 全过（含 `nested-json.test.ts`）
- `npm run build` 通过（`tsc` + `vite build` + electron-builder 配置）

### 3.4 单元/集成测试新增（来自蓝图 §②约束）
- 现有测试矩阵不缺失
- 不新增组件层单测（沿用 SP-01 工具层单测即可；项目无 RTL 依赖）

### 3.5 安全验收
- 全文 `grep -r "dangerouslySetInnerHTML" src/renderer/components/NestedJsonValue.tsx src/renderer/components/LogLineRenderer.tsx` 结果为空
- 全文 `grep -r "dangerouslySetInnerHTML" src/renderer/pages/ServerDetailPage.tsx`：仍仅原搜索高亮一处（与 SP-03 前一致，未新增）

### 3.6 性能自检（手动）
- 1000 行日志，浏览器 DevTools Performance 录制 / 无 ≥ 50ms 长任务（仅自检）

---

## 4. 执行步骤

1. 读取 SP-01 / SP-02 落地结果，确认依赖项可用
2. 打开 `src/renderer/pages/ServerDetailPage.tsx`
3. 顶部 import：
   - 新增 `import LogLineRenderer from '../components/LogLineRenderer';`
   - 新增 `useMemo` 已在原 import 中，复用
4. 新增 state：`const [expandedNestedKeys, setExpandedNestedKeys] = useState<Set<string>>(new Set());`
5. 新增 `const lines = useMemo(() => logContent ? logContent.split('\n') : [], [logContent]);`
6. 新增 Esc 监听 `useEffect`
7. 在以下位置清空 expanded：
   - `handleReadLog` 内 `setSelectedFilePath(...)` 后：`setExpandedNestedKeys(new Set())`
   - `loadChunk` 开头：`setExpandedNestedKeys(new Set())`
   - Modal 关闭按钮：`setExpandedNestedKeys(() => new Set())`
8. 替换 div #logContentRef 内容（见 §2.2）
9. lint + tsc + test：
   - `npm run lint`
   - `npx tsc -p tsconfig.json --noEmit`
   - `npm test`
10. `npm run build` 输出 dist 正常；启动 dev 无报错
11. 手动冒烟（可选，但建议）：运行 `npm run dev:electron` 打开 Modal 选择样本日志，验证 3.2 全部行为
12. 暂存与提交：
    - `git add src/renderer/pages/ServerDetailPage.tsx`
    - `git commit -m "feat(renderer): wire nested-json preview into ServerDetailPage with Esc collapse"`

## 5. 风险 / 兜底

| 风险 | 兜底 |
|------|------|
| `useMemo` 缺失导致重渲染过频 | 严格按 §2.3 添加 |
| expandKey 与新分片错位 | 在分片前先 clear |
| `<mark>` 在 NestedJsonValue 内不可见 | 子组件不参与搜索高亮；与蓝图 §③「搜索兼容」一致 |
| 引入新依赖被 lint 警告 | 严格 0 新依赖；commit 前 `git diff package.json` 必须空 |

## 6. 与外部接口契约（完成时唯一验证依据）

```ts
// 新增 import
import LogLineRenderer from '../components/LogLineRenderer';

// render 出口
{logContent && lines.map((line, i) => (
  <LogLineRenderer
    key={i}
    rawLine={line}
    lineIndex={i}
    highlight={debouncedSearch || undefined}
    expandedKeys={expandedNestedKeys}
    onToggle={(li, ki, next) => {
      const k = `${li}:${ki}`;
      setExpandedNestedKeys(prev => {
        const ns = new Set(prev);
        if (next) ns.add(k); else ns.delete(k);
        return ns;
      });
    }}
  />
))}
```
