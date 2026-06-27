import { describe, it, expect } from 'vitest';
import {
  isJsonLikeString,
  prettyJsonString,
  tokenizeJsonLine,
  escapeJsonForHtml,
  tokenizePrettyJson,
  type JsonToken,
} from '../src/renderer/utils/nested-json';

function findTokens(tokens: JsonToken[], predicate: (t: JsonToken) => boolean): JsonToken[] {
  return tokens.filter(predicate);
}

describe('isJsonLikeString', () => {
  it('detects JSON object', () => {
    expect(isJsonLikeString('{"a":1}')).toBe(true);
  });

  it('detects JSON array', () => {
    expect(isJsonLikeString('[1,2,3]')).toBe(true);
  });

  it('rejects plain text', () => {
    expect(isJsonLikeString('plain text')).toBe(false);
  });

  it('accepts leading/trailing whitespace', () => {
    expect(isJsonLikeString('   {"a":1}\n')).toBe(true);
  });

  it('rejects number-as-string', () => {
    expect(isJsonLikeString('123')).toBe(false);
  });

  it('rejects invalid JSON', () => {
    expect(isJsonLikeString('{not json')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isJsonLikeString('')).toBe(false);
    expect(isJsonLikeString('   ')).toBe(false);
  });

  it('rejects primitives', () => {
    expect(isJsonLikeString('"abc"')).toBe(false);
    expect(isJsonLikeString('true')).toBe(false);
    expect(isJsonLikeString('null')).toBe(false);
  });
});

describe('prettyJsonString', () => {
  it('formats simple object with 2-space indent', () => {
    const result = prettyJsonString('{"a":1,"b":"x"}');
    expect(result).toBe('{\n  "a": 1,\n  "b": "x"\n}');
  });

  it('returns null on invalid JSON', () => {
    expect(prettyJsonString('{not json')).toBeNull();
  });

  it('formats nested-object-via-string without unescaping at outer layer', () => {
    const raw = '{"context":"{\\"userId\\":123}"}';
    const outer = prettyJsonString(raw);
    expect(outer).toBe('{\n  "context": "{\\"userId\\":123}"\n}');
  });

  it('pretty of quoted primitive returns stringified result (not null)', () => {
    expect(prettyJsonString('"hello"')).toBe('"hello"');
  });
});

describe('tokenizeJsonLine', () => {
  it('returns plain token for non-JSON line', () => {
    const tokens = tokenizeJsonLine('2024-01-01 hello world');
    expect(tokens).toEqual([{ kind: 'plain', text: '2024-01-01 hello world' }]);
  });

  it('returns plain token for empty string', () => {
    expect(tokenizeJsonLine('')).toEqual([{ kind: 'plain', text: '' }]);
  });

  it('tokenizes a trivial JSON line', () => {
    const tokens = tokenizeJsonLine('{"a":1,"b":"x"}');
    const keys = findTokens(tokens, t => t.kind === 'key').map(t => t.text);
    const vals = findTokens(tokens, t => t.kind === 'string-value').map(t => t.text);
    expect(keys).toEqual(['"a"', '"b"']);
    expect(vals).toEqual(['1', '"x"']);
    const puncts = findTokens(tokens, t => t.kind === 'punct').map(t => t.text);
    expect(puncts).toContain(',');
  });

  it('marks nested JSON strings with nested=true and charCount', () => {
    const tokens = tokenizeJsonLine('{"context":"{\\"userId\\":123}"}');
    const nested = tokens.find(
      t => t.kind === 'string-value' && t.nested === true,
    ) as Extract<JsonToken, { kind: 'string-value' }> | undefined;
    expect(nested).toBeTruthy();
    expect(nested!.charCount).toBe('{"userId":123}'.length);
    expect(nested!.text).toBe('"{\\"userId\\":123}"');
    expect(nested!.valueKeyIndex).toBe(0);
  });

  it('does not mark non-nested strings as nested', () => {
    const tokens = tokenizeJsonLine('{"msg":"hello"}');
    const v = tokens.find(t => t.kind === 'string-value') as Extract<JsonToken, { kind: 'string-value' }>;
    expect(v.nested).toBeUndefined();
    expect(v.charCount).toBeUndefined();
  });

  it('depth=1: outer key tracks nested but inner string fields are NOT marked nested', () => {
    const line = '{"outer":"{\\"a\\":\\"{\\\\\\"b\\\\\\":1}\\"}"}';
    const tokens = tokenizeJsonLine(line);
    const nestedFlags = tokens
      .filter(t => t.kind === 'string-value')
      .map(t => (t as Extract<JsonToken, { kind: 'string-value' }>).nested);
    expect(nestedFlags.filter(Boolean).length).toBe(1);
  });

  it('handles bracketed value (object value) by emitting a single string-value chunk (not nested)', () => {
    const tokens = tokenizeJsonLine('{"data":{"k":1},"after":"x"}');
    const values = tokens.filter(
      t => t.kind === 'string-value',
    ) as Array<Extract<JsonToken, { kind: 'string-value' }>>;
    expect(values.length).toBe(2);
    expect(values[0].text.startsWith('{')).toBe(true);
    expect(values[0].nested).toBeFalsy();
    expect(values[1].text).toBe('"x"');
  });

  it('handles numeric/bool/null values', () => {
    const tokens = tokenizeJsonLine('{"a":true,"b":null,"c":42}');
    const values = tokens.filter(t => t.kind === 'string-value').map(t => t.text);
    expect(values).toEqual(['true', 'null', '42']);
  });

  it('does not unescape raw text in tokens (raw preserved)', () => {
    const line = '{"k":"a\\"b"}';
    const tokens = tokenizeJsonLine(line);
    const s = tokens.find(t => t.kind === 'string-value') as Extract<JsonToken, { kind: 'string-value' }>;
    expect(s.text).toBe('"a\\"b"');
  });
});

describe('escapeJsonForHtml', () => {
  it('escapes all five chars', () => {
    const AMP = '\u0026' + 'amp;';
    const LT = '\u0026' + 'lt;';
    const GT = '\u0026' + 'gt;';
    const QUOT = '\u0026' + 'quot;';
    const APOS = '\u0026' + '#39;';
    const expected = AMP + LT + GT + QUOT + APOS;
    const input = '\u0026' + '\u003c' + '\u003e' + '"' + "'";
    expect(escapeJsonForHtml(input)).toBe(expected);
  });

  it('keeps newlines intact', () => {
    expect(escapeJsonForHtml('a\nb\tc')).toBe('a\nb\tc');
  });

  it('returns empty string on empty input', () => {
    expect(escapeJsonForHtml('')).toBe('');
  });
});

describe('perf sanity (tokenize)', () => {
  it('tokenizes a 16KB-ish single JSON line under 30ms', () => {
    const innerCount = 600;
    const obj: Record<string, string> = {};
    for (let i = 0; i < innerCount; i++) obj[`k${i}`] = `v${i}`;
    const raw = JSON.stringify(obj);
    expect(raw.length).toBeGreaterThan(8000);
    const t0 = Date.now();
    const tokens = tokenizeJsonLine(raw);
    const dt = Date.now() - t0;
    expect(tokens.length).toBeGreaterThan(0);
    expect(dt).toBeLessThan(30);
  });
});

describe('nested detection regression (real-world log line)', () => {
  it('detects requestPayload as nested when log is single-line raw', () => {
    const raw =
      '{"level":30,"time":"2026-06-27T09:23:35.245+08:00","requestId":"41AZHkIGoV","userId":"cmo0vj8080088o9m33wl7br08","queueMode":true,"requestPayload":"{\\"prompt\\":\\"皮床电商详情场景\\",\\"mode\\":\\"image-to-image\\",\\"referenceImageUrls\\":[\\"u1\\",\\"u2\\",\\"u3\\",\\"u4\\"],\\"referencePolicy\\":\\"normalize\\"}","msg":"[generation/jobs] create request received"}';
    const tokens = tokenizeJsonLine(raw);
    const nested = tokens.filter((t) => t.kind === 'string-value' && t.nested === true);
    expect(nested.length).toBe(1);
    const inner = JSON.parse((nested[0] as { text: string }).text);
    expect(isJsonLikeString(inner)).toBe(true);
    const parsed = JSON.parse(inner);
    expect(parsed.prompt).toBe('皮床电商详情场景');
    expect(parsed.referenceImageUrls).toEqual(['u1', 'u2', 'u3', 'u4']);
  });

  it('handles \\u inside nested JSON string', () => {
    const raw = '{"a":1,"data":"{\\"x\\":\\"\\u4e2d\\u6587\\",\\"y\\":[1,2]}","end":"x"}';
    const tokens = tokenizeJsonLine(raw);
    const ns = tokens.find((t) => t.kind === 'string-value' && t.nested === true);
    expect(ns).toBeTruthy();
    const inner = JSON.parse((ns as { text: string }).text);
    expect(JSON.parse(inner).x).toBe('中文');
    expect(JSON.parse(inner).y).toEqual([1, 2]);
  });

  it('partial JSON line (single-line tokenize) falls back to plain', () => {
    // Documents that when content is already pretty-printed line-by-line,
    // each individual line is partial JSON so per-line tokenize returns plain.
    // The ServerDetailPage integration must NOT pre-pretty per-line.
    const prettyLine = '  "requestPayload": "{\\"prompt\\":\\"皮床\\"}",';
    expect(tokenizeJsonLine(prettyLine)).toEqual([{ kind: 'plain', text: prettyLine }]);
  });
});

describe('pretty-print + nested detection integration', () => {
  it('detects nested JSON in pretty-printed outer object via unescaped string-value token', () => {
    const raw =
      '{"level":30,"time":"2026-06-27T09:23:35.245+08:00","requestId":"41AZHkIGoV","requestPayload":"{\\"prompt\\":\\"皮床\\",\\"mode\\":\\"image-to-image\\"}","msg":"hello"}';
    const parsed = JSON.parse(raw);
    const pretty = JSON.stringify(parsed, null, 2);
    const lines = tokenizePrettyJson(pretty);

    // Find the line containing 'requestPayload'
    const reqLine = lines.find((l) => l.raw.includes('requestPayload'));
    expect(reqLine).toBeTruthy();

    // The string-value token on that line should be the nested JSON
    const svToken = reqLine!.tokens.find((t) => t.kind === 'string-value');
    expect(svToken).toBeTruthy();

    // Check roundtrip
    const joined = ' '.repeat(reqLine!.indent) + reqLine!.tokens.map((t) => t.text).join('');
    expect(joined).toBe(reqLine!.raw);

    // Unescaped value should be JSON-like
    const unescaped = JSON.parse(svToken!.text);
    expect(isJsonLikeString(unescaped)).toBe(true);

    const inner = JSON.parse(unescaped);
    expect(inner.prompt).toBe('皮床');
    expect(inner.mode).toBe('image-to-image');
  });

  it('handles rawRequestPayload key: pretty-print + tokenizePrettyJson works', () => {
    const raw =
      '{"level":30,"rawRequestPayload":"{\\"level\\":30,\\"data\\":{\\"x\\":1}}","msg":"finished"}';
    const parsed = JSON.parse(raw);
    const pretty = JSON.stringify(parsed, null, 2);
    const lines = tokenizePrettyJson(pretty);

    const reqLine = lines.find((l) => l.raw.includes('rawRequestPayload'));
    expect(reqLine).toBeTruthy();

    const svToken = reqLine!.tokens.find((t) => t.kind === 'string-value');
    expect(svToken).toBeTruthy();

    const unescaped = JSON.parse(svToken!.text);
    expect(isJsonLikeString(unescaped)).toBe(true);

    const inner = JSON.parse(unescaped);
    expect(inner.level).toBe(30);
    expect(inner.data.x).toBe(1);
  });
});

describe('tokenizePrettyJson (弹层行级高亮)', () => {
  it('simple object — preserves roundtrip and emits key/number/string/punct', () => {
    const pretty = JSON.stringify({ a: 1, b: 'x' }, null, 2);
    const lines = tokenizePrettyJson(pretty);
    expect(lines.length).toBe(4);
    const kindsAll = lines.flatMap((l) => l.tokens.map((t) => t.kind));
    expect(kindsAll).toContain('key');
    expect(kindsAll).toContain('number');
    expect(kindsAll).toContain('string-value');
    expect(kindsAll).toContain('punct');
    // roundtrip: each token text concatenates back to raw (after re-applying indent)
    for (const line of lines) {
      const joined = ' '.repeat(line.indent) + line.tokens.map((t) => t.text).join('');
      expect(joined).toBe(line.raw);
    }
  });

  it('array [1, null, true] — number/null/boolean all detected', () => {
    const pretty = JSON.stringify([1, null, true], null, 2);
    const lines = tokenizePrettyJson(pretty);
    const kinds = lines.flatMap((l) => l.tokens.map((t) => t.kind));
    expect(kinds).toContain('number');
    expect(kinds).toContain('null');
    expect(kinds).toContain('boolean');
  });

  it('indent count is correct for nested levels', () => {
    const pretty = JSON.stringify({ outer: { inner: 1 } }, null, 2);
    const lines = tokenizePrettyJson(pretty);
    expect(lines[0].indent).toBe(0);                // {
    expect(lines[1].indent).toBe(2);                //   "outer": {
    expect(lines[2].indent).toBe(4);                //     "inner": 1
  });

  it('empty input → empty output, single-line { } → both lines', () => {
    expect(tokenizePrettyJson('')).toEqual([]);
    const lines = tokenizePrettyJson('{}');
    expect(lines.length).toBe(1);
    // TextContent join has space-padded { } wrap around
    expect(lines[0].raw).toBe('{}');
  });

  it('multi-keys line: string literal followed by colon is recognized as key', () => {
    const pretty = JSON.stringify({ 'a-key': 'value', 'noColon': 'value2' }, null, 2);
    const lines = tokenizePrettyJson(pretty);
    const keysTokens = lines
      .flatMap((l) => l.tokens)
      .filter((t) => t.kind === 'key')
      .map((t) => t.text);
    expect(keysTokens.length).toBe(2);
    expect(keysTokens[0]).toBe('"a-key"');
    expect(keysTokens[1]).toBe('"noColon"');
  });

  it('real-world nested payload from user log', () => {
    const inner = {
      prompt: '皮床电商详情场景',
      mode: 'image-to-image',
      model: '45',
      referenceImageUrls: [
        'https://huabu-art.oss-cn-hangzhou.aliyuncs.com/creative_project/20260626/cmqu9ygva00eqgqm3vre28qfz/6be026d1-df30-4d49-8c6e-b1b2d135f6a1.png',
        'https://huabu-art.oss-cn-hangzhou.aliyuncs.com/creative_project/20260626/cmqu9ygva00eqgqm3vre28qfz/40fe3f2e-409c-4be9-b208-0ac2e3aebb18.png',
        'https://huabu-art.oss-cn-hangzhou.aliyuncs.com/creative_project/20260626/cmqu9ygva00eqgqm3vre28qfz/660d8595-8f00-4390-b4fc-4ff83511dae1.png',
        'https://huabu-art.oss-cn-hangzhou.aliyuncs.com/creative_project/20260626/cmqu9ygva00eqgqm3vre28qfz/c43766f3-764c-4ecc-af8f-c7745923660a.png',
      ],
      referencePolicy: 'normalize',
    };
    const pretty = prettyJsonString(JSON.stringify(inner));
    const lines = tokenizePrettyJson(pretty ?? '');
    // roundtrip
    for (const line of lines) {
      const joined = ' '.repeat(line.indent) + line.tokens.map((t) => t.text).join('');
      expect(joined).toBe(line.raw);
    }
    expect(lines.length).toBeGreaterThan(5);
    const stringCount = lines
      .flatMap((l) => l.tokens)
      .filter((t) => t.kind === 'string-value').length;
    expect(stringCount).toBeGreaterThanOrEqual(5);
  });
});
