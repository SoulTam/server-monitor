import { Card } from 'antd';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import dayjs from 'dayjs';
import type { MetricRecord } from '../../shared/types';

interface TrendChartProps {
  title: string;
  data: MetricRecord[];
  unit: string;
  color: string;
  threshold?: number;
}

export default function TrendChart({ title, data, unit, color, threshold }: TrendChartProps): JSX.Element {
  const chartData = data.map((d) => ({
    time: dayjs(d.timestamp).format('HH:mm'),
    value: d.value,
  }));

  return (
    <Card title={title} size="small">
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="time" fontSize={11} tick={{ fill: '#999' }} />
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
