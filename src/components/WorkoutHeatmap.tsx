import React, { useMemo, useState, useCallback } from 'react';
import { Box, HStack, VStack, Text } from '@gluestack-ui/themed';
import { Pressable } from 'react-native';
import type { ProgramSplit, WorkoutCalendarEntry } from '../types/ui';
import { WEEKDAYS, WeekDay } from '../types/base';

interface WorkoutHeatmapProps {
  entries: WorkoutCalendarEntry[];
  splits: ProgramSplit[];
}

const BASE_CELL_SIZE = 10; // px (used as fallback before layout)
const BASE_GAP = 2; // px
const COLS = 30; // weeks
const ROWS: WeekDay[] = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

const GREEN = 'rgba(16,185,129,'; // teal-500-ish base with varying alpha

const WorkoutHeatmap: React.FC<WorkoutHeatmapProps> = ({ entries, splits }) => {
  const today = new Date();
  const todayMid = useMemo(() => new Date(today.getFullYear(), today.getMonth(), today.getDate()), [today]);
  const todayYmd = useMemo(() => formatYMD(todayMid), [todayMid]);
  const todayDow = todayMid.getDay(); // 0=Sun..6=Sat

  // Responsive sizing based on available width
  const [gridWidth, setGridWidth] = useState<number>(0);
  const handleLayout = useCallback((e: any) => {
    const w = e?.nativeEvent?.layout?.width;
    if (typeof w === 'number' && w > 0) setGridWidth(w);
  }, []);
  const gap = useMemo(() => (gridWidth > 0 ? Math.max(1, Math.floor(gridWidth / 300)) : BASE_GAP), [gridWidth]);
  const cellSize = useMemo(() => {
    if (gridWidth <= 0) return BASE_CELL_SIZE;
    const s = (gridWidth - (COLS - 1) * gap) / COLS;
    return Math.max(6, Math.floor(s));
  }, [gridWidth, gap]);

  // Map date -> completed
  const entryMap = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const e of entries) m.set(e.date, !!e.completed);
    return m;
  }, [entries]);

  // Determine the start date for the heatmap (29 weeks ago Monday)
  const startOfThisWeek = getStartOfWeek(todayMid); // Monday start
  const startDate = new Date(startOfThisWeek);
  startDate.setDate(startDate.getDate() - (COLS - 1) * 7);

  const grid: { ymd: string; isFutureInCurrentWeek: boolean; hasSession: boolean }[][] = [];
  for (let r = 0; r < 7; r++) {
    const row: { ymd: string; isFutureInCurrentWeek: boolean; hasSession: boolean }[] = [];
    for (let c = 0; c < COLS; c++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + c * 7 + r); // r rows offset days Mon..Sun
      const dMid = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const ymd = formatYMD(dMid);
      const isCurrentWeekCol = isSameWeek(dMid, todayMid);
      const weekdayIndex = dMid.getDay(); // 0=Sun..6=Sat
      const thisWeekFutureDay = isCurrentWeekCol && dMid > todayMid && weekdayIndex !== todayDow;
      const hasSession = entryMap.get(ymd) === true;
      row.push({ ymd, isFutureInCurrentWeek: thisWeekFutureDay, hasSession });
    }
    grid.push(row);
  }

  const headerText = useMemo(() => {
    const todaySplit = getSplitForDay(ROWS[(todayDow + 6) % 7] as WeekDay, splits);
    const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    return todaySplit ? `${dateStr} • ${todaySplit.name}` : `${dateStr} • No split scheduled`;
  }, [today, todayDow, splits]);

  return (
    <Box bg="#121213ff" py="$3" borderRadius="$lg" mb="$4" borderWidth={1} borderColor="#2A2E38">
      <Text color="white" fontSize="$md" fontWeight="$bold" mb="$3">{headerText}</Text>
      <HStack onLayout={handleLayout} style={{ width: '100%', overflow: 'hidden' }}>
        {/* Grid: 7 rows (Mon..Sun), 30 columns (weeks), left to right oldest->latest */}
        {Array.from({ length: COLS }, (_, c) => (
          <VStack key={`col-${c}`} style={{ marginRight: c === COLS - 1 ? 0 : gap }}>
            {Array.from({ length: 7 }, (_, r) => {
              const cell = grid[r][c];
              const bg = cell.isFutureInCurrentWeek
                ? `${GREEN}0.1)`
                : cell.hasSession
                  ? `${GREEN}1)`
                  : `${GREEN}0.3)`;
              return (
                <Box
                  key={`cell-${r}-${c}`}
                  style={{
                    width: cellSize,
                    height: cellSize,
                    borderRadius: 3,
                    backgroundColor: bg,
                    marginBottom: r === 6 ? 0 : gap,
                  }}
                  accessibilityLabel={`${cell.ymd}: ${cell.hasSession ? 'Workout' : 'No workout'}`}
                />
              );
            })}
          </VStack>
        ))}
      </HStack>
    </Box>
  );
};

export default WorkoutHeatmap;

// Helpers
function formatYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getStartOfWeek(d: Date): Date {
  // Monday as first day: shift Sunday(0) to 6
  const day = d.getDay();
  const diff = (day + 6) % 7; // 0 for Mon, 6 for Sun
  const res = new Date(d);
  res.setHours(0, 0, 0, 0);
  res.setDate(res.getDate() - diff);
  return res;
}

function isSameWeek(a: Date, b: Date): boolean {
  const sa = getStartOfWeek(a);
  const sb = getStartOfWeek(b);
  return sa.getFullYear() === sb.getFullYear() && sa.getMonth() === sb.getMonth() && sa.getDate() === sb.getDate();
}

function getSplitForDay(day: WeekDay, splits: ProgramSplit[]): ProgramSplit | null {
  for (const s of splits) {
    if (s.days.includes(day)) return s;
  }
  return null;
}
