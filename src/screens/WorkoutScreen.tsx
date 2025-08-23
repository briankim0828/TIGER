import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";
import {
  Box,
  VStack,
} from "@gluestack-ui/themed";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView as RNScrollView,
  Keyboard,
  Dimensions,
  TouchableWithoutFeedback,
} from "react-native";
import { WeekDay } from "../types";
import { ProgramSplit, ProgramEditMode, ProgramSplitWithExercises, ProgramExerciseLite } from "../types/ui";
import type { SplitExerciseJoin } from "../db/queries/simple";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { WorkoutStackParamList } from "./WorkoutMain";
import MySplits from "../components/MySplits";
import MyExercises from "../components/MyExercises";
import MyProgram from "../components/MyProgram";
import { useDatabase } from "../db/queries";

// We now use ProgramSplit for Program/Splits UIs

type NavigationProp = NativeStackNavigationProp<WorkoutStackParamList>;
type EditMode = ProgramEditMode;

const WorkoutScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const scrollViewRef = useRef<RNScrollView>(null);
  const db = useDatabase();
  const USER_ID = 'local-user'; // TODO: wire to auth when available

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
      console.log("WorkoutScreen: Fetching user splits from local DB...");
  const [rows, dayAssigns] = await Promise.all([
        db.getUserSplitsWithExerciseCounts(USER_ID),
        db.getDayAssignments(USER_ID)
      ]);
      const assignBySplit = new Map<string, string[]>();
      for (const a of dayAssigns as any[]) {
        const list = assignBySplit.get(a.split_id) ?? [];
        list.push(a.weekday);
        assignBySplit.set(a.split_id, list);
      }
    const ui = rows.map((r: any) => {
  const base = mapRowToProgramSplit(r);
  return { ...base, days: (assignBySplit.get(r.id) ?? []) as WeekDay[] };
      });
    setSplits(ui);
    // Hydrate exercises per split for MyExercises panel (derived lightweight shape)
    try {
      const detailed: ProgramSplitWithExercises[] = [];
      for (const s of ui) {
        const se: SplitExerciseJoin[] = await db.getSplitExercises(s.id);
        const exs: ProgramExerciseLite[] = se.map((r) => ({
          id: r.exercise.id,
          name: r.exercise.name,
          bodyPart: (r.exercise.bodyPart || r.exercise.modality || 'Uncategorized') ?? 'Uncategorized',
        }));
        detailed.push({ ...s, exercises: exs });
      }
      setSplitsWithExercises(detailed);
    } catch (e) {
      console.warn('WorkoutScreen: failed to hydrate exercises for MyExercises view', e);
      setSplitsWithExercises(null);
    }
    // If we're currently editing splits, keep the edited list in sync so UI reflects DB changes
    setEditedSplits(prev => (editMode === 'splits' ? JSON.parse(JSON.stringify(ui)) : prev));
    } catch (e) {
      console.error('WorkoutScreen: Failed to fetch splits from DB', e);
    }
  }, [db, USER_ID, mapRowToProgramSplit, editMode]);

  useEffect(() => {
    if (isFirstMount) {
      fetchSplits();
      setIsFirstMount(false);
    }
  }, [isFirstMount, fetchSplits]);

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
    if (editMode === "program") {
      // No-op for now: day assignments not persisted in DB yet
      setEditModeWithDebug("none");
    } else {
      setEditModeWithDebug("program");
    }
  }, [editMode, setEditModeWithDebug]);

  const toggleSplitsEditMode = useCallback(async () => {
    const currentEditedSplits = editedSplitsRef.current;
    if (editMode === "splits") {
      // On exit, we already persist on change; just refresh UI
      await fetchSplits();
      setEditModeWithDebug("none");
    } else {
      setEditModeWithDebug("splits");
    }
  }, [editMode, setEditModeWithDebug, fetchSplits]);

  const handleSplitNameEdit = useCallback((id: string, newName: string) => {
    // Update local edited state for UI responsiveness
    setEditedSplits(prev => {
      const newState = prev?.map(split => split.id === id ? { ...split, name: newName } : split) ?? null;
      editedSplitsRef.current = newState;
      return newState;
    });
    // Persist immediately
    db.updateSplit({ id, name: newName })
      .then(() => fetchSplits())
      .catch(err => console.error('Failed to update split name', err));
  }, [db, fetchSplits]);

  const handleColorSelect = useCallback((id: string, color: string) => {
    setEditedSplits(prev => {
      const newState = prev?.map(split => split.id === id ? { ...split, color } : split) ?? null;
      editedSplitsRef.current = newState;
      return newState;
    });
    db.updateSplit({ id, color })
      .then(() => fetchSplits())
      .catch(err => console.error('Failed to update split color', err));
  }, [db, fetchSplits]);

  const handleAddSplit = useCallback(() => {
    const list = editedSplitsRef.current ?? splits;
    // Find max existing number from names like 'split N' (case-insensitive)
    let maxNum = 0;
    const re = /^\s*split\s*(\d+)\s*$/i;
    for (const s of list) {
      const m = typeof s.name === 'string' ? s.name.match(re) : null;
      if (m) {
        const n = parseInt(m[1], 10);
        if (!isNaN(n) && n > maxNum) maxNum = n;
      }
    }
    const nextName = `split ${maxNum + 1}`;
    db.createSplit({ userId: USER_ID, name: nextName, color: "#FF5733" })
      .then(async (created) => {
        setEditingSplitId(created.id);
        await fetchSplits();
        // In splits edit mode, auto-enter edit for the newly added split by id
        if (editMode === 'splits') {
          setEditedSplits(prev => prev ? prev : JSON.parse(JSON.stringify(splits)));
        }
      })
      .catch(err => console.error('Failed to create split', err));
  }, [db, USER_ID, splits, fetchSplits, editMode]);

  const handleDeleteSplit = useCallback((id: string) => {
    db.deleteSplit(id)
      .then(() => fetchSplits())
      .then(() => {
        if (editingSplitId === id) setEditingSplitId(null);
      })
      .catch(err => console.error('Failed to delete split', err));
  }, [db, fetchSplits, editingSplitId]);

  const handleDaySelect = useCallback((day: WeekDay) => {
      if (editMode !== "program") return;
      if (selectedDay === day) {
        setSelectedDay(null);
        setSelectedSplit(null);
    } else {
      setSelectedDay(day);
      setSelectedSplit(null);
    }
  }, [selectedDay, editMode]);

  const handleSplitSelect = useCallback(async (splitToAssign: ProgramSplit) => {
      if (!selectedDay || editMode !== "program") return;

      // Toggle assignment in DB: if this split already has the day, unassign, else assign
      const currentlyAssigned = splitToAssign.days.includes(selectedDay);
      try {
        await db.setDayAssignment(USER_ID, selectedDay, currentlyAssigned ? null : splitToAssign.id);
        await fetchSplits();
      } catch (e) {
        console.error('Failed to set day assignment', e);
      }

      setSelectedDay(null);
      setSelectedSplit(null);
  }, [selectedDay, editMode, db, USER_ID, fetchSplits]);

  const handleSplitPress = useCallback((split: ProgramSplit) => {
      if (selectedDay && editMode === "program") {
        handleSplitSelect(split);
        return;
      }
      if (editMode === "splits") {
        setEditingSplitId(prevId => prevId === split.id ? null : split.id);
        return;
      }
      if (editMode === "none") {
        navigation.navigate("SplitDetail", { split });
      }
    },
    [selectedDay, editMode, handleSplitSelect, navigation, setEditingSplitId]
  );

  const handleSplitDetailUpdate = useCallback(async (updatedSplit: ProgramSplit) => {
      console.log("WorkoutScreen: Receiving update from SplitDetail:", updatedSplit);
  const updatedSplits = splits.map((split: ProgramSplit) =>
        split.id === updatedSplit.id ? updatedSplit : split
      );
      // For now, only update local state; persistence is handled within detail screen in next step
      setSplits(updatedSplits);
    },
    [splits]
  );

  const toggleExerciseExpansion = useCallback((exerciseId: string) => {
    if (editMode !== "none") {
      return;
    }
    setExpandedExercises((prev) =>
      prev.includes(exerciseId)
        ? prev.filter((id) => id !== exerciseId)
        : [...prev, exerciseId]
    );
  }, [editMode]);

  const handleFocusScroll = (inputY: number, inputHeight: number) => {
    if (editMode !== "splits" || !scrollViewRef.current) return;

    const screenHeight = Dimensions.get("window").height;
    const estimatedKeyboardHeight = Platform.OS === 'ios' ? keyboardHeight : keyboardHeight + 50;
    if (estimatedKeyboardHeight <= 0) return;

    const scrollOffsetY = scrollY;
    const visibleAreaTop = scrollOffsetY;
    const visibleAreaBottom = scrollOffsetY + screenHeight - estimatedKeyboardHeight;

    const inputAbsoluteTop = inputY;
    const inputAbsoluteBottom = inputAbsoluteTop + inputHeight;

    let scrollToY = scrollOffsetY;

    if (inputAbsoluteTop < visibleAreaTop + 10) {
        scrollToY = inputAbsoluteTop - 10;
    } else if (inputAbsoluteBottom > visibleAreaBottom - 10) {
        scrollToY = inputAbsoluteBottom - (screenHeight - estimatedKeyboardHeight) + 10;
    } else {
        return;
    }

     scrollViewRef.current.scrollTo({ y: scrollToY, animated: true });
  };

  useEffect(() => {
    const keyboardWillShowSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const keyboardWillHideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );

    return () => {
      keyboardWillShowSub.remove();
      keyboardWillHideSub.remove();
    };
  }, []);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <Box flex={1} backgroundColor="#1E2028" paddingTop={0}>
          <RNScrollView
            ref={scrollViewRef}
            style={{ flex: 1 }}
            automaticallyAdjustKeyboardInsets={true}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={true}
            contentContainerStyle={{ paddingBottom: 20 }}
            onScroll={(e) => setScrollY(e.nativeEvent.contentOffset.y)}
            scrollEventThrottle={16}
          >
            <VStack space="md" p="$3.5">
              
              <MyProgram
                splits={splits}
                editMode={editMode}
                selectedDay={selectedDay}
                onDaySelect={handleDaySelect}
                onToggleEditMode={toggleProgramEditMode}
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
              />
             
              <MyExercises
                splits={splitsWithExercises ?? splits.map(s => ({ ...s, exercises: [] }))}
                editMode={editMode}
                expandedExercises={expandedExercises}
                onToggleExerciseExpansion={toggleExerciseExpansion}
              />
             
            </VStack>
          </RNScrollView>
        </Box>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

export default WorkoutScreen;
