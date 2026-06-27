import { describe, it, expect } from 'vitest';
import {
  isJsonLikeString,
  prettyJsonString,
  tokenizeJsonLine,
  escapeJsonForHtml,
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
