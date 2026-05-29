import { describe, it, expect, beforeEach, vi } from 'vitest';

const parseCpu = (output: string): number => {
  const lines = output.trim().split('\n');
  const parse = (line: string): number[] =>
    line.replace('cpu', '').trim().split(/\s+/).map(Number);
  const first = parse(lines[0]);
  const second = parse(lines[1]);
  const idle1 = first[3] + (first[4] || 0);
  const idle2 = second[3] + (second[4] || 0);
  const total1 = first.reduce((a, b) => a + b, 0);
  const total2 = second.reduce((a, b) => a + b, 0);
  return Math.round((1 - (idle2 - idle1) / (total2 - total1)) * 100 * 10) / 10;
};

const parseMemory = (output: string): number => {
  const memLine = output.trim().split('\n').find((l) => l.startsWith('Mem:'));
  if (!memLine) throw new Error('Invalid memory output');
  const parts = memLine.split(/\s+/);
  const total = parseInt(parts[1], 10);
  const available = parseInt(parts[6], 10);
  return Math.round((1 - available / total) * 100 * 10) / 10;
};

const parseDisk = (output: string): number => {
  const parts = output.trim().split(/\s+/);
  const useStr = parts.find((p) => p.endsWith('%'));
  if (!useStr) throw new Error('Invalid disk output');
  return parseInt(useStr.replace('%', ''), 10);
};

describe('SSH output parsers', () => {
  it('parses CPU usage from /proc/stat samples', () => {
    const output = 'cpu  100 0 50 850 0 0 0 0 0 0\ncpu  150 0 75 875 0 0 0 0 0 0';
    const usage = parseCpu(output);
    expect(usage).toBeGreaterThan(0);
    expect(usage).toBeLessThanOrEqual(100);
  });

  it('parses memory usage from free -m output', () => {
    const output = `              total        used        free      shared  buff/cache   available
Mem:           8000        4000        2000           0        2000        4000
Swap:          2048           0        2048`;
    expect(parseMemory(output)).toBe(50);
  });

  it('parses disk usage from df output', () => {
    const output = '/dev/sda1        50G   30G   20G  60% /';
    expect(parseDisk(output)).toBe(60);
  });

  it('throws on invalid memory output', () => {
    expect(() => parseMemory('no mem line here')).toThrow();
  });
});
