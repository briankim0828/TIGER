import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { Box, Text, Pressable, VStack } from "@gluestack-ui/themed";
import WorkoutCalendar from "../components/WorkoutCalendar";
import WorkoutHeatmap from "../components/WorkoutHeatmap";
import { useFocusEffect } from "@react-navigation/native";
// DataContext removed in CP5; use direct DB queries
import { useDatabase, useWorkoutHistory } from "../db/queries";
import { supabase } from "../utils/supabaseClient";
import { useWorkout } from "../contexts/WorkoutContext";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ScrollView, StyleSheet } from "react-native";
import { useOverlay } from "../contexts/OverlayContext";
import type { ProgramSplit, WorkoutCalendarEntry } from '../types/ui';

// Local WeekDay type (decoupled from legacy types/index.ts slated for removal)
type WeekDay = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

// Internal lightweight calendar workout placeholder (may be removed later)
interface WorkoutSession { date: string; completed: boolean }

const ProgressScreen: React.FC = () => {
  const db = useDatabase();
  const history = useWorkoutHistory();
  const { startWorkout, getActiveSessionId } = useWorkout();
  const [authUserId, setAuthUserId] = React.useState<string | null>(null);
  React.useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setAuthUserId(user?.id ?? null);
      } catch {}
    })();
  }, []);

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();

  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [loading, setLoading] = useState(true);
  const [calendarKey, setCalendarKey] = useState(0);
  const [splits, setSplits] = useState<ProgramSplit[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(useMemo(() => {
    return `${currentYear}-${String(currentMonth + 1).padStart(
      2,
      "0"
    )}-${String(today.getDate()).padStart(2, "0")}`;
  }, [currentYear, currentMonth, today]));
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [calendarEntries, setCalendarEntries] = useState<WorkoutCalendarEntry[]>([]);
  const { showSessionSummary } = useOverlay();
  // Pressed state for main action button
  const [isBeginPressed, setIsBeginPressed] = useState(false);

  const isInitialLoadRef = useRef(true);
  // processedDataRef removed (legacy DataContext migration complete)

  const todayString = useMemo(() => {
    return `${currentYear}-${String(currentMonth + 1).padStart(
      2,
      "0"
    )}-${String(today.getDate()).padStart(2, "0")}`;
  }, [currentYear, currentMonth, today]);

  const isFutureDate = useMemo(() => {
    if (!selectedDate) return false;
    return selectedDate > todayString;
  }, [selectedDate, todayString]);

  const isToday = useMemo(() => {
    return selectedDate === todayString;
  }, [selectedDate, todayString]);

  // Parse YYYY-MM-DD as a local date to avoid timezone shifting and map to WeekDay label
  const getDayOfWeek = useCallback((dateString: string | null) => {
    if (!dateString) return null;
    const [y, m, d] = dateString.split('-').map((s) => parseInt(s, 10));
    if (!y || !m || !d) return null;
    const date = new Date(y, m - 1, d); // local time
    const labels: WeekDay[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as any;
    return labels[date.getDay()];
  }, []);

  const scheduledSplit: ProgramSplit | null = useMemo(() => {
    const dayOfWeek = getDayOfWeek(selectedDate) as WeekDay | null;
    if (!dayOfWeek) return null;
    return splits.find(split => split.days.includes(dayOfWeek)) || null;
  }, [selectedDate, splits, getDayOfWeek]);

  useFocusEffect(
    useCallback(() => {
      const processData = async () => {
        try {
          if (!authUserId) {
            setSplits([]);
            setCalendarEntries([]);
            setWorkouts([]);
          } else {
            const [rows, dayAssigns] = await Promise.all([
              db.getUserSplitsWithExerciseCounts(authUserId),
              db.getDayAssignments(authUserId),
            ]);
            const daysBySplit = new Map<string, WeekDay[]>();
            const NUM_TO_LABEL: Record<number, WeekDay> = { 0: 'Mon', 1: 'Tue', 2: 'Wed', 3: 'Thu', 4: 'Fri', 5: 'Sat', 6: 'Sun' } as const;
            for (const a of dayAssigns) {
              const list = daysBySplit.get(a.split_id) ?? [];
              const n = typeof (a as any).weekday === 'string' ? parseInt((a as any).weekday, 10) : ((a as any).weekday as number);
              const label = NUM_TO_LABEL[n as keyof typeof NUM_TO_LABEL];
              if (label) list.push(label);
              daysBySplit.set(a.split_id, list);
            }
            const calendarSplits: ProgramSplit[] = rows.map((r: any) => ({
              id: r.id,
              name: r.name,
              color: r.color ?? undefined,
              days: daysBySplit.get(r.id) ?? [],
              exerciseCount: typeof r.exerciseCount === 'number' ? r.exerciseCount : (typeof r.exercise_count === 'string' ? parseInt(r.exercise_count, 10) : r.exercise_count ?? 0),
            }));
            setSplits(calendarSplits);
            const entries = await history.getWorkoutCalendarEntries(authUserId);
            setCalendarEntries(entries);
            setWorkouts(entries.map((e: WorkoutCalendarEntry) => ({ date: e.date, completed: e.completed })));
          }
        } catch (e) {
          console.warn('[ProgressScreen] Failed to build calendar splits from DB', e);
          setSplits([]);
          setCalendarEntries([]);
          setWorkouts([]);
        }
        if (isInitialLoadRef.current) {
          setIsInitialLoad(false);
          isInitialLoadRef.current = false;
        }
        setLoading(false);
        setCalendarKey((prev) => prev + 1);
      };

      processData();
    }, [db, history, authUserId])
  );

  const handleDayPress = useCallback(
    (date: string) => {
      if (date === selectedDate) {
        return;
      }
      
  const dayOfWeek = getDayOfWeek(date) as WeekDay | null;
  const currentSplit = dayOfWeek ? splits.find(split => split.days.includes(dayOfWeek)) : null;
  const found = calendarEntries.find(w => w.date === date);
      
      console.log('[DEBUG] Selected Date Info:', {
        date,
        split: currentSplit?.name,
    hasSession: !!found,
    completed: found?.completed ?? false
      });
      
      setSelectedDate(date);
    },
  [selectedDate, calendarEntries, getDayOfWeek, splits]
  );

  const handleStartWorkout = useCallback(async () => {
    if (!scheduledSplit) {
      console.error("Cannot start workout: Missing split.");
      return;
    }
    // Fetch exercises for this split from the DB (Program Builder source of truth)
    const joins = await db.getSplitExercises(scheduledSplit.id);
    // Use exercise_catalog IDs; remote FK requires exercise_id to exist in exercise_catalog
    const fromIds = joins.map((j) => j.exercise.id);
    console.debug('[ProgressScreen] Starting workout', { splitId: scheduledSplit.id, exerciseCount: fromIds.length });
  if (!authUserId) return;
  await startWorkout(authUserId, scheduledSplit.id, { fromSplitExerciseIds: fromIds });
  }, [scheduledSplit, startWorkout, db]);

  const handleWorkoutPress = useCallback(() => {
    // Always open SessionPreviewModal. When no scheduled split, it will show an empty session
    // with a weekday-based title (e.g., "Monday workout").
    showSessionSummary({
      selectedDate,
      scheduledSplit,
      onStartWorkout: () => handleStartWorkout(),
    });
  }, [scheduledSplit, selectedDate, showSessionSummary, handleStartWorkout]);

  const handleCloseSummary = useCallback(() => {}, []);

  useEffect(() => {
    (async () => {
      try {
        if (!authUserId) return;
        await getActiveSessionId(authUserId);
      } catch {}
    })();
  }, [getActiveSessionId, authUserId]);

  if (loading) {
    return (
      <Box flex={1} justifyContent="center" alignItems="center" bg="$backgroundDark900">
        <Text color="$textLight50">Loading Progress...</Text>
      </Box>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <ScrollView style={{ flex: 1, backgroundColor: "#1E2028" }}>
        <Box flex={1}  >
          <VStack space="md" p="$2">
            <Text color="$textLight50" fontSize="$2xl" fontWeight="$bold" pb="$4">
              My Progress
            </Text>

            {/* Workout Heatmap */}
            <WorkoutHeatmap entries={calendarEntries} splits={splits} />

            <WorkoutCalendar
              key={`calendar-${calendarKey}`}
              month={currentMonth}
              year={currentYear}
              workouts={calendarEntries}
              splits={splits}
              onDayPress={handleDayPress}
              selectedDate={selectedDate}
              useParentInset
            />

            <Box py="$1" pt="$5">
              <Pressable
                bg="$primary500"
                py="$4"
                px="$6"
                borderRadius="$xl"
                onPressIn={() => setIsBeginPressed(true)}
                onPressOut={() => setIsBeginPressed(false)}
                onPress={isFutureDate ? undefined : handleWorkoutPress}
                pointerEvents={isFutureDate ? 'none' : 'auto'}
                disabled={isFutureDate}
                accessibilityRole="button"
                style={{ opacity: isFutureDate ? 0.65 : (isBeginPressed ? 0.8 : 1) }}
              >
                <Text
                  color="$textLight50"
                  fontSize="$lg"
                  fontWeight="$bold"
                  textAlign="center"
                >
                  {isFutureDate
                    ? "Not Yet..."
                    : isToday
                      ? "Begin Today's Workout"
                      : `Log workout from ${new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                </Text>
              </Pressable>
            </Box>
          </VStack>
        </Box>
      </ScrollView>
      
  {/* SessionPreviewModal is now rendered globally via GlobalOverlays */}
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1E2028",
  },
});

export default ProgressScreen;

