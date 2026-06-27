<!-- 创建时间: 2026-06-27 09:40 -->
<!-- 最后修改: 2026-06-27 09:40 -->

# SP-02 — 组件层：`NestedJsonValue.tsx` + `LogLineRenderer.tsx`

## 0. 前置依赖

SP-01（utils 已交付）

## 1. 唯一职责

新增 2 个 React 组件文件：

| 文件 | 职责 |
|------|------|
| `src/renderer/components/NestedJsonValue.tsx` | 折叠/展开本体；复制按钮；Esc/外部点击通过 props 由父控制 |
| `src/renderer/components/LogLineRenderer.tsx` | 单行 token 化渲染：把命中点替换为 `<NestedJsonValue>` |

不修改 `ServerDetailPage.tsx`（由 SP-03 负责）。

## 2. 结果定义（逐字拷贝自结果蓝图 §③ / §④）

### 2.1 NestedJsonValueProps

```ts
export interface NestedJsonValueProps {
  rawValue: string;             // 未 escape 的原始字符串（含可能的双引号 / 转义）
  keyName: string;              // 父层 key（用于 aria-label）
  lineIndex: number;            // 用于稳定 expanded 状态 key
  keyIndex: number;             // 同上一行的哪个 key（0..N-1）
  expanded: boolean;
  onToggle: (next: boolean) => void;
}
```

### 2.2 折叠态终态

```
+ 紧贴 key 后：'▶ nested JSON (123 chars)'
+ 元素: <button class="nlj-fold">▶</button> + <span class="nlj-fold-label">nested JSON (123 chars)</span>
+ 前缀 punctuation（':' 空格）不重复，由父组件 LogLineRenderer 渲染
+ 可键盘 focus；aria-expanded=false/predefined
```

### 2.3 展开态终态

```
<div class="nlj-popup" role="region" aria-label="嵌套 JSON 预览">
  <div class="nlj-toolbar">
    <button class="nlj-btn" onClick={() => onToggle(false)} aria-label="收起">× 收起</button>
    <button class="nlj-btn" onClick={() => copy(rawValue)} aria-label="复制 raw">复制 raw</button>
    <button class="nlj-btn" onClick={() => copy(pretty ?? '')} aria-label="复制 pretty">复制 pretty</button>
  </div>
  <pre><code>{pretty ?? '内层 JSON 解析失败'}</code></pre>
</div>
```

### 2.4 LogLineRendererProps

```ts
export interface LogLineRendererProps {
  rawLine: string;
  lineIndex: number;
  highlight?: string;
  expandedKeys: Set<string>;
  onToggle: (lineIndex: number, keyIndex: number) => void;
}
```

### 2.5 LogLineRenderer render 决策

1. 调 `tokenizeJsonLine(rawLine)` 得到 tokens
2. 若 tokens[0].kind === 'plain'：直接 `<pre>{rawLine}</pre>` 渲染（保留 plain text）
3. 否则按 token 循环：
   - `key` → 渲染 `<span class="json-key">{escape(token.text)}</span>`
   - `punct` → text 渲染
   - `string-value` 且 `nested === true`：
     - 计算 expandKey = `${lineIndex}:${token.valueKeyIndex!}`
     - 若 `expandedKeys.has(expandKey)`：渲染 `<NestedJsonValue ... expanded={true} onToggle={(n)=>onToggle(lineIndex, token.valueKeyIndex!, n)} .../>`
     - 否则：渲染 `<NestedJsonValue ... expanded={false} onToggle={(n)=>...} .../>`
   - `string-value` 且 `nested === false`：渲染 `<span class="json-string">{escape(token.text)}</span>`
4. `highlight` 命中：复用 `escapeJsonForHtml` + 现有 split/join 模式，但仅作用于**未在折叠/展开容器内部的文本片段**

### 2.6 CSS class 规范

| 类名 | 用途 |
|------|------|
| `nlj-fold` | 折叠按钮 |
| `nlj-fold-label` | 折叠按钮旁文字 |
| `nlj-popup` | 展开容器（浅蓝背景） |
| `nlj-toolbar` | 容器顶部工具栏 |
| `nlj-btn` | 工具栏按钮基类 |
| `json-key` | key 文本 |
| `json-string` | 普通 string value |
| `json-string-nested` | 命中折叠点（视觉区别） |

样式实现：
- 每个 .tsx 文件对应一个 *.module.css 文件（同目录命名）
- 或：用局部 `<style>` 写在文件内（每个组件独立，唯一选择器前缀 `nlj-`，避免全局污染）

> 决断：本 SP 内对每个组件使用 **CSS Module** 文件（同目录命名 `.module.css`），由 Vite/PostCSS 处理；与 `Layout.module.css` 一致

### 2.7 复制实现

```ts
async function copy(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fallthrough */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}
```

调用处（按钮 onClick）：
```ts
const ok = await copy(text);
ok ? message.success('复制成功') : message.error('复制失败');
```

> `message` 从 antd 导入；`onToggle` 由父提供，无需自管。

### 2.8 性能预算（来自蓝图 §②）

- 单行 `<LogLineRenderer>` 渲染时间预算 < 8ms
- `prettyJsonString` 仅在节点首次进入展开状态时计算，并 `useMemo` 缓存：`useMemo(() => prettyJsonString(rawValue), [rawValue])`
- `isJsonLikeString` 已 SP-01 优化，组件 layer 不再重复

### 2.9 安全约束

- 永远不读 `dangerouslySetInnerHTML`
- 所有 token `text` 通过 React children / `escapeJsonForHtml` 渲染
- 复制 pay load 经过 `copy()` 不会再加任何转义

---

## 3. 验收标准

### 3.1 文件落地
- `src/renderer/components/NestedJsonValue.tsx` 存在
- `src/renderer/components/NestedJsonValue.module.css` 存在
- `src/renderer/components/LogLineRenderer.tsx` 存在
- `src/renderer/components/LogLineRenderer.module.css` 存在

### 3.2 公共导出
- `NestedJsonValue`, `NestedJsonValueProps`
- `LogLineRenderer`, `LogLineRendererProps`

### 3.3 行为

| Case | 输入/操作 | 预期 |
|------|---------|------|
| NestedJsonValue 折叠态 | 传入 `expanded=false` | 仅渲染 ▶ + label |
| NestedJsonValue 展开态 | 传入 `expanded=true` | 渲染 popup + 三个按钮 + 内容 |
| NestedJsonValue 复制 raw | 点击 [复制 raw] | 复制 `rawValue` 到剪贴板；message.success 显示 |
| NestedJsonValue 复制 pretty | 点击 [复制 pretty] | 复制 pretty 到剪贴板；message.success |
| NestedJsonValue 收起 | 点击 [× 收起] | onToggle(false) 调用 1 次 |
| LogLineRenderer 普通行 | rawLine = `'"a": 1,'` 等普通 | 渲染 key/string/punct，未使用 NestedJsonValue props |
| LogLineRenderer 嵌套命中 | rawLine 包含 `key: "JSON 字符串"` | 该 string-value 嵌套命中应渲染 NestedJsonValue |
| LogLineRenderer 命中展开 | 点击 ▶ | 父 expanded 后第二次渲染展示 popup；DOM 中嵌套容器包含 `<pre>` |
| LogLineRenderer 纯文本 | rawLine = `'2024-01-01'` | 渲染 `<pre>{rawLine}</pre>` |
| aria | 折叠按钮 aria-expanded | 当前状态严格匹配 |

### 3.4 编译 / lint
- `npm run build`, `npm run lint`, `npx tsc --noEmit` 全通过
- 没有新依赖、无 package.json diff

### 3.5 测试
- 由于该层是 React 组件，**不新增** React Testing Library（与项目现状一致；项目无 RTL 依赖）
- 行为验收由 SP-03 在 `ServerDetailPage` 中 e2e 验证 + 用户手动
- SP-02 阶段确保组件 export / props 类型签名无误

---

## 4. 执行步骤

1. 创建 `src/renderer/components/NestedJsonValue.tsx`
2. 创建 `src/renderer/components/NestedJsonValue.module.css`
3. 实现组件 + useMemo + copy helper
4. 创建 `src/renderer/components/LogLineRenderer.tsx`
5. 创建 `src/renderer/components/LogLineRenderer.module.css`
6. 实现 token 化 + 命中点代入 NestedJsonValue + 焦点/aria
7. 静态自检：
   - 通过 grep 在 `src/renderer/components/` 下确认不在新组件中使用 `dangerouslySetInnerHTML`
   - 确认 `prettyJsonString` 仅在展开节点用一次并 useMemo
8. `npm run build` + `npm run lint` + `npx tsc --noEmit`
9. 暂存：
   - `git add src/renderer/components/NestedJsonValue* src/renderer/components/LogLineRenderer*`
   - `git commit -m "feat(renderer): add NestedJsonValue and LogLineRenderer for nested JSON preview"`

## 5. 风险 / 兜底

| 风险 | 兜底 |
|------|------|
| `message` antd 用法 | 直接 import：`import { message } from 'antd'` |
| 与 ServerDetailPage 既有日志渲染并存时键冲突 | 本 SP 不动 ServerDetailPage；并存由 SP-03 切流 |
| 样式模块冲突 | `.module.css` 命名空间隔离；选择器以 `nlj-` 唯一前缀 |

## 6. 与外部接口契约（SP-03 唯一参数依据）

```ts
// 由 SP-01 提供
import {
  isJsonLikeString,
  prettyJsonString,
  tokenizeJsonLine,
  escapeJsonForHtml,
  type JsonToken,
} from '../utils/nested-json';

// DOM 中渲染样式示例
.nlj-fold { /* TODO css */ }

// 通用 copy helper（NestedJsonValue.tsx 内私有）
async function copy(text: string): Promise<boolean> { /* see §2.7 */ }
```
