import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Space, Tag, message, Segmented, Modal, Input, List, Spin } from 'antd';
import { ArrowLeftOutlined, PlayCircleOutlined, PauseCircleOutlined, CloseOutlined, ArrowUpOutlined, ArrowDownOutlined, VerticalAlignBottomOutlined } from '@ant-design/icons';
import TrendChart from '../components/TrendChart';
import RealtimeBar from '../components/RealtimeBar';
import LogLineRenderer from '../components/LogLineRenderer';
import { useMonitorStore } from '../stores/monitorStore';
import type { ServerWithMetrics } from '../../shared/ipc-types';
import type { MetricType, MetricRecord } from '../../shared/types';

type TimeRange = '1h' | '6h' | '24h' | '7d';

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(1)}${units[i]}`;
}

function parseDiskDetails(details?: string): { used: number; total: number } | null {
  if (!details) return null;
  try {
    const d = JSON.parse(details);
    if (typeof d.used === 'number' && typeof d.total === 'number') return d;
  } catch { /* ignore */ }
  return null;
}

export default function ServerDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [server, setServer] = useState<ServerWithMetrics | null>(null);
  const [logsModalVisible, setLogsModalVisible] = useState(false);
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [logsList, setLogsList] = useState<{ fullPath: string; name: string }[]>([]);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [logContent, setLogContent] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const CHUNK_SIZE = 65536;
  const logOffsetRef = useRef(0);
  const hasMoreRef = useRef(true);
  const loadingRef = useRef(false);
  const selectedFilePathRef = useRef<string | null>(null);
  const logContentRef = useRef<HTMLDivElement>(null);
  const [readingFromEnd, setReadingFromEnd] = useState(false);
  const readingFromEndRef = useRef(false);
  const loadedLinesFromEndRef = useRef(0);
  const TAIL_LINES = 500;
  const [searchKeyword, setSearchKeyword] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const [leftWidth, setLeftWidth] = useState(320);
  const [isDragging, setIsDragging] = useState(false);
  const modalBodyRef = useRef<HTMLDivElement>(null);
  const [isLogMaximized, setIsLogMaximized] = useState(false);
  const [configPathInput, setConfigPathInput] = useState('');
  const [timeRange, setTimeRange] = useState<TimeRange>('1h');
  const [historyData, setHistoryData] = useState<Record<MetricType, MetricRecord[]>>({
    cpu: [], memory: [], disk: [], network: [],
  });
  const realtime = useMonitorStore((s) => (id ? s.realtimeByServer[id] : undefined));
  const [expandedNestedKeys, setExpandedNestedKeys] = useState<Set<string>>(new Set());
  const lines = useMemo<string[]>(() => (logContent ? logContent.split('\n') : []), [logContent]);
  const matchPositions = useMemo<number[]>(() => {
    if (!debouncedSearch || lines.length === 0) return [];
    return lines.reduce<number[]>((acc, line, idx) => {
      if (line.includes(debouncedSearch)) acc.push(idx);
      return acc;
    }, []);
  }, [debouncedSearch, lines]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
  const autoPositionRef = useRef(true);

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setExpandedNestedKeys((prev) => (prev.size > 0 ? new Set() : prev));
      }
    };
    document.addEventListener('keydown', handler);
    return (): void => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (!id) return;
    window.electronAPI.server.getDetail(id).then((res) => {
      if (res.success && res.data) setServer(res.data as ServerWithMetrics);
    });
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const types: MetricType[] = ['cpu', 'memory', 'disk', 'network'];
    Promise.all(
      types.map((t) =>
        window.electronAPI.monitor.getHistory({ serverId: id, metricType: t, timeRange }),
      ),
    ).then((results) => {
      const data: Record<MetricType, MetricRecord[]> = { cpu: [], memory: [], disk: [], network: [] };
      types.forEach((t, i) => {
        if (results[i].success && Array.isArray(results[i].data)) {
          data[t] = results[i].data as MetricRecord[];
        }
      });
      setHistoryData(data);
    });
  }, [id, timeRange]);

  useEffect(() => {
    if (!id) return;
    const unsubscribe = window.electronAPI.monitor.onMetrics((metrics) => {
      useMonitorStore.getState().pushRealtime(metrics);
      if (metrics.serverId !== id) return;

      const ts = metrics.timestamp || new Date().toISOString();
      setHistoryData((prev) => {
        const next: Record<MetricType, MetricRecord[]> = { ...prev };

        if (metrics.cpu !== undefined) {
          const records = prev.cpu;
          const last = records[records.length - 1];
          if (!last || Math.abs(new Date(ts).getTime() - new Date(last.timestamp).getTime()) >= 3000) {
            next.cpu = [...records, { id: '', serverId: id, metricType: 'cpu' as MetricType, value: metrics.cpu, timestamp: ts }];
          } else {
            next.cpu = [...records.slice(0, -1), { ...last, value: metrics.cpu, timestamp: ts }];
          }
        }

        if (metrics.memory !== undefined) {
          const records = prev.memory;
          const last = records[records.length - 1];
          if (!last || Math.abs(new Date(ts).getTime() - new Date(last.timestamp).getTime()) >= 3000) {
            next.memory = [...records, { id: '', serverId: id, metricType: 'memory' as MetricType, value: metrics.memory, timestamp: ts }];
          } else {
            next.memory = [...records.slice(0, -1), { ...last, value: metrics.memory, timestamp: ts }];
          }
        }

        if (metrics.disk !== undefined) {
          const records = prev.disk;
          const last = records[records.length - 1];
          const details = metrics.diskUsed !== undefined && metrics.diskTotal !== undefined
            ? JSON.stringify({ used: metrics.diskUsed, total: metrics.diskTotal })
            : undefined;
          if (!last || Math.abs(new Date(ts).getTime() - new Date(last.timestamp).getTime()) >= 3000) {
            next.disk = [...records, { id: '', serverId: id, metricType: 'disk' as MetricType, value: metrics.disk, details, timestamp: ts }];
          } else {
            next.disk = [...records.slice(0, -1), { ...last, value: metrics.disk, details, timestamp: ts }];
          }
        }

        if (metrics.networkUp !== undefined && metrics.networkDown !== undefined) {
          const records = prev.network;
          const last = records[records.length - 1];
          if (!last || Math.abs(new Date(ts).getTime() - new Date(last.timestamp).getTime()) >= 3000) {
            next.network = [...records, { id: '', serverId: id, metricType: 'network' as MetricType, value: metrics.networkUp + metrics.networkDown, timestamp: ts }];
          } else {
            next.network = [...records.slice(0, -1), { ...last, value: metrics.networkUp + metrics.networkDown, timestamp: ts }];
          }
        }

        return next;
      });
    });
    return unsubscribe;
  }, [id]);

  const handleStart = async (): Promise<void> => {
    if (!id) return;
    const res = await window.electronAPI.monitor.start(id);
    if (res.success) {
      message.success('监控已启动');
      setServer((s) => s ? { ...s, status: 'monitoring' } : s);
    } else {
      message.error(res.error || '启动失败');
    }
  };

  const handleStop = async (): Promise<void> => {
    if (!id) return;
    const res = await window.electronAPI.monitor.stop(id);
    if (res.success) {
      message.success('监控已停止');
      setServer((s) => s ? { ...s, status: 'idle' } : s);
    } else {
      message.error(res.error || '停止失败');
    }
  };

  const handleOpenConfig = (): void => {
    setConfigPathInput(server?.logsPath || '');
    setConfigModalVisible(true);
  };

  const handleSaveConfig = async (): Promise<void> => {
    if (!id) return;
    const res = await window.electronAPI.server.update({ id, logsPath: configPathInput } as any);
    if (res.success) {
      message.success('日志路径已保存');
      setServer((s) => s ? { ...s, logsPath: configPathInput } : s);
      setConfigModalVisible(false);
      if (logsModalVisible) {
        handleOpenLogs();
      }
    } else {
      message.error(res.error || '保存失败');
    }
  };

  const handleOpenLogs = async (): Promise<void> => {
    if (!id || !server) return;
    try {
      const res = await window.electronAPI.logs.list(id);
      if (res.success && Array.isArray(res.data)) {
        const items = (res.data as string[])
          .map(fp => ({ fullPath: fp, name: fp.replace(/\\/g, '/').split('/').pop() || fp }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setLogsList(items);
        setLogsModalVisible(true);
        setLogContent('');
        setSelectedFilePath(null);
        hasMoreRef.current = true;
        setHasMore(true);
      } else {
        message.error(res.error || '无法列出日志');
      }
    } catch (e) {
      message.error('读取日志列表失败');
    }
  };

  const loadChunk = useCallback(async (filePath: string, offset: number): Promise<void> => {
    if (!id) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const res = await window.electronAPI.logs.read(id, filePath, offset, CHUNK_SIZE);
      if (res.success) {
        const chunk = res.data as string;
        if (chunk.length === 0) {
          hasMoreRef.current = false;
          setHasMore(false);
          loadingRef.current = false;
          setLoading(false);
          return;
        }
        setLogContent(prev => prev + chunk);
        const bytes = new TextEncoder().encode(chunk).length;
        logOffsetRef.current = offset + bytes;
        setExpandedNestedKeys((prev) => (prev.size > 0 ? new Set() : prev));
      } else {
        message.error(res.error || '读取日志文件失败');
      }
    } catch (e) {
      message.error('读取日志文件失败');
    }
    loadingRef.current = false;
    setLoading(false);
  }, [id]);

  const scrollToBottom = (): void => {
    const el = logContentRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  };

  const handleReadLog = async (filePath: string): Promise<void> => {
    setSelectedFilePath(filePath);
    selectedFilePathRef.current = filePath;
    setLogContent('');
    logOffsetRef.current = 0;
    hasMoreRef.current = true;
    setHasMore(true);
    setSearchKeyword('');
    setDebouncedSearch('');
    setCurrentMatchIndex(-1);
    autoPositionRef.current = true;
    setExpandedNestedKeys(new Set());
    setReadingFromEnd(true);
    readingFromEndRef.current = true;
    loadedLinesFromEndRef.current = 0;
    const readRes = await window.electronAPI.logs.tail(id!, filePath, TAIL_LINES);
    if (readRes.success) {
      const chunk = readRes.data as string;
      if (chunk.length === 0) {
        hasMoreRef.current = false;
        setHasMore(false);
      } else {
        const lineCount = chunk.split('\n').filter(Boolean).length;
        setLogContent(chunk);
        loadedLinesFromEndRef.current = lineCount;
        // Scroll to bottom after initial tail load
        requestAnimationFrame(() => scrollToBottom());
      }
    } else {
      message.error(readRes.error || '读取日志文件失败');
    }
  };

  const loadEarlierChunk = useCallback(async (): Promise<void> => {
    if (!id || !selectedFilePathRef.current || !readingFromEndRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const el = logContentRef.current;
      const prevScrollHeight = el?.scrollHeight || 0;
      const res = await window.electronAPI.logs.tailMore(
        id, selectedFilePathRef.current, loadedLinesFromEndRef.current, TAIL_LINES,
      );
      if (res.success) {
        const chunk = (res.data as string).trimEnd();
        if (chunk.length === 0) {
          hasMoreRef.current = false;
          setHasMore(false);
          loadingRef.current = false;
          setLoading(false);
          return;
        }
        const newLines = chunk.split('\n').filter(Boolean).length;
        setLogContent(prev => chunk + '\n' + prev);
        loadedLinesFromEndRef.current += newLines;
        // Keep viewport stable after prepending — double rAF ensures DOM is updated
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const el2 = logContentRef.current;
            if (el2) el2.scrollTop += el2.scrollHeight - prevScrollHeight;
          });
        });
      }
    } catch (e) {
      message.error('加载更早日志失败');
    }
    loadingRef.current = false;
    setLoading(false);
  }, [id]);

  const handleJumpToLatest = (): void => {
    scrollToBottom();
    setReadingFromEnd(true);
    readingFromEndRef.current = true;
  };

  const handleContentScroll = (): void => {
    const el = logContentRef.current;
    if (!el || loadingRef.current) return;
    // Tail mode: scroll to top loads earlier content
    if (readingFromEndRef.current && el.scrollTop < 100 && hasMoreRef.current && selectedFilePathRef.current) {
      loadEarlierChunk();
      return;
    }
    // Default forward mode (from beginning): scroll near bottom loads next chunk
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 100 && hasMoreRef.current && !readingFromEndRef.current && selectedFilePathRef.current) {
      loadChunk(selectedFilePathRef.current, logOffsetRef.current);
    }
  };

  useEffect(() => {
    if (!debouncedSearch || !id || !selectedFilePathRef.current) return;
    autoPositionRef.current = true;
    setCurrentMatchIndex(-1);
    let active = true;
    const loadAll = async (): Promise<void> => {
      const filePath = selectedFilePathRef.current!;
      while (hasMoreRef.current && active) {
        const prevOffset = logOffsetRef.current;
        await loadChunk(filePath, logOffsetRef.current);
        if (logOffsetRef.current === prevOffset) break;
      }
    };
    loadAll();
    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, id]);

  useEffect(() => {
    if (!debouncedSearch || matchPositions.length === 0 || !autoPositionRef.current) return;
    autoPositionRef.current = false;
    setCurrentMatchIndex(matchPositions.length - 1);
  }, [debouncedSearch, matchPositions.length]);

  useEffect(() => {
    if (currentMatchIndex < 0 || matchPositions.length === 0) return;
    const lineIndex = matchPositions[currentMatchIndex];
    const el = logContentRef.current;
    if (!el) return;
    const target = el.querySelector(`[data-line-index="${lineIndex}"]`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentMatchIndex, matchPositions]);

  const goToPrevMatch = (): void => {
    autoPositionRef.current = false;
    setCurrentMatchIndex((prev) => {
      if (matchPositions.length === 0) return -1;
      if (prev <= 0) return matchPositions.length - 1;
      return prev - 1;
    });
  };

  const goToNextMatch = (): void => {
    autoPositionRef.current = false;
    setCurrentMatchIndex((prev) => {
      if (matchPositions.length === 0) return -1;
      if (prev >= matchPositions.length - 1) return 0;
      return prev + 1;
    });
  };

  const handleDividerMouseDown = (): void => {
    setIsDragging(true);
  };

  const handleNestedToggle = (lineIndex: number, keyIndex: number, next: boolean): void => {
    const k = `${lineIndex}:${keyIndex}`;
    setExpandedNestedKeys((prev) => {
      const ns = new Set(prev);
      if (next) ns.add(k);
      else ns.delete(k);
      return ns;
    });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const v = e.target.value;
    setSearchKeyword(v);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => setDebouncedSearch(v), 300);
  };

  const matchCount = useMemo(() => {
    if (!debouncedSearch || !logContent) return 0;
    const parts = logContent.split(debouncedSearch);
    return parts.length - 1;
  }, [debouncedSearch, logContent]);

  useEffect(() => {
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent): void => {
      if (!modalBodyRef.current) return;
      const rect = modalBodyRef.current.getBoundingClientRect();
      const newWidth = Math.max(200, Math.min(e.clientX - rect.left, rect.width - 300));
      setLeftWidth(newWidth);
    };
    const handleMouseUp = (): void => setIsDragging(false);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  if (!server) return <div>加载中...</div>;

  const statusTag: Record<string, JSX.Element> = {
    monitoring: <Tag color="success">监控中</Tag>,
    idle: <Tag>空闲</Tag>,
    error: <Tag color="error">异常</Tag>,
  };

  return (
    <>
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>返回</Button>
        <span style={{ fontWeight: 600, fontSize: 16 }}>{server.name}</span>
        <span style={{ color: '#999' }}>{server.ip}:{server.port}</span>
        {statusTag[server.status]}
        {server.status === 'monitoring' ? (
          <Button icon={<PauseCircleOutlined />} onClick={handleStop}>停止监控</Button>
        ) : (
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={handleStart}>启动监控</Button>
        )}
        {server.logsPath ? (
          <Button onClick={handleOpenLogs}>浏览日志</Button>
        ) : (
          <Button onClick={handleOpenConfig}>配置日志</Button>
        )}
      </Space>

      <RealtimeBar server={server} realtime={realtime} />

      {server.systemInfo && (
        <div style={{ display: 'flex', gap: 24, padding: '12px 16px', background: '#fff', borderRadius: 8, boxShadow: 'var(--shadow-card)', marginTop: 16, fontSize: 13, flexWrap: 'wrap' }}>
          {server.systemInfo.hostname && <span><strong>主机名:</strong> {server.systemInfo.hostname}</span>}
          {server.systemInfo.osInfo && <span><strong>系统:</strong> {server.systemInfo.osInfo}</span>}
          {server.systemInfo.kernel && <span><strong>内核:</strong> {server.systemInfo.kernel}</span>}
          {server.systemInfo.cpuModel && <span><strong>CPU:</strong> {server.systemInfo.cpuModel}</span>}
          {server.systemInfo.cpuCores && <span><strong>核心数:</strong> {server.systemInfo.cpuCores}</span>}
          {server.systemInfo.memoryTotal && <span><strong>内存:</strong> {(server.systemInfo.memoryTotal / 1024).toFixed(1)}GB</span>}
          {server.systemInfo.diskTotal && <span><strong>磁盘:</strong> {server.systemInfo.diskTotal}</span>}
        </div>
      )}

      <div style={{ margin: '16px 0' }}>
        <Segmented
          options={[
            { label: '1小时', value: '1h' },
            { label: '6小时', value: '6h' },
            { label: '24小时', value: '24h' },
            { label: '7天', value: '7d' },
          ]}
          value={timeRange}
          onChange={(v) => setTimeRange(v as TimeRange)}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <TrendChart title="CPU使用率" data={historyData.cpu} unit="%" color="#1677ff" threshold={server.cpuThreshold} timeRange={timeRange} />
        <TrendChart title="内存使用率" data={historyData.memory} unit="%" color="#52c41a" threshold={server.memoryThreshold} timeRange={timeRange} />
        <div>
          <TrendChart title="磁盘使用率" data={historyData.disk} unit="%" color="#faad14" threshold={server.diskThreshold} timeRange={timeRange} />
          {(() => {
            const latest = historyData.disk[historyData.disk.length - 1];
            const dd = latest?.details ? parseDiskDetails(latest.details) : null;
            if (!dd) return null;
            const pct = (dd.used / dd.total * 100).toFixed(1);
            return (
              <div style={{ fontSize: 12, color: '#666', textAlign: 'center', marginTop: 4 }}>
                [{server.ip}:{server.port}] 已使用 {formatBytes(dd.used)} / {formatBytes(dd.total)} ({pct}%)
              </div>
            );
          })()}
        </div>
        <TrendChart title="网络流量" data={historyData.network} unit="Mbps" color="#722ed1" threshold={server.networkThreshold} timeRange={timeRange} />
      </div>
    </div>
      <Modal
        title={
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingRight: 24 }}>
            <span>日志列表</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              <span
                onClick={(e) => { e.stopPropagation(); setIsLogMaximized(v => !v); }}
                style={{ cursor: 'pointer', width: 30, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 0 }}
                onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.06)'}
                onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                {isLogMaximized ? (
                  <svg width="10" height="10" viewBox="0 0 10 10">
                    <rect x="2" y="0" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1.2" />
                    <rect x="0" y="2" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1.2" />
                  </svg>
                ) : (
                  <svg width="10" height="10" viewBox="0 0 10 10">
                    <rect x="1" y="1" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1.2" />
                  </svg>
                )}
              </span>
              <span
                onClick={(e) => { e.stopPropagation(); setLogsModalVisible(false); }}
                style={{ cursor: 'pointer', width: 30, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 0 }}
                onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.06)'}
                onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                <CloseOutlined style={{ fontSize: 11 }} />
              </span>
            </span>
          </span>
        }
        closable={false}
        open={logsModalVisible}
        onCancel={() => setLogsModalVisible(false)}
        footer={null}
        width={isLogMaximized ? 'calc(100vw - 48px)' : 800}
        style={{
          userSelect: isDragging ? 'none' : undefined,
          top: isLogMaximized ? 12 : undefined,
          maxWidth: isLogMaximized ? 'calc(100vw - 48px)' : undefined,
        }}
      >
        <div style={{ padding: '0 0 8px', display: 'flex', gap: 8, alignItems: 'center' }}>
          <Space size="small">
            <Button type="link" size="small" style={{ padding: 0 }} onClick={handleOpenConfig}>修改路径</Button>
          </Space>
          <Input
            size="small"
            placeholder="搜索..."
            prefix={searchKeyword ? <span style={{ fontSize: 12, color: '#999' }}>{matchCount}条</span> : undefined}
            value={searchKeyword}
            onChange={handleSearchChange}
            style={{ width: 200, marginLeft: 'auto' }}
            allowClear
          />
          {debouncedSearch && matchPositions.length > 0 && (
            <Space size={0}>
              <span style={{ fontSize: 12, color: '#999', marginRight: 2, whiteSpace: 'nowrap' }}>
                {currentMatchIndex >= 0 ? `${currentMatchIndex + 1}/${matchPositions.length}` : `?/${matchPositions.length}`}
              </span>
              <Button type="text" size="small" icon={<ArrowUpOutlined />} onClick={goToPrevMatch} />
              <Button type="text" size="small" icon={<ArrowDownOutlined />} onClick={goToNextMatch} />
            </Space>
          )}
        </div>
        <div ref={modalBodyRef} style={{ display: 'flex', gap: 0, height: isLogMaximized ? 'calc(100vh - 170px)' : 480 }}>
          <div style={{ width: leftWidth, overflow: 'auto', flexShrink: 0 }}>
            <List
              dataSource={logsList}
              renderItem={(item) => (
                <List.Item
                  onClick={() => handleReadLog(item.fullPath)}
                  style={{
                    cursor: 'pointer',
                    background: selectedFilePath === item.fullPath ? '#e6f4ff' : undefined,
                  }}
                >
                  {item.name}
                </List.Item>
              )}
            />
          </div>
          <div
            style={{
              width: 8,
              cursor: 'col-resize',
              background: isDragging ? '#1677ff' : '#f0f0f0',
              flexShrink: 0,
              transition: isDragging ? 'none' : 'background 0.2s',
            }}
            onMouseDown={handleDividerMouseDown}
            onMouseEnter={(e) => { if (!isDragging) (e.currentTarget as HTMLElement).style.background = '#d9d9d9'; }}
            onMouseLeave={(e) => { if (!isDragging) (e.currentTarget as HTMLElement).style.background = '#f0f0f0'; }}
          />
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <div
              ref={logContentRef}
              style={{ height: '100%', overflow: 'auto', whiteSpace: 'pre-wrap', background: '#fff', padding: 12, fontSize: 13, fontFamily: 'monospace' }}
              onScroll={handleContentScroll}
            >
              {!logContent && <span key="empty" style={{ color: '#999' }}>选择文件以查看内容</span>}
              {logContent && lines.map((line, i) => {
                const isActive = currentMatchIndex >= 0 && matchPositions[currentMatchIndex] === i;
                return (
                  <div
                    key={`l${i}`}
                    data-line-index={i}
                    style={isActive ? { background: '#fff8e1', outline: '2px solid #ff9800', outlineOffset: -1, borderRadius: 2 } : undefined}
                  >
                    <LogLineRenderer
                      rawLine={line}
                      lineIndex={i}
                      highlight={debouncedSearch || undefined}
                      expandedKeys={expandedNestedKeys}
                      onToggle={handleNestedToggle}
                    />
                  </div>
                );
              })}
              {loading && (
                <div style={{ textAlign: 'center', padding: 8, color: '#999' }}>
                  <Spin size="small" /> 加载中...
                </div>
              )}
              {!hasMore && logContent && (
                <div style={{ textAlign: 'center', padding: 8, color: '#999' }}>--- 已加载全部内容 ---</div>
              )}
            </div>
            <Button
              type="primary"
              shape="circle"
              icon={<VerticalAlignBottomOutlined />}
              size="small"
              title="跳至最新"
              onClick={handleJumpToLatest}
              style={{
                position: 'absolute', bottom: 12, right: 12, zIndex: 10,
                opacity: readingFromEnd ? 0.5 : 0.9,
                boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
              }}
            />
          </div>
        </div>
      </Modal>

      <Modal
        title="配置日志目录"
        open={configModalVisible}
        onCancel={() => setConfigModalVisible(false)}
        onOk={handleSaveConfig}
      >
        <Input value={configPathInput} onChange={(e) => setConfigPathInput(e.target.value)} placeholder="输入远程服务器上的日志目录路径，例如 /var/log/myapp" />
      </Modal>
    </>
  );
}
