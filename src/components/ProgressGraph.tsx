import React, { useMemo, useState } from 'react';
import { Box, Text, VStack, Icon, HStack, Pressable } from '@gluestack-ui/themed';
import { Entypo, MaterialIcons } from '@expo/vector-icons';
import { LineChart } from 'react-native-gifted-charts';
import { useUnit } from '../contexts/UnitContext';
import { formatVolumeFromKg, kgToLb, unitLabel } from '../utils/units';

// Minimal shape we need from a session
export type ProgressGraphSession = {
  startedAt: string | null;
  totalVolumeKg: number | null;
  splitId?: string | null;
};

export type ProgressGraphProps = {
  title?: string;
  sessions: ProgressGraphSession[];
  height?: number;
  color?: string; // line/area color override
  emptyMessage?: string;
  // Optional: notify parent when user is actively dragging/touching the chart area
  onDragActiveChange?: (active: boolean) => void;
  onPressCustomize?: () => void;
};

// X-axis labels: compact numeric format to prevent truncation (e.g., 10/2, 2/14)
function fmtAxisDateLabel(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return `${d.getMonth() + 1}/${d.getDate()}`;
  } catch {
    return '';
  }
}

// Overlay tooltip: keep short month style (e.g., Oct 2, Feb 14)
function fmtOverlayDateLabel(iso: string): string {
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
  emptyMessage = 'No data yet. Finish workouts to see progress.',
  onDragActiveChange,
  onPressCustomize,
}) => {
  const { unit } = useUnit();
  const [chartWidth, setChartWidth] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const LONG_PRESS_DELAY_MS = 300;
  const pendingXRef = React.useRef(0);
  const longPressTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const RIGHT_INSET = 0; // no external inset; keep spacing aligned with chart width
  const initialPad = 17;
  // Provide enough right padding so the last x-axis label isn't clipped.
  const endPad = 10;
  const Y_AXIS_LABEL_WIDTH = 34;
  const Y_AXIS_THICKNESS = 1;
  // Map sessions to chart points: sort by date asc, filter invalid
  const { data, maxValue } = useMemo(() => {
    const cleanedAll = (sessions ?? [])
      .filter(
        (s) => s && typeof s.startedAt === 'string' && !!s.startedAt && Number.isFinite((s.totalVolumeKg as unknown) as number)
      )
      .map((s) => ({
        iso: s.startedAt as string,
        volumeKg: (s.totalVolumeKg ?? 0) as number,
      }))
      .filter((s) => !isNaN(Date.parse(s.iso)))
      .sort((a, b) => Date.parse(a.iso) - Date.parse(b.iso));

    // Show at most the most recent 9 points (chronological within the window).
    const cleaned = cleanedAll.length > 9 ? cleanedAll.slice(cleanedAll.length - 9) : cleanedAll;

    const values = cleaned.map((c) => (unit === 'lb' ? kgToLb(c.volumeKg) : c.volumeKg));
    const max = values.length ? Math.max(...values) : 0;
    const pad = max > 0 ? Math.ceil(max * 0.15) : 10;
    const maxValue = max + pad;

    // Show first, middle, last labels (max 3), index-based.
    const n = cleaned.length;
    const labelIndexes = new Set<number>();
    if (n === 1) {
      labelIndexes.add(0);
    } else if (n === 2) {
      labelIndexes.add(0);
      labelIndexes.add(1);
    } else if (n >= 3) {
      labelIndexes.add(0);
      labelIndexes.add(Math.floor((n - 1) / 2));
      labelIndexes.add(n - 1);
    }

    const data = cleaned.map((c, idx) => {
      const showLabel = labelIndexes.has(idx);
      const displayVolume = unit === 'lb' ? kgToLb(c.volumeKg) : c.volumeKg;
      // Include iso and volume to power pointer label rendering
      return { value: displayVolume, label: showLabel ? fmtAxisDateLabel(c.iso) : '', iso: c.iso, volumeKg: c.volumeKg } as any;
    });
    return { data, maxValue };
  }, [sessions, unit]);

  const computedSpacing = useMemo(() => {
    const count = data.length;
    if (!chartWidth || count <= 1) return 26;
    // Effective drawable width after y-axis labels and padding
    const effectiveWidth = Math.max(0, chartWidth - Y_AXIS_LABEL_WIDTH - Y_AXIS_THICKNESS);
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
    <Box bg={colors.cardBg} borderRadius="$lg" p="$3" w="$full" overflow="hidden">
      {!!title && (
        <HStack alignItems="center" justifyContent="space-between" mb="$2">
          <Text color={colors.text} fontWeight="$bold" fontSize="$lg">
            {title}
          </Text>
          {!!onPressCustomize && (
            <Pressable
              onPress={onPressCustomize}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Graph customization"
            >
              {/* @ts-ignore gluestack Icon typing doesn't include `name` but runtime is fine */}
              <Icon as={Entypo as any} name="dots-three-horizontal" color="$white" size="md" />
            </Pressable>
          )}
        </HStack>
      )}
      <VStack w="$full">
        <Box
          w="$full"
          onLayout={(e: any) => setChartWidth(e.nativeEvent.layout.width)}
          onTouchStart={(e: any) => {
            if (!data.length) return;
            const x = e.nativeEvent.locationX as number;
            pendingXRef.current = x;
            // Start long-press timer to begin dragging only after hold
            if (longPressTimerRef.current) {
              clearTimeout(longPressTimerRef.current);
              longPressTimerRef.current = null;
            }
            longPressTimerRef.current = setTimeout(() => {
              const leftOffset = Y_AXIS_LABEL_WIDTH + Y_AXIS_THICKNESS + initialPad;
              const idx = Math.round((pendingXRef.current - leftOffset) / (computedSpacing || 1));
              const clamped = Math.max(0, Math.min(data.length - 1, idx));
              setIsDragging(true);
              setHoverIndex(clamped);
              onDragActiveChange?.(true);
              longPressTimerRef.current = null;
            }, LONG_PRESS_DELAY_MS);
          }}
          onTouchMove={(e: any) => {
            if (!data.length) return;
            const x = e.nativeEvent.locationX as number;
            pendingXRef.current = x;
            if (isDragging) {
              const leftOffset = Y_AXIS_LABEL_WIDTH + Y_AXIS_THICKNESS + initialPad;
              const idx = Math.round((x - leftOffset) / (computedSpacing || 1));
              const clamped = Math.max(0, Math.min(data.length - 1, idx));
              if (hoverIndex !== clamped) setHoverIndex(clamped);
            }
          }}
          onTouchEnd={() => {
            if (longPressTimerRef.current) {
              clearTimeout(longPressTimerRef.current);
              longPressTimerRef.current = null;
            }
            if (isDragging) {
              setIsDragging(false);
              setHoverIndex(null);
              onDragActiveChange?.(false);
            }
          }}
          onTouchCancel={() => {
            if (longPressTimerRef.current) {
              clearTimeout(longPressTimerRef.current);
              longPressTimerRef.current = null;
            }
            if (isDragging) {
              setIsDragging(false);
              setHoverIndex(null);
              onDragActiveChange?.(false);
            }
          }}
          position="relative"
        >
          {chartWidth > 0 && (
            data.length > 0 ? (
              (() => {
                const effectiveWidth = Math.max(0, chartWidth);
                return (
                  <LineChart
                    key={`pg-${unit}-${effectiveWidth}-${data.length}`}
                    data={data}
                    height={height}
                    width={effectiveWidth}
                    disableScroll
                    bounces={false}
                    overScrollMode="never"
                    thickness={4}
                    color={colors.primary}
                    areaChart
                    curved
                    curvature={0.2}
                    isAnimated={true}
                    animateOnDataChange={true}
                    hideRules
                    xAxisColor={colors.axis}
                    yAxisColor={colors.axis}
                    yAxisTextStyle={{ color: colors.text, fontSize: 10 }}
                    xAxisLabelTextStyle={{ color: colors.text, fontSize: 10 }}
                    yAxisLabelWidth={Y_AXIS_LABEL_WIDTH}
                    yAxisLabelSuffix=""
                    formatYLabel={(label: string) => {
                      // Only the origin label (0) should show units.
                      const n = Number(String(label).replace(/,/g, '').trim());
                      if (Number.isFinite(n) && n === 0) return unitLabel(unit);
                      return label;
                    }}
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
                    yAxisThickness={Y_AXIS_THICKNESS}
                    xAxisThickness={1}
                    focusEnabled={false}
                    maxValue={maxValue}
                  />
                );
              })()
            ) : (
              <Box bg="#12141A" borderRadius="$lg" p="$4" alignItems="center">
                            {/* @ts-ignore */}
                            <Icon as={MaterialIcons as any} name="event-busy" color="$gray400" size={56} />
                            <Text color="$gray400" mt="$3" fontSize="$md" fontWeight="$semibold">No workout data yet</Text>
                            <Text color="$gray500" fontSize="$sm" mt="$1" textAlign="center">
                              Your workout data will be graphed here.
                            </Text>
                          </Box>
            )
          )}
          {/* Custom drag overlay: vertical guide + tooltip */}
          {isDragging && hoverIndex !== null && data[hoverIndex] && (
            (() => {
              const leftOffset = Y_AXIS_LABEL_WIDTH + Y_AXIS_THICKNESS + initialPad;
              const x = leftOffset + (hoverIndex as number) * (computedSpacing || 1);
              const item: any = data[hoverIndex as number];
              const iso = item?.iso as string | undefined;
              const volumeKg = (item?.volumeKg ?? 0) as number;
              const date = iso ? fmtOverlayDateLabel(iso) : '';
              const lineLeft = Math.max(0, x - 0.5);
              const val = typeof item?.value === 'number' ? item.value : (typeof item?.volume === 'number' ? item.volume : 0);
              const y = Math.max(0, Math.min(height, height - (maxValue > 0 ? (val / maxValue) * height : 0)));
              return (
                <Box position="absolute" left={0} top={0} w={chartWidth} h={height} pointerEvents="none">
                  {/* Vertical guide line */}
                  {/* <Box position="absolute" left={lineLeft} top={0} h={height} w={1} bg={colors.axis} /> */}
            
                  {/* Tooltip redesigned to match provided style */}
                  {/* <Box position="absolute" left={Math.min(Math.max(8, x + 8), chartWidth - 120)} top={20} maxWidth={140} bg="#1F2430" px="$2" py="$1" borderRadius="$sm" borderWidth={1} borderColor={colors.axis}>
                    <Text color={colors.text} fontSize={12}>{date}</Text>
                    <Text color={colors.text} fontSize={12}>{vol}</Text> */}
                  <Box
                    position="absolute"
                    {...(() => {
                      // Decide tooltip placement:
                      // - Prefer above the dot if there's vertical room AND the tooltip can be centered horizontally over the dot without clamping.
                      // - Otherwise, place to the left or right side with the same GAP, and align the {vol} box vertically with the dot (not the whole label).
                      const TOOLTIP_WIDTH = 100;
                      const TOOLTIP_HEIGHT = 40;
                      const GAP = 8; // consistent distance from the dot in all placements

                      const MIN_LEFT = 30; // keep away from y-axis labels
                      const MIN_TOP = 4;
                      const MAX_TOP = height - TOOLTIP_HEIGHT - 4;

                      const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

                      // Above placement feasibility (relative to highlight dot)
                      const DOT_RADIUS = 5; // highlight dot is 10x10
                      const dotTop = y - 2 * DOT_RADIUS; // dot box top
                      const desiredAboveLeft = x - TOOLTIP_WIDTH / 2;
                      const GAP_ABOVE = GAP + 3; // increase distance when above the dot
                      const proposedTopAbove = dotTop - GAP_ABOVE - TOOLTIP_HEIGHT;
                      const hasVerticalRoomAbove = proposedTopAbove >= MIN_TOP;
                      // Allow above placement only if it can be centered with no horizontal clamping
                      const canCenterAboveHorizontally = desiredAboveLeft >= MIN_LEFT && desiredAboveLeft + TOOLTIP_WIDTH <= chartWidth;
                      const canPlaceAboveCentered = hasVerticalRoomAbove && canCenterAboveHorizontally;

                      if (canPlaceAboveCentered) {
                        const leftAbove = desiredAboveLeft; // no clamping needed by definition
                        const topAbove = clamp(proposedTopAbove, MIN_TOP, MAX_TOP);
                        return { left: leftAbove, top: topAbove, w: TOOLTIP_WIDTH, h: TOOLTIP_HEIGHT } as const;
                      }

                      // Side placement: choose based on available horizontal space
                      const spaceRight = chartWidth - (x + GAP);
                      const spaceLeft = x - GAP;
                      let placeRight = false;
                      if (spaceRight >= TOOLTIP_WIDTH && spaceLeft < TOOLTIP_WIDTH) placeRight = true;
                      else if (spaceLeft >= TOOLTIP_WIDTH && spaceRight < TOOLTIP_WIDTH) placeRight = false;
                      else placeRight = spaceRight >= spaceLeft; // tie-breaker: favor side with more room

                      const leftSide = x - GAP - TOOLTIP_WIDTH;
                      const rightSide = x + GAP;
                      // No right-side clamp; only enforce a minimal left margin.
                      const left = placeRight ? Math.max(MIN_LEFT, rightSide) : Math.max(MIN_LEFT, leftSide);

                      // Align vertically so that the volume box (not the entire label) shares the same Y as the HIGHLIGHT DOT (not the raw data point).
                      // Approximate the center offset of the vol box within the tooltip.
                      // date text (fontSize 10) ~ 12px height + marginBottom(3) + vol box half-height (~14)
                      const VOL_BOX_CENTER_OFFSET_FROM_TOP = 29; // tuned constant for visual alignment
                      const dotCenterY = y - DOT_RADIUS; // dot center at y-5
                      const top = clamp(dotCenterY - VOL_BOX_CENTER_OFFSET_FROM_TOP, MIN_TOP, MAX_TOP);

                      return { left, top, w: TOOLTIP_WIDTH, h: TOOLTIP_HEIGHT } as const;
                    })()}
                    style={{ justifyContent: 'center', alignItems: 'center' }}
                  >
                    <Text style={{ color: 'white', fontSize: 10, marginBottom: 3, textAlign: 'center', fontWeight: 'bold' }}>
                      {date}
                    </Text>
                    <Box style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: 'white' }}>
                      <Text style={{ fontWeight: 'bold', textAlign: 'center', fontSize: 14 }}>
                        {`${formatVolumeFromKg(volumeKg, unit)} ${unitLabel(unit)}`}
                      </Text>
                    </Box>
                  </Box>

                  {/* Highlight dot at the focused data point */}
                  <Box position="absolute" left={x - 5} top={y - 10} w={10} h={10} borderRadius={999} bg={"$green300"} borderWidth={2} borderColor={colors.cardBg} />
                </Box>
              );
            })()
          )}
        </Box>
        {/* {data.length === 0 && (
          <Text color="#9CA3AF" textAlign="center" style={{ marginTop: 2 }}>
            {emptyMessage}
          </Text>
        )} */}
      </VStack>
    </Box>
  );
};

export default ProgressGraph;
