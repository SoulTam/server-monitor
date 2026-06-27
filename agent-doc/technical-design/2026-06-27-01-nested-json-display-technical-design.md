<!-- 创建时间: 2026-06-27 09:35 -->
<!-- 最后修改: 2026-06-27 09:35 -->

# 技术设计文档 — 日志嵌套 JSON 展示（方案 D）

## 1. 模块清单

### 1.1 `src/renderer/utils/nested-json.ts`

| 函数 | 签名 | 行为 |
|------|------|------|
| `isJsonLikeString` | `(s: string) => boolean` | 1) `s.trim()` 长度 > 1；2) 首字符 `{` 或 `[`；3) `JSON.parse(s)` 不抛且为 object/array |
| `prettyJsonString` | `(s: string) => string \| null` | 调 `JSON.parse(s)`，`JSON.stringify(v, null, 2)` 返回；失败返回 `null` |
| `tokenizeJsonLine` | `(rawLine: string) => JsonToken[]` | 见 §2 |
| `escapeJsonForHtml` | `(s: string) => string` | 转义 `& < > " '` |

```ts
export type JsonToken =
  | { kind: 'key'; text: string }
  | { kind: 'string-value'; text: string; nested?: boolean; charCount?: number; valueKeyIndex?: number }
  | { kind: 'punct'; text: string }
  | { kind: 'plain'; text: string };   // 整行非法 JSON 时
```

### 1.2 `src/renderer/components/NestedJsonValue.tsx`

Props：

```ts
export interface NestedJsonValueProps {
  rawValue: string;
  keyName: string;
  lineIndex: number;
  keyIndex: number;
}
```

内部 hooks/state：
- `const [expanded, setExpanded] = useState(false);`
- `const expandedKey = `${lineIndex}:${keyIndex}`;`
- 通过 props 传入 `currentExpandedKey` 与 `externalToggle(key)` 由父页面提供（实现 setUnion，见 SP-03）

render 决策：
- 折叠：`"▶ nested JSON (${charCount} chars)"`，可点击 button；与前缀 `': '` 或相邻 punctuation 之间用空格分隔
- 展开：
  - 容器 `<div class="nlj-popup">`，inline-block 宽度 100%
  - 内部 `<pre><code>{prettyJsonString(rawValue)!}</code></pre>`（**用 textContent 渲染**，无 dangerouslySetInnerHTML）
  - 顶部工具栏：`<button>× 收起</button>` `<button>复制 raw</button>` `<button>复制 pretty</button>`
  - 复制失败/异常：catch 后回弹 antd `message.error('复制失败')`，并尝试 `<textarea>+execCommand` 回退

### 1.3 `src/renderer/components/LogLineRenderer.tsx`

Props：

```ts
export interface LogLineRendererProps {
  rawLine: string;
  lineIndex: number;
  highlight?: string;
  expandedKeys: Set<string>;
  onToggle: (lineIndex: number, keyIndex: number) => void;
}
```

行为：
- 调 `tokenizeJsonLine(rawLine)` 得到 token 数组
- 若命中 `string-value.nested === true`：渲染时把对应 token 位置替换为 `<NestedJsonValue ... />`，传入 `expandedKeys / onToggle`
- 若 `highlight` 存在：对每段文本做 escape 后 split/join 注入 `<mark>`
- 否则纯文本节点

## 2. tokenize 算法

```
1) stripLeading = rawLine.match(/^[\s]*/)?.[0] ?? ''
2) head = stripLeading + '{' / '[' / '"<plain>'
3) 用 minimal 手写扫描：
   state = KEY | COLON | VALUE | PUNCT
   - KEY 段：到下一个非转义的 '"'(开引号) → start；读到匹配的 '"'(闭引号) → end
   - COLON：跳过空格 + ':' + 空格
   - VALUE：
       - 若以 '"' 起：读到匹配的 '"' 作为 string-value
       - 若以 '{' 或 '[' 起：depth++，继续；
           - 终：再递归，但我方 depth=1 时不再向下展开 token 化，**整段视为 string-value + 调用 isJsonLikeString 标记 nested**
       - 其它：原样（数字 / 布尔 / null）
   - PUNCT：',' 或 '}' ']' 单独 token
4) 若 rawLine 不是合法 JSON：`[{ kind:'plain', text: rawLine }]`
```

输出：`JsonToken[]`

伪代码：

```ts
function tokenizeJsonLine(rawLine: string): JsonToken[] {
  const trimmed = rawLine.trim();
  if (!trimmed) return [{ kind: 'plain', text: rawLine }];
  try { JSON.parse(trimmed); } catch {
    return [{ kind: 'plain', text: rawLine }];
  }
  // deep=1 walk
  let i = 0;
  const tokens: JsonToken[] = [];
  function skipWs(){ while (i < rawLine.length && /\s/.test(rawLine[i])) { tokens.push({kind:'plain', text: rawLine[i]}); i++; } }
  skipWs();
  if (rawLine[i] !== '{' && rawLine[i] !== '[') {
    // 非对象起点，可能整行是字符串/其他；回退 plain
    return [{ kind: 'plain', text: rawLine }];
  }
  // consum top-level '{'
  tokens.push({ kind: 'punct', text: rawLine[i] }); i++;
  let keyIdx = 0;
  while (i < rawLine.length) {
    skipWs();
    if (rawLine[i] === '}') { tokens.push({ kind:'punct', text: rawLine[i] }); i++; break; }
    // expect key
    if (rawLine[i] !== '"') { /* 容错：跳过到下个逗号 / 换行 */ }
    const keyStart = i; i++; // opening "
    while (i < rawLine.length && rawLine[i] !== '"') {
      if (rawLine[i] === '\\') i += 2; else i++;
    }
    i++; // closing "
    tokens.push({ kind: 'key', text: rawLine.slice(keyStart, i) });
    skipWs();
    if (rawLine[i] === ':') { tokens.push({ kind:'punct', text: ':' }); i++; skipWs(); }
    // value: string or other
    if (rawLine[i] === '"') {
      const vStart = i; i++;
      while (i < rawLine.length && rawLine[i] !== '"') {
        if (rawLine[i] === '\\') i += 2; else i++;
      }
      i++; // closing "
      const segment = rawLine.slice(vStart, i);
      const innerContent = sliceStringLiteral(segment);  // 去掉外引号 + 解一次转义
      const nested = isJsonLikeString(innerContent);
      tokens.push({
        kind: 'string-value',
        text: segment,
        nested,
        charCount: nested ? innerContent.length : undefined,
        valueKeyIndex: keyIdx,
      });
      keyIdx++;
    } else if (rawLine[i] === '{' || rawLine[i] === '[') {
      // 整段直吞到匹配 bracket
      const open = rawLine[i];
      const close = open === '{' ? '}' : ']';
      let depth = 1; i++;
      while (i < rawLine.length && depth > 0) {
        if (rawLine[i] === '\\' && openBracketedStringHere()) { i += 2; continue; }
        if (rawLine[i] === '"') { skipString(); continue; }
        if (rawLine[i] === open) depth++;
        else if (rawLine[i] === close) depth--;
        i++;
      }
      const segment = rawLine.slice(vStartOfBracketed, i);
      tokens.push({ kind: 'punct', text: open });
      // 无法精确判定嵌套字符串，跳过 — depth=1 不处理嵌套对象的内部
      tokens.push({ kind: 'string-value', text: '{...}', nested: false });
      tokens.push({ kind: 'punct', text: close });
    } else {
      // number / boolean / null 原样吞
      const vStart = i;
      while (i < rawLine.length && !/[,}\]]/.test(rawLine[i])) i++;
      tokens.push({ kind: 'string-value', text: rawLine.slice(vStart, i), nested: false });
    }
    skipWs();
    if (rawLine[i] === ',') { tokens.push({ kind: 'punct', text: ',' }); i++; }
  }
  return tokens;
}
```

> 真实实现会被 `tests/nested-json.test.ts` 强制：JSON 字符串转义、内部包含引号、嵌套对象（按方案约定仅标记 nested=false）、非法 JSON 都需通过。

---

## 2.5 安全补充

- `<NestedJsonValue>` 渲染时**禁止**用 `dangerouslySetInnerHTML`：`prettyJsonString` 结果作为 React children 输出（自动转义）
- `highlight` 注回 `<mark>` 走现有 escapeJsonForHtml 后再 split-join，与现状实现一致
- 复制 raw 只能获取**非转义**的内层字符串（≠ literal 形态），与"不改变原本日志内容"不冲突：因为 raw 整行正本仍由内联 token 拼出

## 3. 状态机

| 事件 | 前置 | 后置 |
|------|------|------|
| 点击 ▶ 折叠 | closed | open (`expandedKeys.add(L:K)`) |
| 点击 × 收起 | open | closed (`expandedKeys.delete(L:K)`) |
| Esc 全局 | any | closed (all) |
| 点击其他行 / 点击 Modal 标题 / 关闭/打开 Modal | any | closed (all) |
| 重新加载文件 / 搜索变化 | any | closed (清理) |

## 4. 性能预算与命中策略

- tokenizeJsonLine 总是命中（哪怕不命中嵌套，也会复核整行合法性）
- isJsonLikeString 在 token 中**仅当 string-value** 才调用
- prettyJsonString 仅在展开节点的第一次渲染时调用；其他时候不调用
- 全行不嵌套 JSON 时：仍 tokenize 一遍，时间 < 2ms，可接受；视情况 SP-02 引入 early-return 短路

## 5. 依赖

| 名称 | 用途 | 是否新增 |
|------|------|---------|
| react, react-dom | UI | 否（已有） |
| antd | Button / message | 否（已有） |
| vitest | 单元测试 | 否（已有） |

## 6. 命名规范

- 文件：`kebab-case` 已存在，但 `src/renderer/components/` 既有使用 PascalCase（`AlertFilter.tsx` 等）。新组件沿用 PascalCase 文件名
- 函数：`camelCase`
- 常量：`UPPER_SNAKE_CASE`
- CSS class：`nlj-` 前缀（n l j = Nested Log Json），保持命名空间隔离
