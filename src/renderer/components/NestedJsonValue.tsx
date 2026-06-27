import { useMemo } from 'react';
import { Button, message } from 'antd';
import {
  isJsonLikeString,
  prettyJsonString,
  escapeJsonForHtml,
} from '../utils/nested-json';
import styles from './NestedJsonValue.module.css';

export interface NestedJsonValueProps {
  rawValue: string;
  keyName: string;
  lineIndex: number;
  keyIndex: number;
  expanded: boolean;
  onToggle: (next: boolean) => void;
}

async function copy(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 回退到 textarea + execCommand
  }
  if (typeof document === 'undefined') return false;
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export default function NestedJsonValue(props: NestedJsonValueProps): JSX.Element {
  const { rawValue, keyName, expanded, onToggle } = props;
  const detected = useMemo(() => isJsonLikeString(rawValue), [rawValue]);
  const pretty = useMemo(() => prettyJsonString(rawValue), [rawValue]);
  const charCount = useMemo(() => {
    if (!detected) return rawValue.length;
    try {
      const parsed = JSON.parse(rawValue);
      return JSON.stringify(parsed, null, 2).length;
    } catch {
      return rawValue.length;
    }
  }, [rawValue, detected]);

  const handleCopyRaw = async (): Promise<void> => {
    const ok = await copy(rawValue);
    if (ok) message.success('复制成功');
    else message.error('复制失败');
  };

  const handleCopyPretty = async (): Promise<void> => {
    if (pretty === null) {
      message.error('内层 JSON 解析失败');
      return;
    }
    const ok = await copy(pretty);
    if (ok) message.success('复制成功');
    else message.error('复制失败');
  };

  if (!detected) {
    return (
      <span className={styles.fallback} aria-label={`${keyName} 不是合法 JSON`}>
        {escapeJsonForHtml(rawValue)}
      </span>
    );
  }

  if (!expanded) {
    return (
      <button
        type="button"
        className={styles.fold}
        aria-label={`展开嵌套 JSON ${keyName}`}
        aria-expanded={false}
        onClick={() => onToggle(true)}
      >
        <span className={styles.foldArrow}>▶</span>
        <span className={styles.foldLabel}>nested JSON ({charCount} chars)</span>
      </button>
    );
  }

  return (
    <span role="region" className={styles.popupWrap} aria-label={`嵌套 JSON 预览 ${keyName}`}>
      <div className={styles.toolbar}>
        <Button
          size="small"
          type="default"
          aria-label="收起"
          onClick={() => onToggle(false)}
        >
          × 收起
        </Button>
        <Button
          size="small"
          type="default"
          aria-label="复制 raw"
          onClick={handleCopyRaw}
        >
          复制 raw
        </Button>
        <Button
          size="small"
          type="default"
          aria-label="复制 pretty"
          onClick={handleCopyPretty}
        >
          复制 pretty
        </Button>
      </div>
      <pre className={styles.pretty}>
        <code>{pretty ?? '内层 JSON 解析失败'}</code>
      </pre>
    </span>
  );
}
