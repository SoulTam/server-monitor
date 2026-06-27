<!-- 创建时间: 2026-06-27 09:40 -->
<!-- 最后修改: 2026-06-27 09:40 -->

# SP-01 — 工具层：`src/renderer/utils/nested-json.ts` + 单测

## 0. 前置依赖

无（首个 SP）

## 1. 唯一职责

新增 1 个工具文件 + 1 个单测文件，导出 4 个纯函数，完成所有"识别/格式化/安全转义"的底层逻辑。**不依赖 React，不引入新包。**

## 2. 结果定义（逐字拷贝自结果蓝图 §④ — 本子计划所负责的章节）

> 以下内容与蓝图一致，**不允许自行重写/概括/跳转**。

### API 完整定义

```ts
// src/renderer/utils/nested-json.ts（纯函数）

export function isJsonLikeString(s: string): boolean;
export function prettyJsonString(s: string): string | null;          // 返回 null 时表解析失败
export type JsonToken =
  | { kind: 'key'; text: string; depth: 0 }
  | { kind: 'string-value'; text: string; nested?: boolean; charCount: number }
  | { kind: 'punct'; text: string };
export function tokenizeJsonLine(rawLine: string): JsonToken[];
export function escapeJsonForHtml(s: string): string;               // 仅用于搜索高亮的回填
```

### 参数详情

**API: `isJsonLikeString(s: string): boolean`**
| 参数名 | 位置 | 类型 | 必填 | 说明 |
|--------|------|------|------|------|
| s | args | string | 是 | 待判定字符串 |
| 返回值 | — | boolean | — | `s.trim().startsWith('{')` 或 `[` 且 `JSON.parse(s) === OK`（不抛） |

**API: `prettyJsonString(s: string): string | null`**
| 参数名 | 位置 | 类型 | 必填 | 说明 |
|--------|------|------|------|------|
| s | args | string | 是 | JSON 字符串 |
| 返回值 | — | `string \| null` | — | 形如 `{ ...缩进 2 空格... }`；非法返回 `null` |

**API: `tokenizeJsonLine(rawLine: string): JsonToken[]`**
| 参数名 | 位置 | 类型 | 必填 | 说明 |
|--------|------|------|------|------|
| rawLine | args | string | 是 | 单行日志（未必合法 JSON；若非法则退回 1 个 `{kind:'string-value', text}` token） |

**返回 token 字段**
| 字段 | 类型 | 说明 |
|------|------|------|
| `kind` | enum | `key` / `string-value` / `punct` |
| `text` | string | 字面子串 |
| `nested` | boolean? | 仅 `string-value` 时；是否经 `isJsonLikeString` 命中 |
| `charCount` | number? | 仅 `string-value.nested=true` 时，用于显示"`nested JSON (N chars)`"提示 |
| `depth` | 0/1? | 仅 `key` 时使用；保留扩展位 |

**API: `escapeJsonForHtml(s: string): string`**
| 参数名 | 位置 | 类型 | 必填 | 说明 |
|--------|------|------|------|------|
| s | args | string | 是 | 任意字符串 |
| 返回值 | — | string | — | 转义 `& < > " '`，保留换行符 |

> 来源：蓝图 §④ A、B。

---

### 与 SP-01 唯一负责覆盖的覆盖矩阵行（也即验收标准的来源条目）

> 来自 `结果蓝图 §⑦ 业务规则 → 全维度覆盖矩阵`。

| 业务规则 | 前端体现 | 函数/API 体现 | 测试体现 |
|---------|---------|------------|---------|
| 嵌套 JSON 命中时显示折叠占位 | NestedJsonValue 折叠态 | `isJsonLikeString` + `tokenizeJsonLine` | nested-json.test.ts "detect" |
| 折叠态不污染 raw | 整行 raw 仍由 token `text` 拼出可被复制 | `tokenizeJsonLine` 输出**未双重 unescape** | "raw preserved" |
| 复制 raw / pretty | 按钮 click → writeText | `prettyJsonString` + 原值 | "copy payoff" |
| 深度=1 | 检测仅在首层 `Object.entries` | `tokenizeJsonLine` 不递归 | "depth=1 only" |
| 搜索 `<mark>` 兼容 | `escapeJsonForHtml` 后再 split/join | 同上 | "search marks" |

> SP-01 落地以上 5 条业务规则的"函数/API 体现 + 测试体现"。

---

### 核心算法约束（逐字自蓝图 §② 技术设计 / tokenize 算法）

摘录 tokenizeJsonLine 的核心约束（实现必须满足）：

```
1) stripLeading = rawLine.match(/^[\s]*/)?.[0] ?? ''
2) 主流程以 minimal 手写扫描
3) KEY 段：到下一个非转义的 '"'(开引号) → start；读到匹配的 '"'(闭引号) → end
4) COLON：跳过空格 + ':' + 空格
5) VALUE：
   - 若以 '"' 起：读到匹配的 '"' 作为 string-value
   - 若以 '{' 或 '[' 起：depth=1 直吞到匹配 bracket；不展开内部嵌套对象
   - 其它：原样（数字 / 布尔 / null）
6) PUNCT：',' 或 '}' ']' 单独 token
7) 若 rawLine 不是合法 JSON：`[{ kind:'plain', text: rawLine }]`
```

注：plan 文件中的伪代码只是思路提示；最终实现由 `tokenizeJsonLine` 决定，但必须满足上述约束并通过 §3 测试。

> 来源：蓝图 §② 算法约束。

---

## 3. 验收标准（Verification）

### 3.1 文件落地
- `src/renderer/utils/nested-json.ts` 存在
- `tests/nested-json.test.ts` 存在

### 3.2 公共 API 全部导出
- `isJsonLikeString`、`prettyJsonString`、`tokenizeJsonLine`、`escapeJsonForHtml` 全部 `export`
- `JsonToken` 类型 `export`

### 3.3 测试矩阵（vitest 全部通过）

| Case | Input | Expected |
|------|-------|----------|
| detect: JSON object | `'{"a":1}'` | `true` |
| detect: JSON array | `'[1,2,3]'` | `true` |
| detect: not json | `'plain text'` | `false` |
| detect: leading ws | `'   {"a":1}\n'` | `true` |
| detect: number | `'123'` | `false` |
| pretty: simple | `'{"a":1,"b":"x"}'` | 形如 `{\n  "a": 1,\n  "b": "x"\n}` |
| pretty: invalid | `'{not json'` | `null` |
| pretty: nested inside string | `'{"context":"{\\"a\\":1}"}'` | 上一层 OK，返回 `{` 缩进样式；内层仍为 string（即 `JSON.parse` 第二层不展开到 outer 形态） |
| tokenize: not json | `'2024-01-01 hello world'` | 1 个 `{kind:'plain', text: <原行>}` token |
| tokenize: simple | `'{"a":1,"b":"x"}'` | keys `a`、`b`；values 1、`x`；entry 之间有 `,` |
| tokenize: nested-string | `'{"a":"{\\"x\\":1}"}'` | `string-value.nested === true`, `charCount !== undefined` |
| raw preserved | 输入含转义序列，`text` 字段仍是原字面子串（`\\/\\"\\n` 等保留） | token 输出不二次 unescape |
| depth=1 | `'{"a":"{\\"b\\":\\"{c\\":1}"}'` 仅首层 a 被识别 nested；不会递归到 b / c | nested 标识只在外层字段 |
| escapeJsonForHtml: full coverage | `&<>"'` 全转义 | `&<>"'` |
| escapeJsonForHtml: keeps newlines | `'a\nb'` | `'a\nb'`（不变） |
| perf sanity | 16KB raw single-line JSON tokenize < 30ms（CI 安全下限） | 视硬件场景通过即可，记入测试日志 |

### 3.4 编译 / lint / test
- `npm run build` 通过（含 tsconfig 严格模式）
- `npm run lint` 全过
- `npm test -- nested-json` 全过

### 3.5 安全约束
- `escapeJsonForHtml` 单一纯净实现；未再实现另一份"易混淆"版本
- 不引入新依赖：`package.json` 未发生 diff

---

## 4. 执行步骤（Agent 唯一依据）

> 子计划每步必须明确、不允许"参考 XX"、"自行决定"等。

1. 读取 `agent-doc/result-first/2026-06-27-02-nested-json-display-result-blueprint.md` §④ A/B 仅作"上下文一致性校验"，**实现以本 SP 步为准**
2. 创建文件 `src/renderer/utils/nested-json.ts`
3. 实现四个函数：
   - `escapeJsonForHtml`：按 §3.3 escapeJsonForHtml 用例完整
   - `isJsonLikeString`：trim + 首字符 `{`/`[` + `try { JSON.parse } catch`
   - `prettyJsonString`：try `JSON.stringify(JSON.parse(s), null, 2)` catch null
   - `tokenizeJsonLine`：按"核心算法约束 §2"实现；当 `JSON.parse(rawLine)` 不抛时输出 tokens，否则输出 `[{kind:'plain',text:rawLine}]`
4. 创建 `tests/nested-json.test.ts`
5. 编写 §3.3 测试矩阵全部用例
6. 执行 `npm test -- nested-json`；如失败修正至全部通过
7. 执行 `npm run lint`，如有 fix 才允许修，不引入其它 warning
8. 执行 `npx tsc -p tsconfig.json --noEmit`，0 error
9. Stage 并 commit：
   - `git add src/renderer/utils/nested-json.ts tests/nested-json.test.ts`
   - `git commit -m "feat(renderer): add nested-json utils (isJsonLikeString/prettyJsonString/tokenizeJsonLine/escapeJsonForHtml) with unit tests"`

## 5. 风险 / 兜底

| 风险 | 兜底 |
|------|------|
| 性能不达标 | 16KB 内允许 lexical 扫描落后；超过该 size 仍按 JSON.parse / JSON.stringify 路径，视为"快速失败" |
| token 字段命名漂移 | 以本文件 §3.2 为权威 |
| 测试 snap CI 抖动 | 不使用快照；纯断言 |

## 6. 与后续 SP 的接口契约（本 SP 必须冻结）

```ts
export type JsonToken =
  | { kind: 'key'; text: string }
  | { kind: 'string-value'; text: string; nested?: boolean; charCount?: number }
  | { kind: 'punct'; text: string }
  | { kind: 'plain'; text: string };

// SP-02 通过 import { /* 上述 */ } from '../../utils/nested-json' 使用
```
