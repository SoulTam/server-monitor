<!-- 创建时间: 2026-06-27 17:30 -->
<!-- 最后修改: 2026-06-27 17:30 -->

# SP-04 — 嵌套 JSON 弹层视觉优化（按 JSON 缩进格式）

## 0. 前置依赖

SP-02（NestedJsonValue 组件）/ SP-01（utils/nested-json）

## 1. 唯一职责

扩展 `NestedJsonValue` 弹层内的 pretty 内容显示：保留 2 空格缩进，但加入：

1. **行号**（gutter）— 左侧单列，1..N
2. **Token 级语法高亮** — key / string / number / boolean / null / punct 各自颜色

仅前端组件 + utils：不动 ServerDetailPage、不动 LogLineRenderer、不动 IPC。

## 2. 结果定义

### 2.1 终态视觉（折叠展开后看到的 `<pre>` 内容）

```
┌────┬──────────────────────────────────────────────────────────────┐
│  1 │ {                                                            │
│  2 │   "prompt": "皮床电商详情场景： 一、整体空间基础信息……",        │
│  3 │   "mode": "image-to-image",                                   │
│  4 │   "referenceImageUrls": [                                     │
│  5 │     "https://huabu-art.oss-cn-hangzhou.aliyuncs.com/...png",  │
│  6 │     "https://huabu-art.oss-cn-hangzhou.aliyuncs.com/...png",  │
│  7 │     "https://huabu-art.oss-cn-hangzhou.aliyuncs.com/...png",  │
│  8 │     "https://huabu-art.oss-cn-hangzhou.aliyuncs.com/...png"   │
│  9 │   ],                                                         │
│ 10 │   "referencePolicy": "normalize"                              │
│ 11 │ }                                                            │
└────┴──────────────────────────────────────────────────────────────┘
   左列：行号（gutter，灰底）
   右列：含 Token 高亮的 pretty 内容
```

颜色规范：

| Token | 颜色（与现有 token 色保持一致 / 增强可读性） |
|-------|----------------------------------------------|
| string-value | `#d4380d`（已是 json-string 颜色） |
| key（字符串 key） | `#1677ff`（已是 json-key 颜色） |
| number | `#722ed1`（新增 — antd 紫色） |
| boolean | `#faad14`（新增 — antd 黄色） |
| null | `#999999`（新增 — 灰） |
| punct（`{ } , : [ ]`） | `#555555`（已是 json-punct 颜色） |
| 行号 gutter | 背景 `#fafafa`，文字 `#bbb`，右对齐，固定宽度 32px |

### 2.2 边距规范

- 不引入交互（无 ± 按钮）
- 复制按钮仍然输出**未着色的 pretty 文本**（`JSON.stringify(v, null, 2)`），与原 SP-02 一致
- 复制 raw 仍输出原始字符串
- 容器高度仍 `clamp(120px, calc(100vh - 240px), 480px)`，`overflow: auto`

### 2.3 不变的部分

- 行 HTML 结构：`<span role="region" className={styles.popupWrap}>` 同时存在
- 复制 raw 的 rawValue 仍来自 props（未经过任何转义）
- NestedJsonValue 主结构不重写

## 3. 函数/API（utils 层新增）

```ts
// src/renderer/utils/nested-json.ts 新增

export type PrettyToken =
  | { kind: 'key'; text: string }
  | { kind: 'string-value'; text: string }
  | { kind: 'number'; text: string }
  | { kind: 'boolean'; text: string }
  | { kind: 'null'; text: string }
  | { kind: 'punct'; text: string };

export function tokenizePrettyJson(pretty: string): PrettyToken[][];
// 返回二维：每一行 = 一组 token。pretty 来自 JSON.stringify(...,null,2)
```

**约束**：每行 token 的拼接输出 = 原始 pretty 行（反转 `JSON.stringify` 产物时无字符增删）。算法：

```
1) 解析 pretty 行：
   - "{ / } / [ / ] / , / :"  → punct
   - '"<key>"' (行内首部以 " 开头) → key
   - 数字字面（-? 数字 . 数字 e±数字）→ number
   - true / false → boolean
   - null → null
   - '"..."' → string-value
2) 行与行之间按 "\n" 切分
3) 缩进（leading whitespace）作为每行的"indent"字段返回在外部，由组件包裹
```

返回结构：

```ts
type PrettyLine = {
  indent: number;     // leading space count（除 \t 外视为对齐 token）
  tokens: PrettyToken[];
};
export function tokenizePrettyJson(pretty: string): PrettyLine[];
```

## 4. 验收标准

### 4.1 文件改动
- `src/renderer/utils/nested-json.ts`：追加 `tokenizePrettyJson` 与 `PrettyToken`、`PrettyLine` 类型（不破坏既有 API）
- `src/renderer/components/NestedJsonValue.tsx`：将既有 `<pre><code>{pretty}</code></pre>` 改为带行号 + Token 高亮
- `tests/nested-json.test.ts`：新增 `tokenizePrettyJson` 单测
- `src/renderer/components/NestedJsonValue.module.css`：新增 `.gutter`、`.lineRow`、`.token-key | .token-string | .token-number | .token-boolean | .token-null | .token-punct` 样式

不修改其他文件。

### 4.2 行为

| Case | 期望 |
|------|------|
| 点开 ▶ 后容器 | 显示左侧 gutter + 右侧带颜色的 pretty 内容 |
| 行号 | 1..N 连续；右对齐；等宽 |
| 复制 pretty | 剪贴板含未带颜色的 pretty 文本（不变） |
| 复制 raw | 仍 rawValue |
| 容器大小 | 不变；超长时仍 overflow:auto |
| 非法 pretty（解析失败）| 显示"内层 JSON 解析失败"（fallback 与原版一致）|

### 4.3 测试矩阵（vitest）

| Case | 输入 | 期望 |
|------|------|------|
| tokenize 简单对象 | `JSON.stringify({a:1,b:"x"},null,2)` | 第一行 `{` punct；第二行 `  "a": 1` 中 key/number/punct |
| tokenize 数组 | `JSON.stringify([1,null,true],null,2)` | number/null/boolean 都被识别 |
| tokenize 多行（含嵌套）| 含 mixed 元素 | 嵌套对象的 key 也正确 |
| indent 计算 | 无 indent / 2 空格缩进 / 4 个 level | 返回值 indent 与一致 |
| 空对象 | `{}` | 单行 `{` + `}`，第二行 walk 终止 |

### 4.4 不变量

- tsc 0 error
- 既有全部测试通过（25 + 3 回归 = 28）
- 无新依赖；不修改 package.json
- SP-01 与 SP-02 行为不变

## 5. 执行步骤

1. 在 `src/renderer/utils/nested-json.ts` 中追加 `PrettyToken`、`PrettyLine`、`tokenizePrettyJson`。
2. 在 `tests/nested-json.test.ts` 中追加 `describe('tokenizePrettyJson', ...)` 4+ 用例。
3. 跑 `npx vitest run tests/nested-json.test.ts`，全过。
4. 跑 `npx tsc -p tsconfig.json --noEmit`。
5. 跑 `npx eslint src/renderer/utils/nested-json.ts src/renderer/components/NestedJsonValue.tsx`，0 warning。
6. 在 `NestedJsonValue.tsx` 中：
   - 将 `<pre><code>{pretty}</code></pre>` 改为 `<pre>...</pre>` 包 gutter + tokenized rows。
   - 每行 = `<div className={styles.lineRow}><span className={styles.gutter}>{n}</span><span className={styles.lineBody}>{tokens}</span></div>`。
7. 在 `.module.css` 中加：`.gutter / .lineRow / .lineBody / .token-key / .token-string / .token-number / .token-boolean / .token-null / .token-punct`
8. `npm run build:renderer`，成功。
9. `git add` + `git commit`，type: `feat(renderer)`，scope: `nested-json-pretty-highlight`。

## 6. 风险与兜底

| 风险 | 兜底 |
|------|------|
| 数字识别错（如 `1e+5`）| 测试覆盖 |
| 中文 key（如 "模式"）会无引号出现？ | 不允许 — JSON spec key 必为带引号字符串；处理逻辑不偏离 |
| gutter 右对齐 + 等宽 | `font-family: monospace` + `text-align: right` |
| token 拼接等价原始 pretty | 测试断言：拼接 = 输入行 |
| Token span 嵌套 React：浏览器复制行为 | 不通过 `<input>` 或 `contentEditable` 抓取；浏览器对 `<pre><div><span>` 复制为带换行的纯文本，无颜色 / 标签泄漏（标价为 React 自动转义） |

## 7. 与外部契约（commit 后唯一验证）

```ts
import { tokenizePrettyJson, type PrettyToken, type PrettyLine } from '../utils/nested-json';
// 调用 tokenizePrettyJson(pretty) → PrettyLine[]
```
