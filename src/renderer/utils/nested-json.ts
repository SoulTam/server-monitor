/**
 * 日志中嵌套 JSON 字符串识别与格式化工具（纯函数，零副作用，零依赖）
 *
 * 设计目标：
 * - 检测某个字符串字面值是否本身是一个合法 JSON 字符串（depth = 1）。
 * - tokenizeJsonLine 把"行是合法 JSON"按"key / value / 嵌套字符串"
 *   三类拆解；不递归解析嵌套 JSON（按设计仅 depth=1）。
 *
 * 严禁：
 * - 引入第三方依赖。
 * - 在本文件中导入 React / antd / DOM 任何 API。
 */

export type JsonToken =
  | { kind: 'key'; text: string }
  | { kind: 'string-value'; text: string; nested?: boolean; charCount?: number; valueKeyIndex?: number }
  | { kind: 'punct'; text: string }
  | { kind: 'plain'; text: string };

/**
 * 将任意字符串转义为安全 HTML 文本：仅 `& < > " '` 五个字符，其他保留原样。
 * 用于嵌套 JSON 在 React 之外（如 dangerouslySetInnerHTML 内的搜索高亮）渲染前的再次转义。
 */
export function escapeJsonForHtml(s: string): string {
  const AMP = '\u0026' + 'amp;';
  const LT = '\u0026' + 'lt;';
  const GT = '\u0026' + 'gt;';
  const QUOT = '\u0026' + 'quot;';
  const APOS = '\u0026' + '#39;';
  return s
    .replace(/\u0026/g, AMP)
    .replace(/\u003c/g, LT)
    .replace(/\u003e/g, GT)
    .replace(/"/g, QUOT)
    .replace(/'/g, APOS);
}

/**
 * 判断字符串 s 是否为合法 JSON 字符串（对象或数组）。
 * depth = 1：首字符 `{` 或 `[`，可被 `JSON.parse` 解析，且不抛。
 */
export function isJsonLikeString(s: string): boolean {
  if (typeof s !== 'string') return false;
  const trimmed = s.trim();
  if (trimmed.length < 2) return false;
  const first = trimmed[0];
  if (first !== '{' && first !== '[') return false;
  try {
    const v = JSON.parse(trimmed);
    return typeof v === 'object' && v !== null;
  } catch {
    return false;
  }
}

/**
 * 把 JSON 字符串格式化为缩进 2 的字符串。
 * 解析失败返回 null。
 */
export function prettyJsonString(s: string): string | null {
  if (typeof s !== 'string') return null;
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return null;
  }
}

/**
 * 把单行日志 rawLine 拆成 JsonToken[]。
 * - 若 rawLine 不是合法 JSON → 返回 `[{ kind: 'plain', text: rawLine }]`
 * - 否则按 depth=1 拆 key / value；当 value 是字符串且 isJsonLikeString 命中时
 *   标记 `nested=true` 并记录 charCount（即去掉两端引号并 unescape 一次后长度）。
 * - value 是数字 / 布尔 / null 仍按单一 chunk 归为 'string-value' (nested=false)。
 * - 不递归解析嵌套对象/数组内部 token。
 */
export function tokenizeJsonLine(rawLine: string): JsonToken[] {
  if (typeof rawLine !== 'string') {
    return [{ kind: 'plain', text: String(rawLine) }];
  }
  const trimmed = rawLine.trim();
  if (trimmed.length === 0) {
    return [{ kind: 'plain', text: rawLine }];
  }
  let probe: unknown;
  try {
    probe = JSON.parse(trimmed);
  } catch {
    return [{ kind: 'plain', text: rawLine }];
  }
  if (probe === null || typeof probe !== 'object') {
    return [{ kind: 'plain', text: rawLine }];
  }

  const tokens: JsonToken[] = [];
  let i = 0;

  const peek = (offset = 0): string => rawLine[i + offset] ?? '';
  const isWs = (ch: string): boolean => ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';

  const skipWs = (): void => {
    while (i < rawLine.length && isWs(peek())) i++;
  };

  const readStringLiteral = (): { ok: true; value: string; raw: string } | { ok: false } => {
    if (peek() !== '"') return { ok: false };
    const start = i;
    i++; // open "
    while (i < rawLine.length) {
      const ch = peek();
      if (ch === '\\') {
        if (i + 1 >= rawLine.length) return { ok: false };
        i += 2;
        continue;
      }
      if (ch === '"') {
        i++; // close "
        const raw = rawLine.slice(start, i);
        return { ok: true, raw, value: unescapeRawString(raw) };
      }
      i++;
    }
    return { ok: false };
  };

  const skipBracketed = (openCh: string, closeCh: string): boolean => {
    let depth = 1;
    i++; // 进入外层起点（调用方传入的 i 仍指向 openCh），立即消费它
    while (i < rawLine.length && depth > 0) {
      const ch = peek();
      if (ch === '"') {
        const r = readStringLiteral();
        if (!r.ok) return false;
        continue;
      }
      if (ch === openCh) depth++;
      else if (ch === closeCh) depth--;
      i++;
    }
    return depth === 0;
  };

  // 期望首字符 '{' 或 '['
  skipWs();
  const openCh = peek();
  if (openCh !== '{' && openCh !== '[') {
    return [{ kind: 'plain', text: rawLine }];
  }
  const closeCh = openCh === '{' ? '}' : ']';
  tokens.push({ kind: 'punct', text: openCh });
  i++;

  let keyIdx = 0;

  while (i < rawLine.length) {
    skipWs();
    if (i >= rawLine.length) break;
    const ch = peek();
    if (ch === closeCh) {
      tokens.push({ kind: 'punct', text: closeCh });
      i++;
      break;
    }
    if (ch === ',') {
      tokens.push({ kind: 'punct', text: ',' });
      i++;
      continue;
    }
    if (ch !== '"') {
      // 既不是分隔，也不是 key 起点 → 容错：吞一个字符并继续
      tokens.push({ kind: 'punct', text: ch });
      i++;
      continue;
    }

    // expected: key
    const keyLit = readStringLiteral();
    if (!keyLit.ok) {
      // 容错：截到下一个分隔符
      const sliceStart = i;
      while (i < rawLine.length && !/[,}\]:]/.test(peek())) i++;
      tokens.push({ kind: 'plain', text: rawLine.slice(sliceStart, i) });
      continue;
    }
    tokens.push({ kind: 'key', text: keyLit.raw });
    skipWs();
    if (peek() === ':') {
      tokens.push({ kind: 'punct', text: ':' });
      i++;
    }
    skipWs();

    const vCh = peek();
    if (vCh === '"') {
      const lit = readStringLiteral();
      if (lit.ok) {
        const nested = isJsonLikeString(lit.value);
        tokens.push({
          kind: 'string-value',
          text: lit.raw,
          charCount: nested ? lit.value.length : undefined,
          valueKeyIndex: nested ? keyIdx : undefined,
          nested: nested ? true : undefined,
        });
        keyIdx++;
      } else {
        const sliceStart = i;
        while (i < rawLine.length && !/[,}\]]/.test(peek())) i++;
        tokens.push({ kind: 'string-value', text: rawLine.slice(sliceStart, i), nested: false });
      }
    } else if (vCh === '{' || vCh === '[') {
      const startObj = i;
      const ok = skipBracketed(vCh, vCh === '{' ? '}' : ']');
      const segment = ok ? rawLine.slice(startObj, i) : rawLine.slice(startObj);
      tokens.push({ kind: 'string-value', text: segment, nested: false, valueKeyIndex: keyIdx });
      keyIdx++;
    } else if (vCh === '' || vCh === undefined) {
      break;
    } else {
      const sliceStart = i;
      while (i < rawLine.length && !/[,}\]]/.test(peek())) i++;
      tokens.push({ kind: 'string-value', text: rawLine.slice(sliceStart, i), nested: false });
    }
  }

  return tokens;
}

/**
 * 从一个 JSON 字符串字面值 `"…"` 里去掉两端引号并解一次转义，得到原始字符串。
 * 不抛（输入非合法字符串字面值时返回原文）。
 */
function unescapeRawString(rawLit: string): string {
  if (rawLit.length < 2 || rawLit[0] !== '"' || rawLit[rawLit.length - 1] !== '"') {
    return rawLit;
  }
  try {
    return JSON.parse(rawLit);
  } catch {
    return rawLit.slice(1, -1).replace(/\\(["\\bfnrt])/g, '$1').replace(/\\u([0-9a-fA-F]{4})/g, (_, h) =>
      String.fromCharCode(parseInt(h, 16)),
    );
  }
}
