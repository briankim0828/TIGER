import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { Box, Text, Pressable, VStack } from "@gluestack-ui/themed";
import WorkoutHeatmap from "../components/WorkoutHeatmap";
import ProgressGraph from "../components/ProgressGraph";
import GraphCustomizationModal from "../components/GraphCustomizationModal";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
// DataContext removed in CP5; use direct DB queries
import { useDatabase, useWorkoutHistory } from "../db/queries";
import { supabase } from "../utils/supabaseClient";
import { useWorkout } from "../contexts/WorkoutContext";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from "react-native";
import { ScrollView } from 'react-native-gesture-handler';
import { useOverlay } from "../contexts/OverlayContext";
import type { ProgramSplit, WorkoutCalendarEntry } from '../types/ui';
// Local WeekDay type (decoupled from legacy types/index.ts slated for removal)
type WeekDay = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

// Internal lightweight calendar workout placeholder (may be removed later)
interface WorkoutSession { date: string; completed: boolean }

const ProgressScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const db = useDatabase();
  const history = useWorkoutHistory();
  const { startWorkout, getActiveSessionId } = useWorkout();
  const [authUserId, setAuthUserId] = React.useState<string | null>(null);
  const [userFirstName, setUserFirstName] = React.useState<string>('');
  React.useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setAuthUserId(user?.id ?? null);

        const meta: any = (user as any)?.user_metadata ?? {};
        const display =
          (meta?.display_name ?? meta?.full_name ?? meta?.name ?? '')
            .toString()
            .trim() ||
          (user?.email ? user.email.split('@')[0] : '');
        const first = display.toString().trim().split(/\s+/)[0] ?? '';
        setUserFirstName(first);
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
  const [graphSessions, setGraphSessions] = useState<Array<{ startedAt: string | null; totalVolumeKg: number | null; splitId: string | null }>>([]);
  const [isGraphCustomizationOpen, setIsGraphCustomizationOpen] = useState(false);
  const [selectedGraphSplitId, setSelectedGraphSplitId] = useState<string | null>(null);
  const { showSessionSummary, workoutDataVersion } = useOverlay();
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

  const graphTitle = useMemo(() => {
    if (!selectedGraphSplitId) return 'All Splits';
    return splits.find((s) => s.id === selectedGraphSplitId)?.name ?? 'Split';
  }, [selectedGraphSplitId, splits]);

  const filteredGraphSessions = useMemo(() => {
    if (!selectedGraphSplitId) return graphSessions;
    return graphSessions.filter((s) => s.splitId === selectedGraphSplitId);
  }, [graphSessions, selectedGraphSplitId]);

  // Time-based greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    const suffix = userFirstName ? `, ${userFirstName}.` : '.';
    if (hour >= 5 && hour < 12) return `Good morning${suffix}`;
    if (hour >= 12 && hour < 17) return `Good afternoon${suffix}`;
    if (hour >= 17 && hour < 23) return `Good evening${suffix}`;
    return `Welcome back${suffix}`;
  }, [userFirstName]);

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

  const processData = useCallback(async () => {
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
          exerciseCount:
            typeof r.exerciseCount === 'number'
              ? r.exerciseCount
              : (typeof r.exercise_count === 'string'
                  ? parseInt(r.exercise_count, 10)
                  : (r.exercise_count ?? 0)),
        }));
        setSplits(calendarSplits);
        const uid = authUserId as string;
        const [entries, posts] = await Promise.all([
          history.getWorkoutCalendarEntries(uid),
          history.getWorkoutPosts(uid, 90),
        ]);
        setCalendarEntries(entries);
        setWorkouts(entries.map((e: WorkoutCalendarEntry) => ({ date: e.date, completed: e.completed })));
        setGraphSessions(posts.map(p => ({ startedAt: p.startedAt, totalVolumeKg: p.totalVolumeKg, splitId: p.splitId })));
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
  }, [authUserId, db, history]);

  useFocusEffect(
    useCallback(() => {
      processData();
    }, [processData, workoutDataVersion])
  );

  // Calendar selection is no longer handled here; moved to CalendarScreen

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
          <VStack space="lg" p="$2">
            <Box h={25} />
            
            <Box p="$1">   
            <Text color="$textLight50" fontSize={30} fontWeight="$bold">
              {greeting}
            </Text>
            <Text color="$textLight500" fontSize={15} fontWeight="$normal">
              Ready for another workout? 
            </Text>
            </Box>

            {/* Workout Heatmap navigates to Calendar */}
            <Box>
              <WorkoutHeatmap
                entries={calendarEntries}
                splits={splits}
                onPress={() => {
                  try { (navigation as any)?.navigate?.('Calendar'); } catch {}
                }}
              />
            </Box>

            {/* Training Volume Graph (interactive). Disable nav gestures only while interacting with the chart. */}
            <Box>
              <ProgressGraph
                title={graphTitle}
                sessions={filteredGraphSessions}
                onPressCustomize={() => setIsGraphCustomizationOpen(true)}
                onDragActiveChange={(active) => {
                  try {
                    const parents: any[] = [];
                    let curr: any = navigation;
                    for (let i = 0; i < 3 && curr; i++) {
                      parents.push(curr);
                      curr = curr?.getParent?.();
                    }
                    parents.forEach((nav) => nav?.setOptions?.({ gestureEnabled: !active, swipeEnabled: !active }));
                  } catch {}
                }}
              />
            </Box>

            

            <Box>
              <Pressable
                bg="rgba(80, 120, 233, 1)"
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
                  {"Start Today's Workout"}
                </Text>
              </Pressable>
            </Box>
          </VStack>
        </Box>
      </ScrollView>

      <GraphCustomizationModal
        visible={isGraphCustomizationOpen}
        splits={splits}
        selectedSplitId={selectedGraphSplitId}
        onClose={() => setIsGraphCustomizationOpen(false)}
        onSelectSplit={(splitId) => {
          setSelectedGraphSplitId(splitId);
          setIsGraphCustomizationOpen(false);
        }}
      />
      
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

