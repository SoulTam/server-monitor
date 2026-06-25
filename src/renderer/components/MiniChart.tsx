import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface MiniChartProps {
  data?: number[];
  color?: string;
  height?: number;
}

export default function MiniChart({ data = [], color = '#1677ff', height = 30 }: MiniChartProps): JSX.Element {
  const chartData = data.map((value, index) => ({ index, value }));
  const isEmpty = chartData.length === 0;

  return (
    <div style={{ height, width: '100%', position: 'relative' }}>
      {isEmpty ? (
        <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d9d9d9', fontSize: 11 }}>
          暂无数据
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={chartData}>
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
