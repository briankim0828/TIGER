import React, { useState, useRef, useEffect, useCallback } from "react";
import { Box, VStack } from "@gluestack-ui/themed";
import {
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Dimensions,
  TouchableWithoutFeedback,
} from "react-native";
import { ScrollView as GHScrollView } from 'react-native-gesture-handler';
import { WeekDay } from "../types/base";
import {
  ProgramSplit,
  ProgramEditMode,
  ProgramSplitWithExercises,
  ProgramExerciseLite,
} from "../types/ui";
import type { SplitExerciseJoin } from "../db/queries/simple";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { WorkoutStackParamList } from "./WorkoutMain";
import MySplits from "../components/MySplits";
import MyExercises from "../components/MyExercises";
import MyProgram from "../components/MyProgram";
import { useDatabase } from "../db/queries";
import { supabase } from "../utils/supabaseClient";
import Animated, { Layout } from "react-native-reanimated";

// We now use ProgramSplit for Program/Splits UIs

type NavigationProp = NativeStackNavigationProp<WorkoutStackParamList>;
type EditMode = ProgramEditMode;

const WorkoutScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const scrollViewRef = useRef<any>(null);
  const db = useDatabase();
  const [AUTH_USER_ID, setAUTH_USER_ID] = useState<string | null>(null);

  const [editMode, setEditMode] = useState<EditMode>("none");
  const [editingSplitId, setEditingSplitId] = useState<string | null>(null);
  const [splits, setSplits] = useState<ProgramSplit[]>([]);
  const [editedSplits, setEditedSplits] = useState<ProgramSplit[] | null>(null);
  const editedSplitsRef = useRef<ProgramSplit[] | null>(null);
  const [selectedDay, setSelectedDay] = useState<WeekDay | null>(null);
  const [selectedSplit, setSelectedSplit] = useState<ProgramSplit | null>(null);
  const [isFirstMount, setIsFirstMount] = useState(true);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const [expandedExercises, setExpandedExercises] = useState<string[]>([]);
  const [splitsWithExercises, setSplitsWithExercises] = useState<ProgramSplitWithExercises[] | null>(null);

  const mapRowToProgramSplit = useCallback((row: any): ProgramSplit => {
    const exerciseCount = typeof row.exerciseCount === 'number' ? row.exerciseCount : (typeof row.exercise_count === 'string' ? parseInt(row.exercise_count, 10) : row.exercise_count || 0);
    return { id: row.id, name: row.name, color: row.color, days: [], exerciseCount };
  }, []);

  const fetchSplits = useCallback(async () => {
    try {
      // Fetch splits + day assignments
        const [rows, dayAssigns] = await Promise.all([
  db.getUserSplitsWithExerciseCounts(AUTH_USER_ID ?? 'local-user'),
  db.getDayAssignments(AUTH_USER_ID ?? 'local-user')
      ]);
      const assignBySplit = new Map<string, WeekDay[]>();
      const NUM_TO_LABEL: Record<number, WeekDay> = { 0: 'Mon', 1: 'Tue', 2: 'Wed', 3: 'Thu', 4: 'Fri', 5: 'Sat', 6: 'Sun' } as const;
      for (const a of dayAssigns as any[]) {
        const list = assignBySplit.get(a.split_id) ?? [];
        const n = typeof a.weekday === 'string' ? parseInt(a.weekday, 10) : (a.weekday as number);
        const label = NUM_TO_LABEL[n as keyof typeof NUM_TO_LABEL];
        if (label) list.push(label);
        assignBySplit.set(a.split_id, list);
      }
        const ui = rows.map((r: any) => {
          const base = mapRowToProgramSplit(r);
          return { ...base, days: (assignBySplit.get(r.id) ?? []) };
        });
        setSplits(ui);
    // Hydrate exercises per split for MyExercises panel (derived lightweight shape)
    try {
      const normalizeBodyPart = (bp?: string | null, modality?: string | null): string => {
        const v = (bp || '').trim();
        if (v) {
          const canon = v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
          // Map common variants
          const map: Record<string, string> = {
            Chest: 'Chest',
            Back: 'Back',
            Legs: 'Legs',
            Leg: 'Legs',
            Shoulders: 'Shoulders',
            Shoulder: 'Shoulders',
            Arms: 'Arms',
            Biceps: 'Arms',
            Triceps: 'Arms',
            Core: 'Core',
            Abs: 'Core',
            Abdominals: 'Core',
            Cardio: 'Cardio',
          };
          return map[canon] || canon;
        }
        const m = (modality || '').trim();
        if (m) {
          const mm = m.toLowerCase();
          if (mm === 'bodyweight') return 'Core'; // default grouping for bodyweight if body part missing
        }
        return 'Uncategorized';
      };

      const detailed: ProgramSplitWithExercises[] = [];
      for (const s of ui) {
        const se: SplitExerciseJoin[] = await db.getSplitExercises(s.id);
        const exs: ProgramExerciseLite[] = se.map((r) => ({
          id: r.exercise.id,
          name: r.exercise.name,
          bodyPart: normalizeBodyPart(r.exercise.bodyPart, r.exercise.modality),
        }));
        detailed.push({ ...s, exercises: exs });
      }
      setSplitsWithExercises(detailed);
    } catch (e) {
      console.warn('WorkoutScreen: failed to hydrate exercises for MyExercises view', e);
      setSplitsWithExercises(null);
    }
    // If we're currently editing splits, keep the edited list and ref in sync so UI reflects DB changes
    if (editMode === 'splits') {
      const clone = JSON.parse(JSON.stringify(ui));
      setEditedSplits(clone);
      editedSplitsRef.current = clone;
    }
    } catch (e) {
      console.error('WorkoutScreen: Failed to fetch splits from DB', e);
    }
  }, [db, AUTH_USER_ID, mapRowToProgramSplit, editMode]);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setAUTH_USER_ID(user?.id ?? null);
      } catch {}
    })();
    if (isFirstMount) {
      fetchSplits();
      setIsFirstMount(false);
    }
  }, [isFirstMount, fetchSplits]);

  // Track keyboard height for focus-into-view scrolling during split name edits
  useEffect(() => {
    const onShow = (e: any) => setKeyboardHeight(e.endCoordinates?.height ?? 0);
    const onHide = () => setKeyboardHeight(0);
    const showSub = Keyboard.addListener('keyboardDidShow', onShow);
    const hideSub = Keyboard.addListener('keyboardDidHide', onHide);
    return () => {
  showSub.remove();
  hideSub.remove();
    };
  }, []);

  // Refresh whenever screen gains focus (e.g., returning from detail)
  useFocusEffect(
    useCallback(() => {
      fetchSplits();
    }, [fetchSplits])
  );

  const setEditModeWithDebug = useCallback((newMode: EditMode) => {
    if (newMode === "splits" && editMode !== "splits") {
  const initialSplits = JSON.parse(JSON.stringify(splits || []));
      setEditedSplits(initialSplits);
      editedSplitsRef.current = initialSplits;
      console.log("WorkoutScreen: Entering splits edit mode.");
      setSelectedDay(null);
      setSelectedSplit(null);
      setEditingSplitId(null);
    } else if (newMode !== "splits" && editMode === "splits") {
      setEditedSplits(null);
      editedSplitsRef.current = null;
      setEditingSplitId(null);
      console.log("WorkoutScreen: Exiting splits edit mode.");
    }
    if (newMode === "program" && editMode === "splits") {
       setEditingSplitId(null);
    }
    if (newMode === "none" && editMode === "program") {
        setSelectedDay(null);
        setSelectedSplit(null);
    }
    setEditMode(newMode);
  }, [editMode, splits]);

  const toggleProgramEditMode = useCallback(async () => {
  console.log("toggleProgramEditMode called. Current mode:", editMode);
  // Deprecated by weekday-tap entry; keep no-op for safety if referenced.
  }, [editMode, setEditModeWithDebug]);

  // Persist name changes only when exiting edit mode

  const toggleSplitsEditMode = useCallback(async () => {
    if (editMode === "splits") {
      // On exit, commit any edited names once
      try {
        const originals = new Map<string, ProgramSplit>(splits.map(s => [s.id, s]));
        const edited = editedSplitsRef.current ?? [];
        for (const s of edited) {
          const orig = originals.get(s.id);
          if (orig && s.name !== orig.name) {
            await db.updateSplit({ id: s.id, name: s.name });
          }
        }
      } catch (e) {
        console.warn('Failed to persist name edits on exit', e);
      }
      await fetchSplits();
      setEditModeWithDebug("none");
    } else {
      setEditModeWithDebug("splits");
    }
  }, [editMode, setEditModeWithDebug, fetchSplits, db, splits]);

  const handleSplitNameEdit = useCallback((id: string, newName: string) => {
    // Update local edited state for UI responsiveness
    setEditedSplits(prev => {
      const newState = prev?.map(split => split.id === id ? { ...split, name: newName } : split) ?? null;
      editedSplitsRef.current = newState;
      return newState;
    });
  }, []);

  // No onBlur commit; only commit on exiting edit mode.

  const handleColorSelect = useCallback((id: string, color: string) => {
    setEditedSplits(prev => {
      const newState = prev?.map(split => split.id === id ? { ...split, color } : split) ?? null;
      editedSplitsRef.current = newState;
      return newState;
    });
    // Persist color immediately; UI already reflects local state. Avoid extra fetch.
    db.updateSplit({ id, color })
      .catch(err => console.error('Failed to update split color', err));
  }, [db]);

  const handleAddSplit = useCallback(() => {
    // Default name should be "Split {current # of splits + 1}"
    const list = (editMode === 'splits' ? (editedSplitsRef.current ?? splits) : splits) || [];
    const nextName = `Split ${list.length + 1}`;
    if (!AUTH_USER_ID) {
      console.warn('Cannot create split: user not authenticated');
      return;
    }
    db.createSplit({ userId: AUTH_USER_ID, name: nextName, color: "#FF5733" })
      .then(async (created) => {
        setEditingSplitId(created.id);
        await fetchSplits();
        // editedSplits is synced by fetchSplits when in 'splits' mode
      })
      .catch(err => console.error('Failed to create split', err));
  }, [db, AUTH_USER_ID, splits, fetchSplits, editMode]);

  const handleDeleteSplit = useCallback((id: string) => {
    db.deleteSplit(id)
      .then(() => fetchSplits())
      .then(() => {
        if (editingSplitId === id) setEditingSplitId(null);
      })
      .catch(err => console.error('Failed to delete split', err));
  }, [db, fetchSplits, editingSplitId]);

  // Persist reordered split IDs to DB using 1-based order positions
  const handlePersistSplitOrder = useCallback(async (orderedIds: string[]) => {
    try {
      if (AUTH_USER_ID) {
        // Use two-phase reorder to avoid remote UNIQUE(user_id, order_pos) collisions
        await db.reorderSplits(AUTH_USER_ID, orderedIds);
      } else {
        // Fallback: local only (should rarely happen)
        let pos = 1;
        for (const id of orderedIds) {
          await db.updateSplit({ id, orderPos: pos });
          pos += 1;
        }
      }
      await fetchSplits();
    } catch (e) {
      console.error('Failed to persist split order', e);
    }
  }, [db, fetchSplits, AUTH_USER_ID]);

  const handleDaySelect = useCallback((day: WeekDay) => {
    if (editMode !== 'program') {
      setEditModeWithDebug('program');
      setSelectedDay(day);
      setSelectedSplit(null);
      return;
    }
    if (selectedDay === day) {
      setSelectedDay(null);
      setSelectedSplit(null);
      setEditModeWithDebug('none');
    } else {
      setSelectedDay(day);
      setSelectedSplit(null);
    }
  }, [selectedDay, editMode, setEditModeWithDebug]);

  const handleSplitSelect = useCallback(async (splitToAssign: ProgramSplit) => {
    if (!selectedDay || editMode !== 'program') return;
    if (!AUTH_USER_ID) {
      console.warn('Cannot set day assignment: user not authenticated');
      return;
    }
    const currentlyAssigned = splitToAssign.days.includes(selectedDay);
    try {
      // Map WeekDay label to integer 0=Mon..6=Sun for storage
      const LABEL_TO_NUM: Record<WeekDay, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 } as const;
      const weekdayNum = LABEL_TO_NUM[selectedDay];
      await db.setDayAssignment(AUTH_USER_ID, String(weekdayNum), currentlyAssigned ? null : splitToAssign.id);
      await fetchSplits();
    } catch (e) {
      console.error('Failed to set day assignment', e);
    }
  }, [selectedDay, editMode, db, AUTH_USER_ID, fetchSplits]);

  const handleSplitPress = useCallback((split: ProgramSplit) => {
    if (selectedDay && editMode === 'program') {
      handleSplitSelect(split);
      return;
    }
    if (editMode === 'splits') {
      setEditingSplitId(prevId => prevId === split.id ? null : split.id);
      return;
    }
    if (editMode === 'none') {
      navigation.navigate('SplitDetail', { split });
    }
  }, [selectedDay, editMode, handleSplitSelect, navigation, setEditingSplitId]);

  const handleSplitDetailUpdate = useCallback(async (updatedSplit: ProgramSplit) => {
    console.log('WorkoutScreen: Receiving update from SplitDetail:', updatedSplit);
    const updatedSplits = splits.map((split: ProgramSplit) =>
      split.id === updatedSplit.id ? updatedSplit : split
    );
    setSplits(updatedSplits);
  }, [splits]);

  const toggleExerciseExpansion = useCallback((exerciseId: string) => {
    if (editMode !== 'none') return;
    setExpandedExercises(prev => prev.includes(exerciseId) ? prev.filter(id => id !== exerciseId) : [...prev, exerciseId]);
  }, [editMode]);

  // Dismiss keyboard on background press; do not persist edits here
  const handleBackgroundPress = useCallback(() => {
    Keyboard.dismiss();
    // If in weekday assignment mode (program), allow tapping anywhere (except split items) to exit
    if (editMode === 'program') {
      setSelectedDay(null);
      setSelectedSplit(null);
      setEditModeWithDebug('none');
    }
  }, [editMode, setEditModeWithDebug]);

  // Ensure focused TextInput is visible above keyboard during splits editing
  const handleFocusScroll = useCallback((inputY: number, inputHeight: number) => {
    if (editMode !== 'splits' || !scrollViewRef.current) return;
    const screenHeight = Dimensions.get('window').height;
    const estimatedKeyboardHeight = Platform.OS === 'ios' ? keyboardHeight : keyboardHeight + 50;
    if (estimatedKeyboardHeight <= 0) return;

    const scrollOffsetY = scrollY;
    const visibleAreaTop = scrollOffsetY;
    const visibleAreaBottom = scrollOffsetY + screenHeight - estimatedKeyboardHeight;

    const inputAbsoluteTop = inputY;
    const inputAbsoluteBottom = inputAbsoluteTop + inputHeight;

    let scrollToY = scrollOffsetY;
    if (inputAbsoluteTop < visibleAreaTop + 10) {
      scrollToY = Math.max(0, inputAbsoluteTop - 10);
    } else if (inputAbsoluteBottom > visibleAreaBottom - 10) {
      scrollToY = Math.max(0, inputAbsoluteBottom - (screenHeight - estimatedKeyboardHeight) + 10);
    } else {
      return; // Already visible
    }
    try {
      scrollViewRef.current.scrollTo({ y: scrollToY, animated: true });
    } catch {}
  }, [editMode, keyboardHeight, scrollY]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
    >
      <TouchableWithoutFeedback onPress={handleBackgroundPress}>
        <Box flex={1}>
          <GHScrollView
            ref={scrollViewRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 20 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            nestedScrollEnabled
            showsVerticalScrollIndicator
            bounces
            contentInsetAdjustmentBehavior="automatic"
            automaticallyAdjustKeyboardInsets
            onScroll={(e) => setScrollY(e.nativeEvent.contentOffset.y)}
            scrollEventThrottle={16}
          >
            <VStack space="md" p="$2">
              <MyProgram
                splits={splits}
                editMode={editMode}
                selectedDay={selectedDay}
                onDaySelect={handleDaySelect}
              />
              <MySplits
                splits={splits}
                editedSplits={editedSplits}
                editMode={editMode}
                selectedDay={selectedDay}
                editingSplitId={editingSplitId}
                onSplitPress={handleSplitPress}
                onNameEdit={handleSplitNameEdit}
                onColorSelect={handleColorSelect}
                onDeleteSplit={handleDeleteSplit}
                onAddSplit={handleAddSplit}
                onToggleEditMode={toggleSplitsEditMode}
                onFocusScroll={handleFocusScroll}
                onPersistOrder={handlePersistSplitOrder}
              />
              <Box>
                <Animated.View layout={Layout.duration(200)}>
                  <MyExercises
                    splits={
                      splitsWithExercises ??
                      splits.map((s) => ({ ...s, exercises: [] }))
                    }
                    editMode={editMode}
                    expandedExercises={expandedExercises}
                    onToggleExerciseExpansion={toggleExerciseExpansion}
                  />
                </Animated.View>
              </Box>
            </VStack>
            <Box style={{ height: 20 }} />
          </GHScrollView>
        </Box>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

export default WorkoutScreen;
