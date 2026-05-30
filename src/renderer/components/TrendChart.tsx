import { Card } from 'antd';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import dayjs from 'dayjs';
import type { MetricRecord } from '../../shared/types';

const MAX_POINTS = 300;

interface TrendChartProps {
  title: string;
  data: MetricRecord[];
  unit: string;
  color: string;
  threshold?: number;
  timeRange?: '1h' | '6h' | '24h' | '7d';
}

function timeFormat(timeRange?: string): string {
  switch (timeRange) {
    case '1h': return 'HH:mm:ss';
    case '6h': return 'HH:mm';
    case '24h': return 'HH:mm';
    case '7d': return 'MM-DD HH:mm';
    default: return 'HH:mm';
  }
}

function downsample(data: MetricRecord[], max: number): MetricRecord[] {
  if (data.length <= max) return data;
  const step = Math.ceil(data.length / max);
  const result: MetricRecord[] = [];
  for (let i = 0; i < data.length; i += step) {
    result.push(data[i]);
  }
  return result;
}

export default function TrendChart({ title, data, unit, color, threshold, timeRange }: TrendChartProps): JSX.Element {
  const sampled = downsample(data, MAX_POINTS);
  const chartData = sampled.map((d) => ({
    time: dayjs(d.timestamp).format(timeFormat(timeRange)),
    value: d.value,
  }));

  return (
    <Card title={title} size="small">
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="time" fontSize={11} tick={{ fill: '#999' }} interval="preserveStartEnd" />
          <YAxis fontSize={11} tick={{ fill: '#999' }} unit={unit} />
          <Tooltip
            formatter={(value: number) => [`${value.toFixed(1)}${unit}`, title]}
            labelFormatter={(label) => `时间: ${label}`}
          />
          {threshold !== undefined && (
            <ReferenceLine y={threshold} stroke="#ff4d4f" strokeDasharray="4 4" label={{ value: `阈值 ${threshold}${unit}`, fill: '#ff4d4f', fontSize: 11 }} />
          )}
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}
