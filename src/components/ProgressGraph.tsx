import React, { useMemo, useState } from 'react';
import { Box, Text, VStack } from '@gluestack-ui/themed';
import { LineChart } from 'react-native-gifted-charts';

// Minimal shape we need from a session
export type ProgressGraphSession = {
  startedAt: string | null;
  totalVolumeKg: number | null;
};

export type ProgressGraphProps = {
  title?: string;
  sessions: ProgressGraphSession[];
  height?: number;
  color?: string; // line/area color override
  emptyMessage?: string;
};

// Format date labels like: Apr 8
function fmtDateLabel(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

const ProgressGraph: React.FC<ProgressGraphProps> = ({
  title = 'Training Volume',
  sessions,
  height = 220,
  color,
  emptyMessage = 'No data yet. Complete workouts to see progress.',
}) => {
  const [chartWidth, setChartWidth] = useState(0);
  const RIGHT_INSET = 24; // px gap from right edge of the card
  const initialPad = 10;
  const endPad =10;
  // Map sessions to chart points: sort by date asc, filter invalid
  const { data, maxValue } = useMemo(() => {
    const cleaned = (sessions ?? [])
      .filter((s) => s && typeof s.startedAt === 'string' && !!s.startedAt && Number.isFinite(s.totalVolumeKg as any))
      .map((s) => ({
        iso: s.startedAt as string,
        volume: (s.totalVolumeKg ?? 0) as number,
      }))
      .filter((s) => !isNaN(Date.parse(s.iso)))
      .sort((a, b) => Date.parse(a.iso) - Date.parse(b.iso));

    const values = cleaned.map((c) => c.volume);
    const max = values.length ? Math.max(...values) : 0;
    const pad = max > 0 ? Math.ceil(max * 0.15) : 10;
    const maxValue = max + pad;

    const data = cleaned.map((c) => ({ value: c.volume, label: fmtDateLabel(c.iso) }));
    return { data, maxValue };
  }, [sessions]);

  const computedSpacing = useMemo(() => {
    const count = data.length;
    if (!chartWidth || count <= 1) return 26;
    const effectiveWidth = Math.max(0, chartWidth - RIGHT_INSET);
    const available = Math.max(0, effectiveWidth - initialPad - endPad);
    const s = available / (count - 1);
    return Math.max(4, s);
  }, [chartWidth, data.length]);

  // Theme colors (using RGBA where animated)
  const colors = {
    cardBg: '#12141A',
    axis: 'rgba(59,63,74,1)',
    text: 'rgba(230,232,239,1)',
    primary: color ?? 'rgba(107,142,242,1)',
    point: 'rgba(154,178,255,1)',
    fillStart: 'rgba(107,142,242,0.18)',
    fillEnd: 'rgba(107,142,242,0)',
  } as const;

  return (
    <Box bg={colors.cardBg} borderRadius="$lg" pr="$4" mt="$3" w="$full" overflow="hidden">
      <Box p="$3">
      {!!title && (
        <Text color={colors.text} fontWeight="$bold" fontSize="$lg" mb="$1">
          {title}
        </Text>
      )}
      </Box>
      <VStack w="$full">
        <Box w="$full" onLayout={(e: any) => setChartWidth(e.nativeEvent.layout.width)}>
          {chartWidth > 0 && (() => {
            const effectiveWidth = Math.max(0, chartWidth);
            return (
              <LineChart
                key={`pg-${effectiveWidth}-${data.length}`}
                data={data}
                height={height}
                width={effectiveWidth}
                
            
                thickness={4}
                color={colors.primary}
                areaChart
                curved
                isAnimated={true}
                animateOnDataChange={true}
                hideRules
                xAxisColor={colors.axis}
                yAxisColor={colors.axis}
                yAxisTextStyle={{ color: colors.text, fontSize: 10 }}
                xAxisLabelTextStyle={{ color: colors.text, fontSize: 10 }}
                yAxisLabelWidth={35}
                yAxisLabelSuffix=""
                startFillColor={colors.fillStart}
                endFillColor={colors.fillEnd}
                startOpacity={0.35}
                endOpacity={0.02}
                hideDataPoints={false}
                dataPointsColor={colors.point}
                
                dataPointsRadius={4}
                initialSpacing={initialPad}
                endSpacing={endPad}
                spacing={computedSpacing}
                noOfSections={4}
                yAxisThickness={1}
                xAxisThickness={1}
                pointerConfig={{
                  showPointerStrip: false,
                  pointerVanishDelay: 0,
                  autoAdjustPointerLabelPosition: false,
                }}
                focusEnabled={false}
                maxValue={maxValue}
              />
            );
          })()}
        </Box>
        {data.length === 0 && (
          <Text color="#9CA3AF" textAlign="center" style={{ marginTop: 8 }}>
            {emptyMessage}
          </Text>
        )}
      </VStack>
    </Box>
  );
};

export default ProgressGraph;
