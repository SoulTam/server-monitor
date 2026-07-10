import { Fragment } from 'react';
import { Popover, Button, message } from 'antd';
import {
  tokenizeJsonLine,
  tokenizePrettyJson,
  isJsonLikeString,
} from '../utils/nested-json';
import NestedJsonValue from './NestedJsonValue';
import styles from './LogLineRenderer.module.css';

export interface LogLineRendererProps {
  rawLine: string;
  lineIndex: number;
  highlight?: string;
  expandedKeys: Set<string>;
  onToggle: (lineIndex: number, keyIndex: number, next: boolean) => void;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function unescapeLiteral(s: string): string {
  if (s.startsWith('"') && s.endsWith('"')) {
    try {
      return JSON.parse(s);
    } catch {
      /* fallthrough */
    }
  }
  return s;
}

function highlight(text: string, keyword: string): JSX.Element[] {
  if (!keyword) return [<Fragment key="0">{text}</Fragment>];
  const re = new RegExp(escapeRegExp(keyword), 'g');
  const out: JSX.Element[] = [];
  let last = 0;
  let idx = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      out.push(<Fragment key={`p${idx++}`}>{text.slice(last, m.index)}</Fragment>);
    }
    out.push(
      <mark key={`m${idx++}`} className={styles.mark}>
        {m[0]}
      </mark>,
    );
    last = m.index + m[0].length;
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  if (last < text.length) {
    out.push(<Fragment key={`p${idx++}`}>{text.slice(last)}</Fragment>);
  }
  return out;
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    message.success('复制成功');
  } catch {
    message.error('复制失败');
  }
}

function prettyFormat(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 4);
  } catch {
    return raw;
  }
}

function renderPopoverContent(rawValue: string): JSX.Element {
  const pretty = prettyFormat(rawValue);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginBottom: 4 }}>
        <Button
          size="small"
          type="link"
          onClick={(e) => { e.stopPropagation(); copyText(rawValue); }}
        >
          复制 raw
        </Button>
        <Button
          size="small"
          type="link"
          onClick={(e) => { e.stopPropagation(); copyText(pretty); }}
        >
          复制 pretty
        </Button>
      </div>
      <pre
        style={{
          margin: 0,
          fontSize: 12,
          lineHeight: 1.5,
          whiteSpace: 'pre',
          fontFamily: 'monospace',
          maxHeight: 360,
          overflow: 'auto',
        }}
      >
        {pretty}
      </pre>
    </div>
  );
}

interface JsonExtract {
  prefix: string;
  json: string;
  suffix: string;
  parsed: Record<string, unknown> | unknown[];
}

function extractFirstJson(line: string): JsonExtract | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const start = trimmed.search(/[{[]/);
  if (start < 0) return null;
  const prefix = trimmed.slice(0, start);
  const openCh = trimmed[start];
  const closeCh = openCh === '{' ? '}' : ']';
  let depth = 0;
  let inStr = false;
  let inEsc = false;
  let end = start;
  for (let i = start; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (inEsc) { inEsc = false; continue; }
    if (ch === '\\' && inStr) { inEsc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === openCh) depth++;
    if (ch === closeCh) {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  if (depth !== 0) return null;
  const json = trimmed.slice(start, end);
  const suffix = trimmed.slice(end);
  let parsed: unknown;
  try { parsed = JSON.parse(json); } catch { return null; }
  if (!parsed || typeof parsed !== 'object') return null;
  return { prefix, json, suffix, parsed: parsed as Record<string, unknown> | unknown[] };
}

function renderPrettyObject(
  parsed: Record<string, unknown> | unknown[],
  prefix: string,
  suffix: string,
  lineIndex: number,
  kw: string | undefined,
  _expandedKeys: Set<string>,
  _onToggle: (lineIndex: number, keyIndex: number, next: boolean) => void,
): JSX.Element {
  const pretty = JSON.stringify(parsed, null, 4);
  const prettyLines = tokenizePrettyJson(pretty);
  const elements: JSX.Element[] = [];
  const obj = parsed as Record<string, unknown>;

  if (prefix) {
    elements.push(
      <span key={elements.length} className={styles.jsonPlain}>
        {kw ? highlight(prefix, kw) : prefix}
      </span>,
    );
  }

  prettyLines.forEach((pl, lineIdx) => {
    let currentKey: string | null = null;

    if (pl.indent > 0) {
      elements.push(<span key={elements.length}>{' '.repeat(pl.indent)}</span>);
    }

    pl.tokens.forEach((tok) => {
      const elKey = elements.length;
      if (tok.kind === 'key') {
        currentKey = unescapeLiteral(tok.text);
        const value = currentKey !== null ? obj[currentKey] : undefined;
        const isNested = typeof value === 'string' && isJsonLikeString(value);

        if (isNested) {
          elements.push(
            <Popover
              key={elKey}
              content={renderPopoverContent(value as string)}
              trigger="hover"
              placement="right"
              mouseEnterDelay={0.3}
              mouseLeaveDelay={0.1}
              destroyTooltipOnHide
              overlayInnerStyle={{ padding: '6px 10px', maxWidth: 480 }}
            >
              <span className={styles.jsonKeyHover}>
                {kw ? highlight(tok.text, kw) : tok.text}
              </span>
            </Popover>,
          );
        } else {
          elements.push(
            <span key={elKey} className={styles.jsonKey}>
              {kw ? highlight(tok.text, kw) : tok.text}
            </span>,
          );
        }
      } else if (tok.kind === 'string-value') {
        elements.push(
          <span key={elKey} className={styles.jsonString}>
            {kw ? highlight(tok.text, kw) : tok.text}
          </span>,
        );
      } else if (tok.kind === 'number') {
        elements.push(
          <span key={elKey} className={styles.jsonNumber}>
            {kw ? highlight(tok.text, kw) : tok.text}
          </span>,
        );
      } else if (tok.kind === 'boolean') {
        elements.push(
          <span key={elKey} className={styles.jsonBoolean}>
            {kw ? highlight(tok.text, kw) : tok.text}
          </span>,
        );
      } else if (tok.kind === 'null') {
        elements.push(
          <span key={elKey} className={styles.jsonNull}>
            {kw ? highlight(tok.text, kw) : tok.text}
          </span>,
        );
      } else if (tok.kind === 'punct') {
        elements.push(
          <span key={elKey} className={styles.jsonPunct}>
            {tok.text}
          </span>,
        );
      } else if (tok.kind === 'space') {
        elements.push(
          <span key={elKey}>{tok.text}</span>,
        );
      }
    });

    if (lineIdx < prettyLines.length - 1) {
      elements.push(<br key={elements.length} />);
    }
  });

  if (suffix) {
    elements.push(
      <span key={elements.length} className={styles.jsonPlain}>
        {kw ? highlight(suffix, kw) : suffix}
      </span>,
    );
  }

  return <div className={styles.line}>{elements}</div>;
}

function renderTokenizedLine(
  rawLine: string,
  lineIndex: number,
  kw: string | undefined,
  expandedKeys: Set<string>,
  onToggle: (lineIndex: number, keyIndex: number, next: boolean) => void,
): JSX.Element {
  const tokens = tokenizeJsonLine(rawLine);
  if (tokens.length === 1 && tokens[0].kind === 'plain') {
    return (
      <pre className={styles.line}>
        <code>{kw ? highlight(rawLine, kw) : rawLine}</code>
      </pre>
    );
  }

  const expandKeyOf = (keyIndex: number): string => `${lineIndex}:${keyIndex}`;
  const elements: JSX.Element[] = [];
  let keyCounter = 0;

  tokens.forEach((tok, idx) => {
    if (tok.kind === 'key') {
      elements.push(
        <span key={`k${idx}`} className={styles.jsonKey}>
          {kw ? highlight(tok.text, kw) : tok.text}
        </span>,
      );
    } else if (tok.kind === 'punct') {
      elements.push(
        <span key={`p${idx}`} className={styles.jsonPunct}>
          {tok.text}
        </span>,
      );
    } else if (tok.kind === 'string-value') {
      const inner = tok.text;
      const isNested = tok.nested === true;
      const innerUnescaped: string = unescapeLiteral(inner);
      const detectedForThisChunk = isNested && isJsonLikeString(innerUnescaped);

      if (detectedForThisChunk) {
        const keyIndex = tok.valueKeyIndex ?? keyCounter;
        keyCounter = Math.max(keyCounter, keyIndex + 1);
        const expandKey = expandKeyOf(keyIndex);
        elements.push(
          <NestedJsonValue
            key={`njv${idx}`}
            rawValue={innerUnescaped}
            keyName={tok.text.slice(0, 32)}
            lineIndex={lineIndex}
            keyIndex={keyIndex}
            expanded={expandedKeys.has(expandKey)}
            onToggle={(next) => onToggle(lineIndex, keyIndex, next)}
          />,
        );
      } else {
        elements.push(
          <span
            key={`s${idx}`}
            className={isNested ? styles.jsonStringNested : styles.jsonString}
          >
            {kw ? highlight(inner, kw) : inner}
          </span>,
        );
        if (tok.valueKeyIndex !== undefined) {
          keyCounter = Math.max(keyCounter, tok.valueKeyIndex + 1);
        } else {
          keyCounter++;
        }
      }
    } else {
      elements.push(
        <span key={`pl${idx}`} className={styles.jsonPlain}>
          {kw ? highlight(tok.text, kw) : tok.text}
        </span>,
      );
    }
  });

  return <div className={styles.line}>{elements}</div>;
}

export default function LogLineRenderer(props: LogLineRendererProps): JSX.Element {
  const { rawLine, lineIndex, highlight: kw, expandedKeys, onToggle } = props;

  if (typeof rawLine !== 'string') {
    return (
      <pre className={styles.line}>
        <code>{String(rawLine)}</code>
      </pre>
    );
  }

  const jsonExtract = extractFirstJson(rawLine);
  if (jsonExtract) {
    return renderPrettyObject(
      jsonExtract.parsed,
      jsonExtract.prefix,
      jsonExtract.suffix,
      lineIndex,
      kw,
      expandedKeys,
      onToggle,
    );
  }

  return renderTokenizedLine(rawLine, lineIndex, kw, expandedKeys, onToggle);
}
