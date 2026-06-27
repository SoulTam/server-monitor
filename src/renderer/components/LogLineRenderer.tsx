import { Fragment } from 'react';
import {
  tokenizeJsonLine,
  tokenizePrettyJson,
  escapeJsonForHtml,
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

function renderPrettyObject(
  parsed: Record<string, unknown> | unknown[],
  lineIndex: number,
  kw: string | undefined,
  expandedKeys: Set<string>,
  onToggle: (lineIndex: number, keyIndex: number, next: boolean) => void,
): JSX.Element {
  const nestedMap = new Map<string, number>();
  let keyIdx = 0;

  if (Array.isArray(parsed)) {
    parsed.forEach((value, idx) => {
      if (typeof value === 'string' && isJsonLikeString(value)) {
        nestedMap.set(String(idx), keyIdx++);
      }
    });
  } else {
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'string' && isJsonLikeString(value)) {
        nestedMap.set(key, keyIdx++);
      }
    }
  }

  const pretty = JSON.stringify(parsed, null, 2);
  const prettyLines = tokenizePrettyJson(pretty);
  const elements: JSX.Element[] = [];

  prettyLines.forEach((pl, lineIdx) => {
    let currentKey: string | null = null;

    pl.tokens.forEach((tok) => {
      const elKey = elements.length;
      if (tok.kind === 'key') {
        currentKey = unescapeLiteral(tok.text);
        elements.push(
          <span key={elKey} className={styles.jsonKey}>
            {kw ? highlight(tok.text, kw) : tok.text}
          </span>,
        );
      } else if (tok.kind === 'string-value') {
        const unescaped = unescapeLiteral(tok.text);
        const ki = currentKey !== null ? nestedMap.get(currentKey) : undefined;
        const isNested = ki !== undefined && isJsonLikeString(unescaped);

        if (isNested) {
          elements.push(
            <NestedJsonValue
              key={elKey}
              rawValue={unescaped}
              keyName={tok.text.slice(0, 32)}
              lineIndex={lineIndex}
              keyIndex={ki}
              expanded={expandedKeys.has(`${lineIndex}:${ki}`)}
              onToggle={(next) => onToggle(lineIndex, ki, next)}
            />,
          );
        } else {
          elements.push(
            <span key={elKey} className={styles.jsonString}>
              {kw ? highlight(escapeJsonForHtml(tok.text), kw) : tok.text}
            </span>,
          );
        }
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
      elements.push(<br key={`br${lineIdx}`} />);
    }
  });

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
            {kw ? highlight(escapeJsonForHtml(inner), kw) : inner}
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
          {kw ? highlight(escapeJsonForHtml(tok.text), kw) : tok.text}
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

  const trimmed = rawLine.trim();
  if (trimmed.length > 0 && (trimmed[0] === '{' || trimmed[0] === '[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') {
        return renderPrettyObject(parsed, lineIndex, kw, expandedKeys, onToggle);
      }
    } catch {
      /* fall through */
    }
  }

  return renderTokenizedLine(rawLine, lineIndex, kw, expandedKeys, onToggle);
}
