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
import { Exercise, Split, WeekDay } from "../types";
import { useData } from "../contexts/DataContext";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { WorkoutStackParamList } from "./WorkoutMain";
import { newUuid } from "../utils/ids";
import { getUserSplitsFromSupabase, saveSplitsToSupabase } from "../supabase/supabaseSplits";
// import MySplits from "../components/MySplits";
// import MyExercises from "../components/MyExercises";
// import MyProgram from "../components/MyProgram";

type NavigationProp = NativeStackNavigationProp<WorkoutStackParamList>;
type EditMode = "none" | "program" | "splits";

const WorkoutScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const scrollViewRef = useRef<RNScrollView>(null);
  const { splits, updateSplits } = useData();

  const [editMode, setEditMode] = useState<EditMode>("none");
  const [editingSplitId, setEditingSplitId] = useState<string | null>(null);
  const [editedSplits, setEditedSplits] = useState<Split[] | null>(null);
  const editedSplitsRef = useRef<Split[] | null>(null);
  const [selectedDay, setSelectedDay] = useState<WeekDay | null>(null);
  const [selectedSplit, setSelectedSplit] = useState<Split | null>(null);
  const [isFirstMount, setIsFirstMount] = useState(true);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const [expandedExercises, setExpandedExercises] = useState<string[]>([]);

  const getUserSplits = useCallback(async () => {
    console.log("WorkoutScreen: Fetching user splits...");
    const fetchedSplits = await getUserSplitsFromSupabase();
    if (fetchedSplits) {
      console.log(`WorkoutScreen: Received ${fetchedSplits.length} splits from Supabase.`);
      updateSplits(fetchedSplits);
    } else {
      console.error("WorkoutScreen: Failed to fetch splits from Supabase or none found.");
    }
  }, [updateSplits]);

  useEffect(() => {
    if (isFirstMount) {
      getUserSplits();
      setIsFirstMount(false);
    }
  }, [isFirstMount, getUserSplits]);

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
      console.log("WorkoutScreen: Saving splits via toggleProgramEditMode...");
      const success = await saveSplitsToSupabase(splits);
      if (success) {
         console.log("WorkoutScreen: Splits saved successfully via toggleProgramEditMode.");
      } else {
         console.error("WorkoutScreen: Failed to save splits via toggleProgramEditMode.");
      }
      setEditModeWithDebug("none");
    } else {
      setEditModeWithDebug("program");
    }
  }, [editMode, splits, saveSplitsToSupabase, setEditModeWithDebug]);

  const toggleSplitsEditMode = useCallback(async () => {
    const currentEditedSplits = editedSplitsRef.current;
    if (editMode === "splits") {
      if (currentEditedSplits) {
        console.log("WorkoutScreen: Saving edited splits...");
        const success = await saveSplitsToSupabase(currentEditedSplits);
        if (success) {
          updateSplits(currentEditedSplits); 
          console.log("WorkoutScreen: Splits saved and context updated.");
        } else {
          console.error("WorkoutScreen: Failed to save splits.");
        }
      }
      setEditModeWithDebug("none");
    } else {
      setEditModeWithDebug("splits");
    }
  }, [editMode, updateSplits, setEditModeWithDebug, saveSplitsToSupabase]);

  const handleSplitNameEdit = useCallback((id: string, newName: string) => {
    let newState: Split[] | null = null;
    setEditedSplits(prev => {
      newState = prev?.map(split =>
        split.id === id ? { ...split, name: newName } : split
      ) ?? null;
      editedSplitsRef.current = newState;
      return newState;
    });
  }, []);

  const handleColorSelect = useCallback((id: string, color: string) => {
    let newState: Split[] | null = null;
    setEditedSplits(prev => {
      newState = prev?.map(split =>
        split.id === id ? { ...split, color } : split
      ) ?? null;
      editedSplitsRef.current = newState;
      return newState;
    });
  }, []);

  const handleAddSplit = useCallback(() => {
    const currentSplitsForLength = editedSplitsRef.current ?? splits;
    const newSplit: Split = {
      id: newUuid(),
      name: `Split ${currentSplitsForLength.length + 1}`,
      color: "#FF5733",
      days: [],
      exercises: [],
    };
    let newState: Split[] | null = null;
    setEditedSplits(prev => {
      newState = [...(prev ?? []), newSplit];
      editedSplitsRef.current = newState;
      return newState;
    });
    setEditingSplitId(newSplit.id);
  }, [splits]);

  const handleDeleteSplit = useCallback((id: string) => {
    let newState: Split[] | null = null;
    setEditedSplits(prev => {
      newState = prev?.filter(split => split.id !== id) ?? null;
      editedSplitsRef.current = newState;
      if (editingSplitId === id) {
        setEditingSplitId(null);
      }
      return newState;
    });
  }, [editingSplitId]);

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

  const handleSplitSelect = useCallback(async (splitToAssign: Split) => {
      if (!selectedDay || editMode !== "program") return;

      const updatedSplits = splits.map((s) => {
        const daysWithoutSelected = s.days.filter((d) => d !== selectedDay);
      if (s.id === splitToAssign.id) {
        if (!daysWithoutSelected.includes(selectedDay)) {
          return { ...s, days: [...daysWithoutSelected, selectedDay] };
        }
        return { ...s, days: daysWithoutSelected };
        }
        return { ...s, days: daysWithoutSelected };
      });

    console.log("WorkoutScreen: Assigning split to day. Updated splits:", updatedSplits);
      updateSplits(updatedSplits);

      setSelectedDay(null);
      setSelectedSplit(null);
  }, [selectedDay, editMode, splits, updateSplits]);

  const handleSplitPress = useCallback((split: Split) => {
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

  const handleSplitDetailUpdate = useCallback(async (updatedSplit: Split) => {
      console.log("WorkoutScreen: Receiving update from SplitDetail:", updatedSplit);
      const updatedSplits = splits.map((split: Split) =>
        split.id === updatedSplit.id ? updatedSplit : split
      );
      const success = await saveSplitsToSupabase(updatedSplits);
      if (success) {
          updateSplits(updatedSplits);
          console.log("WorkoutScreen: Split updated and saved successfully from detail screen.");
      } else {
           console.error("WorkoutScreen: Failed to save split update from detail screen.");
      }
    },
    [splits, updateSplits, saveSplitsToSupabase]
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
              {/* Temporarily commented out for migration
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
                splits={splits}
                editMode={editMode}
                expandedExercises={expandedExercises}
                onToggleExerciseExpansion={toggleExerciseExpansion}
              />
              */}
            </VStack>
          </RNScrollView>
        </Box>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

export default WorkoutScreen;
