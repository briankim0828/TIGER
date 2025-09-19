import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { StyleSheet, ScrollView, View, TextInput as RNTextInput } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Text, Pressable, HStack, VStack, Input, InputField, Button, ButtonText, Divider, useToast, Toast, ToastTitle, ToastDescription } from '@gluestack-ui/themed';
import { useWorkout } from '../contexts/WorkoutContext';
import { Entypo, Ionicons } from '@expo/vector-icons';
import { navigate } from '../navigation/rootNavigation';
import { registerSelectionCallback } from '../navigation/selectionRegistry';
import { useLiveSessionSnapshot } from '../db/live/workouts';
import { supabase } from '../utils/supabaseClient';

// Using global navigation helper since this modal is rendered outside NavigationContainer

type RenderSet = { id: string; weightKg: number; reps: number; isCompleted: boolean };
type RenderExercise = { id: string; name: string; sets: RenderSet[] };

interface ActiveWorkoutModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSave?: () => Promise<void>; // Optional custom handler
}

const ActiveWorkoutModal: React.FC<ActiveWorkoutModalProps> = ({
  isVisible,
  onClose,
  onSave
}) => {
  const insets = useSafeAreaInsets();
  // navigation handled via global ref
  const { getActiveSessionId, addSet, updateSet, deleteSet, endWorkout, addExerciseToSession, removeExerciseFromSession, getSplitName, deleteWorkout, getSessionInfo } = useWorkout();
  const toast = useToast();
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setAuthUserId(user?.id ?? null);
      } catch {}
    })();
  }, []);
  
  const [sessionId, setSessionId] = useState<string | null>(null);
  // Live snapshot for current session
  const { snapshot } = useLiveSessionSnapshot(sessionId);
  const currentExercises: RenderExercise[] = useMemo(() => {
    if (!snapshot || !snapshot.exercises) return [];
    return snapshot.exercises.map((ex) => ({
      id: ex.exercise.id,
      name: ex.exercise.name,
      sets: (snapshot.setsByExercise[ex.sessionExerciseId] || []).map((s) => ({
        id: s.id,
        weightKg: (s.weightKg as number | null | undefined) ? Number(s.weightKg) : 0,
        reps: s.reps ?? 0,
        isCompleted: !!(s as any).isCompleted || (s as any).isCompleted === 1,
      })),
    }));
  }, [snapshot]);
  const exerciseIdToSessionExerciseId = useMemo(() => {
    const map: Record<string, string> = {};
    if (snapshot && snapshot.exercises) {
      for (const j of snapshot.exercises) map[j.exercise.id] = j.sessionExerciseId;
    }
    return map;
  }, [snapshot]);

  // Refs
  const bottomSheetRef = useRef<BottomSheet>(null);
  const cancelRef = useRef(null); // Ref for AlertDialog cancel button
  
  // State
  const [sessionStartedAtMs, setSessionStartedAtMs] = useState<number | null>(null);
  const [isBackdated, setIsBackdated] = useState<boolean>(false);
  const [tick, setTick] = useState(0); // periodic re-render for timer
  // Exercises are always expanded now (no expand/collapse state)
  const [isEndingWorkout, setIsEndingWorkout] = useState(false);
  const [addingSetFor, setAddingSetFor] = useState<string | null>(null);
  const addingSetLockRef = useRef(false);
  const [isDiscardAlertOpen, setIsDiscardAlertOpen] = useState(false); // New state for discard alert
  // Pressed state tracking for reliable opacity feedback
  const [isFinishPressed, setIsFinishPressed] = useState(false);
  const [pressedAddSetFor, setPressedAddSetFor] = useState<string | null>(null);
  const [isAddExercisesPressed, setIsAddExercisesPressed] = useState(false);
  const [isCancelWorkoutPressed, setIsCancelWorkoutPressed] = useState(false);
  
  // Snap points for different states - must be a memoized array to prevent re-renders
  // const snapPoints = useMemo(() => ['12%', '100%'], []);
  const snapPoints = useMemo(() => ['10%', '100%'], []);
  
  // Initialize with active session when opened
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isVisible) return;
  if (!authUserId) return;
  const sid = await getActiveSessionId(authUserId);
      if (!sid) return;
      if (!cancelled) setSessionId(sid);
      // Fetch header info (split title, startedAt)
      try {
        const info = await getSessionInfo(sid);
        if (info?.startedAt) {
          const startedMs = Date.parse(info.startedAt);
          setSessionStartedAtMs(startedMs);
          // Determine if this is a backdated session (started before today)
          try {
            const startedDate = new Date(startedMs);
            const today = new Date();
            const startedYmd = `${startedDate.getFullYear()}-${String(startedDate.getMonth() + 1).padStart(2, '0')}-${String(startedDate.getDate()).padStart(2, '0')}`;
            const todayYmd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            setIsBackdated(startedYmd < todayYmd);
          } catch {}
        }
        if (info?.splitId) {
          const name = (await getSplitName(info.splitId)) || '';
          if (!cancelled) setSplitTitle(name);
        } else {
          // No split assigned: use weekday-based title from startedAt (or today if missing)
          const baseDate = info?.startedAt ? new Date(info.startedAt) : new Date();
          const weekday = baseDate.toLocaleDateString('en-US', { weekday: 'long' });
          if (!cancelled) setSplitTitle(`${weekday} workout`);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [isVisible, authUserId, getActiveSessionId, getSessionInfo, getSplitName]);
  
  // Open/close bottom sheet based on visibility
  useEffect(() => {
    const timer = setTimeout(() => {
  if (isVisible && bottomSheetRef.current) {
        bottomSheetRef.current.expand(); // Open to full height
  } else if (!isVisible && bottomSheetRef.current) {
        bottomSheetRef.current.close();
      }
    }, 100);
    
    return () => clearTimeout(timer);
  }, [isVisible]);
  
  // Reset flags when modal closes; keep startedAt for accurate timer on reopen
  useEffect(() => {
    if (!isVisible) {
      console.log('ActiveWorkoutModal - Visibility changed to false, resetting state');
      setIsEndingWorkout(false);
  // no expansion state to reset
  // currentExercises derived from live snapshot; nothing to reset
      // Reset any other state as needed
    }
    
    return () => {
      console.log('ActiveWorkoutModal - Component cleanup, resetting state');
      setIsEndingWorkout(false);
  // no expansion state to reset
  // currentExercises derived from live snapshot; nothing to reset
    };
  }, [isVisible]);

  // Timer tick: compute elapsed from sessionStartedAtMs
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isVisible && sessionStartedAtMs && !isBackdated) {
      interval = setInterval(() => setTick((t) => t + 1), 1000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isVisible, sessionStartedAtMs, isBackdated]);
  
  // Handle bottom sheet changes
  const handleSheetChanges = useCallback((index: number) => {
    // If sheet is closed, call onClose
    if (index === -1) {
      // console.log('ActiveWorkoutModal - Sheet closed, calling onClose');
      onClose();
    }
  }, [onClose]);
  
  // End workout
  const handleEndWorkout = useCallback(async () => {
    console.log('ActiveWorkoutModal - Ending workout');
    
    // Prevent multiple clicks from triggering multiple saves
    if (isEndingWorkout) {
      console.log('ActiveWorkoutModal - Already ending workout, ignoring duplicate call');
      return;
    }
    
    // Set flag to prevent multiple calls
    setIsEndingWorkout(true);
    
    try {
      // Use the provided onSave prop if available, otherwise fall back to endWorkout
      if (onSave) {
        console.log('ActiveWorkoutModal - Using provided onSave handler');
        await onSave();
      } else {
        console.log('ActiveWorkoutModal - Calling endWorkout (DB)');
        if (sessionId) {
          let finishedAtOverride: string | undefined;
          if (isBackdated && sessionStartedAtMs) {
            const dt = new Date(sessionStartedAtMs);
            const localNoon = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 12, 0, 0);
            finishedAtOverride = localNoon.toISOString();
          }
          await endWorkout(sessionId, { status: 'completed', finishedAtOverride });
        }
      }
      console.log('ActiveWorkoutModal - Save operation completed successfully');
      
      // After successful save, close the modal
      bottomSheetRef.current?.close();
      toast.show({
        placement: "top",
        render: ({ id }) => (
          <Toast nativeID={id} action="success" variant="accent">
            <VStack space="xs">
              <ToastTitle>Workout Saved</ToastTitle>
              <ToastDescription>Your workout session has been saved successfully.</ToastDescription>
            </VStack>
          </Toast>
        ),
      });
    } catch (error) {
      console.error('Error ending workout:', error);
      // Reset the flag if there was an error
      setIsEndingWorkout(false);
      toast.show({
        placement: "top",
        render: ({ id }) => (
          <Toast nativeID={id} action="error" variant="accent">
            <VStack space="xs">
              <ToastTitle>Save Error</ToastTitle>
              <ToastDescription>Could not save your workout. Please try again.</ToastDescription>
            </VStack>
          </Toast>
        ),
      });
    }
  }, [endWorkout, onSave, isEndingWorkout, toast, sessionId, isBackdated, sessionStartedAtMs]);
  
  // Format timer as MM:SS
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Log when active exercise changes
  // useEffect(() => {
  //   if (currentExercises.length > 0) {
  //     console.log('ActiveWorkoutModal - Exercises loaded:', {
  //       count: currentExercises.length,
  //       exercises: currentExercises.map(ex => ({
  //         id: ex.id,
  //         name: ex.name,
  //         bodyPart: ex.bodyPart,
  //         sets: ex.sets?.length
  //       }))
  //     });
  //   }
  // }, [currentExercises]);
  
  // Expansion removed: exercises are always expanded

  // Create state for TextInput temporary values
  const [localInputValues, setLocalInputValues] = useState<{[key: string]: {weightKg: string, reps: string}}>({});

  // Initialize localInputValues when exercises change
  useEffect(() => {
    if (currentExercises.length > 0) {
  const newValues: {[key: string]: {weightKg: string, reps: string}} = {};
      
      currentExercises.forEach((exercise, exerciseIndex) => {
        if (exercise.sets) {
          exercise.sets.forEach((set, setIndex) => {
            const key = `${exercise.id}-${set.id || setIndex}`;
            newValues[key] = {
              weightKg: set.weightKg > 0 ? String(set.weightKg) : '',
              reps: set.reps > 0 ? String(set.reps) : ''
            };
          });
        }
      });
      
      setLocalInputValues(newValues);
    }
  }, [currentExercises]);

  // Handle weight input change locally (no update to context)
  const handleInputChange = useCallback((exerciseId: string, setKey: string, field: 'weightKg' | 'reps', value: string) => {
    setLocalInputValues(prev => ({
      ...prev,
      [setKey]: {
        ...prev[setKey],
        [field]: value
      }
    }));
  }, []);

  // Handle reps input change locally (no update to context)
  const handleSetFieldBlur = useCallback((exerciseId: string, setIndex: number, field: 'weightKg' | 'reps') => {
    const ex = currentExercises.find((e) => e.id === exerciseId);
    if (!ex) return;
    const set = ex.sets[setIndex];
    if (!set) return;

    const setKey = `${exerciseId}-${set.id || setIndex}`;
    const numericValue = parseFloat(localInputValues[setKey]?.[field] || '0');
    if (isNaN(numericValue) && (localInputValues[setKey]?.[field]?.trim() !== '')) {
      toast.show({
        placement: 'top',
        render: ({ id }) => (
          <Toast nativeID={id} action="error" variant="accent">
            <VStack space="xs">
              <ToastTitle>Invalid Input</ToastTitle>
              <ToastDescription>Please enter a valid number for {field}.</ToastDescription>
            </VStack>
          </Toast>
        ),
      });
      return;
    }
    const currentValue = localInputValues[setKey]?.[field] || '';
  const original = set[field as 'weightKg' | 'reps'] || 0;
    const next = currentValue.trim() === '' ? 0 : (isNaN(numericValue) ? original : numericValue);
    if (next !== original) {
  updateSet(set.id, { [field]: next } as any).catch(console.error);
    }
  }, [currentExercises, localInputValues, updateSet, toast, sessionId]);

  // Handle set completion toggle
  const handleToggleSetCompletion = useCallback((exerciseId: string, setIndex: number) => {
    const ex = currentExercises.find((e) => e.id === exerciseId);
    if (!ex) return;
    const s = ex.sets[setIndex];
    if (!s) return;

    const setKey = `${exerciseId}-${s.id || setIndex}`;
    const local = localInputValues[setKey] || { weightKg: '', reps: '' };
    const hasWeight = (local.weightKg ?? '').toString().trim() !== '';
    const hasReps = (local.reps ?? '').toString().trim() !== '';
    const canComplete = hasWeight && hasReps;

    // If attempting to complete but inputs are not present, ignore
    if (!s.isCompleted && !canComplete) return;

    if (!s.isCompleted) {
      // Completing: persist current values and set isCompleted=true
      const w = parseFloat(local.weightKg);
      const r = parseFloat(local.reps);
      if (isNaN(w) || isNaN(r)) {
        toast.show({
          placement: 'top',
          render: ({ id }) => (
            <Toast nativeID={id} action="error" variant="accent">
              <VStack space="xs">
                <ToastTitle>Invalid Input</ToastTitle>
                <ToastDescription>Please enter numeric values for weight and reps before completing.</ToastDescription>
              </VStack>
            </Toast>
          ),
        });
        return;
      }
      updateSet(s.id, { weightKg: w, reps: r, isCompleted: true } as any).catch(console.error);
    } else {
      // Un-completing: allow editing again
      updateSet(s.id, { isCompleted: false } as any).catch(console.error);
    }
  }, [currentExercises, localInputValues, updateSet, toast]);
  
  // Handle Add Set button click
  const handleAddNewSet = useCallback((exerciseId: string) => {
    if (!sessionId) return;
    if (addingSetLockRef.current) return; // hard guard against double-taps within the same frame
    const idx = currentExercises.findIndex((e) => e.id === exerciseId);
    if (idx === -1) return;
    const sessionExerciseId = exerciseIdToSessionExerciseId[exerciseId];
    if (!sessionExerciseId) return;
    addingSetLockRef.current = true;
    setAddingSetFor(exerciseId);
    (async () => { await addSet(sessionExerciseId, {}); })()
      .catch(console.error)
      .finally(() => {
        addingSetLockRef.current = false;
        setAddingSetFor(null);
      });
  }, [addSet, currentExercises, sessionId, exerciseIdToSessionExerciseId]);

  // Function to handle the actual discard action using the context function
  const handleConfirmDiscard = useCallback(() => {
    console.log('ActiveWorkoutModal - Confirming discard');
    setIsDiscardAlertOpen(false);
    if (sessionId) {
      endWorkout(sessionId, { status: 'cancelled' })
        .then(() => bottomSheetRef.current?.close())
        .finally(() => {
          toast.show({
            placement: 'top',
            render: ({ id }) => (
              <Toast nativeID={id} action="info" variant="accent">
                <VStack space="xs">
                  <ToastTitle>Workout Discarded</ToastTitle>
                </VStack>
              </Toast>
            ),
          });
        });
    }
  }, [endWorkout, sessionId, toast]);

  // Function to open the discard confirmation dialog
  const openDiscardAlert = () => {
    setIsDiscardAlertOpen(true);
  };

  const handleAddExercisePress = () => {
    if (!sessionId) return;
    console.log('ActiveWorkoutModal - Navigating to Exercise Selection (session mode)');
    const requestId = `session-add-${sessionId}-${Date.now()}`;
    registerSelectionCallback(requestId, async (items) => {
      try {
        for (const ex of items) {
          await addExerciseToSession(sessionId, ex.id);
        }
      } catch (e) {
        console.error('ActiveWorkoutModal: failed to add selected exercises to session', e);
      }
    });
    // Navigate with a generic selection request
    navigate('ExerciseSelectionModalScreen', { requestId, allowMultiple: true });
  };

  const [splitTitle, setSplitTitle] = useState<string>('');
  const elapsedSec = sessionStartedAtMs ? Math.max(0, Math.floor((Date.now() - sessionStartedAtMs) / 1000)) : 0;
  const formattedDate = useMemo(() => {
    if (!sessionStartedAtMs) return '';
    try {
      return new Date(sessionStartedAtMs).toLocaleDateString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric',
      });
    } catch {
      return '';
    }
  }, [sessionStartedAtMs]);

  const renderHeader = () => (
    <Box bg="#2A2E38" px="$4" py="$3" width="100%">
      <HStack alignItems="center" justifyContent="space-between" width="100%" position="relative">
        {/* Left: Split name + date */}
        <VStack alignItems="flex-start" flexShrink={1} maxWidth="37%">
          <Text
            color="$textLight50"
            fontWeight="$bold"
            fontSize="$lg"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {splitTitle || 'Active Workout'}
          </Text>
          {!!formattedDate && (
            <Text color="$textLight400" fontSize="$sm" numberOfLines={1}>{formattedDate}</Text>
          )}
        </VStack>

        {/* Centered Timer overlay (hidden for backdated sessions) */}
        <Box position="absolute" left={0} right={0} alignItems="center" pointerEvents="none">
          {!isBackdated && (
            <Text color="$primary400" fontWeight="$semibold" fontSize="$md">
              {formatTimer(elapsedSec)}
            </Text>
          )}
        </Box>

        {/* Right: Finish button */}
        <Pressable
          onPressIn={() => setIsFinishPressed(true)}
          onPressOut={() => setIsFinishPressed(false)}
          onPress={isEndingWorkout ? undefined : handleEndWorkout}
          disabled={isEndingWorkout}
          pointerEvents={isEndingWorkout ? 'none' : 'auto'}
          bg="#22c55e"
          py="$2"
          px="$4"
          borderRadius="$lg"
          style={{ opacity: isFinishPressed ? 0.7 : 1 }}
        >
          <Text color="$textLight50" fontWeight="$bold">{isEndingWorkout ? 'Saving…' : 'Finish'}</Text>
        </Pressable>
      </HStack>
    </Box>
  );

  const renderSetRow = (set: RenderSet | undefined, exerciseId: string, setIndex: number, exerciseIndexProp: number) => {
    // Check for undefined set
    if (!set) {
      console.warn(`renderSetRow called with undefined set for exerciseId: ${exerciseId}, setIndex: ${setIndex}`);
      return null; 
    }
    
    const setKey = `${exerciseId}-${set.id || setIndex}`;
    const localValue = localInputValues[setKey] || { weightKg: '', reps: '' };
    const previousText = '—';

    const isCompleted = !!set.isCompleted;
    const hasWeight = (localValue.weightKg ?? '').toString().trim() !== '';
    const hasReps = (localValue.reps ?? '').toString().trim() !== '';
    const canComplete = hasWeight && hasReps;

    return (
      <HStack
        key={set.id || setIndex}
        alignItems="center"
        space="xs"
        my="$0"
        width="100%"
        style={{
          backgroundColor: isCompleted ? 'rgba(34, 197, 94, 0.12)' : 'transparent',
          borderRadius: 8,
        }}
      >
  {/* Set number */}
  <Text w="$10" textAlign="center" color="$textLight50" fontWeight="$bold">{setIndex + 1}</Text>
        {/* Previous column placeholder */}
        <Text flex={1} textAlign="center" color="$textLight500">{previousText}</Text>
        {/* Weight (lbs) */}
        {isCompleted ? (
          <Input flex={1} size="sm" variant="outline" borderColor="transparent" style={{ backgroundColor: 'transparent' }} pointerEvents="none">
            <InputField
              value={(localValue.weightKg ?? '').toString().trim() || (set.weightKg ? String(set.weightKg) : '')}
              editable={false}
              color="$textLight50"
              textAlign="center"
            />
          </Input>
        ) : (
          <Input flex={1} size="sm" variant="outline" borderColor="$borderDark700">
            <InputField
              placeholder="lbs"
              value={localValue.weightKg}
              onChangeText={(text) => handleInputChange(exerciseId, setKey, 'weightKg', text)}
              onBlur={() => handleSetFieldBlur(exerciseId, setIndex, 'weightKg')}
              keyboardType="numeric"
              color="$textLight50"
              placeholderTextColor="$textLight600"
              textAlign="center"
            />
          </Input>
        )}
        {/* Reps */}
        {isCompleted ? (
          <Input flex={1} size="sm" variant="outline" borderColor="transparent" style={{ backgroundColor: 'transparent' }} pointerEvents="none">
            <InputField
              value={(localValue.reps ?? '').toString().trim() || (set.reps ? String(set.reps) : '')}
              editable={false}
              color="$textLight50"
              textAlign="center"
            />
          </Input>
        ) : (
          <Input flex={1} size="sm" variant="outline" borderColor="$borderDark700">
            <InputField
              placeholder="Reps"
              value={localValue.reps}
              onChangeText={(text) => handleInputChange(exerciseId, setKey, 'reps', text)}
              onBlur={() => handleSetFieldBlur(exerciseId, setIndex, 'reps')}
              keyboardType="numeric"
              color="$textLight50"
              placeholderTextColor="$textLight600"
              textAlign="center"
            />
          </Input>
        )}
        {/* Completion toggle on the right */}
        <Pressable
          onPress={() => canComplete || isCompleted ? handleToggleSetCompletion(exerciseId, setIndex) : undefined}
          disabled={!canComplete && !isCompleted}
          $pressed={{ opacity: 0.9 }}
          style={{
            backgroundColor: isCompleted ? '#22c55e' : '#1E222C',
            width: 28,
            height: 28,
            borderRadius: 6,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: !canComplete && !isCompleted ? 0.5 : 1,
          }}
          accessibilityRole="button"
          accessibilityLabel={isCompleted ? 'Mark set incomplete' : (canComplete ? 'Mark set complete' : 'Complete set (disabled)')}
        >
          <Ionicons
            name="checkmark"
            size={18}
            color={isCompleted ? '#FFFFFF' : (canComplete ? '#FFFFFF' : '#71717a')}
          />
        </Pressable>
      </HStack>
    );
  };

  return (
    <GestureHandlerRootView style={styles.rootContainer} pointerEvents="box-none">
      <BottomSheet
        ref={bottomSheetRef}
        onChange={handleSheetChanges}
        enablePanDownToClose={true}
        index={isVisible ? 1 : -1}
        snapPoints={snapPoints}
  topInset={insets.top}
        // Match SessionSummaryModal visuals: dark background + white notch
        handleIndicatorStyle={{ backgroundColor: 'white', width: 40, height: 4 }}
        backgroundStyle={{ backgroundColor: '#2A2E38' }}
      >
        <BottomSheetView style={styles.contentContainer}>
          {renderHeader()}
          <Box flex={1} width="100%" display="flex" >
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
              <Box width="100%" pb={30}> {/* Added padding to bottom for button area */}
                
                {/* Exercise list with sets */}
                <VStack space="sm" width="100%">
                  {currentExercises.map((exercise) => (
                    <Box key={exercise.id}>
                      <Box bg={"transparent"} p="$3" borderRadius="$lg" width="100%">
                        <HStack space="sm" alignItems="center">
                          <Text color="$primary400" fontSize="$lg" fontWeight="$semibold" flex={1} numberOfLines={1}>
                            {exercise.name}
                          </Text>
                        </HStack>

                        {/* Always-expanded sets section */}
                        <VStack mt="$2" space="xs" width="100%">
                          {/* Column headers */}
                          <HStack alignItems="center" justifyContent="space-between" mb="$0" width="100%">
                            <Text color="$textLight50" w="$10" textAlign="center" fontSize="$sm">Set</Text>
                            <Text color="$textLight50" flex={1} textAlign="center" fontSize="$sm">Previous</Text>
                            <Text color="$textLight50" flex={1} textAlign="center" fontSize="$sm">lbs</Text>
                            <Text color="$textLight50" flex={1} textAlign="center" fontSize="$sm">Reps</Text>
                            <View style={{ width: 28, alignItems: 'center' }}>
                              <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                            </View>
                          </HStack>

                          {exercise.sets && exercise.sets.map((set, idx) => renderSetRow(set, exercise.id, idx, 0))}

                          <Pressable
                            onPressIn={() => setPressedAddSetFor(exercise.id)}
                            onPressOut={() => setPressedAddSetFor(null)}
                            onPress={() => handleAddNewSet(exercise.id)}
                            disabled={addingSetFor === exercise.id}
                            bg="#1E222C"
                            py="$1"
                            px="$3"
                            borderRadius="$md"
                            style={{ width: '100%', opacity: pressedAddSetFor === exercise.id ? 0.7 : 1 }}
                          >
                            <Text color="$textLight200" textAlign="center">+ Add Set</Text>
                          </Pressable>
                        </VStack>
                      </Box>
                    </Box>
                  ))}
                </VStack>
                
                <Box mt="$1" mb="$1" px="$2">
                  <Pressable
                    onPressIn={() => setIsAddExercisesPressed(true)}
                    onPressOut={() => setIsAddExercisesPressed(false)}
                    onPress={handleAddExercisePress}
                    bg="#1A2E5A"
                    style={{ backgroundColor: 'rgba(59, 130, 246, 0.18)', opacity: isAddExercisesPressed ? 0.8 : 1 }}
                    py="$1"
                    px="$6"
                    borderRadius="$lg"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <HStack alignItems="center" space="sm">
                      <Ionicons name="add-circle-outline" size={22} color="#3B82F6" />
                      <Text color="#3B82F6" fontSize="$md" fontWeight="$bold">Add Exercises</Text>
                    </HStack>
                  </Pressable>
                </Box>

                <Box mb="$5" px="$2">
                  <Pressable
                    onPressIn={() => setIsCancelWorkoutPressed(true)}
                    onPressOut={() => setIsCancelWorkoutPressed(false)}
                    bg="#3B2B2B"
                    py="$1"
                    px="$6"
                    borderRadius="$lg"
                    alignItems="center"
                    justifyContent="center"
                    style={{ opacity: isCancelWorkoutPressed ? 0.7 : 1 }}
                    onPress={async () => {
                      // Cancel workout: close modal and delete workout
                      if (sessionId) {
                        try {
                          await deleteWorkout(sessionId);
                          bottomSheetRef.current?.close();
                          toast.show({
                            placement: 'top',
                            render: ({ id }) => (
                              <Toast nativeID={id} action="info" variant="accent">
                                <VStack space="xs">
                                  <ToastTitle>Workout Discarded</ToastTitle>
                                </VStack>
                              </Toast>
                            ),
                          });
                        } catch (e) {
                          console.error('Failed to discard workout', e);
                        }
                      }
                    }}
                  >
                    <Text color="$red400" fontSize="$md" fontWeight="$bold" textAlign="center">Cancel Workout</Text>
                  </Pressable>
                </Box>
              </Box>
            </ScrollView>
          </Box>
        </BottomSheetView>
      </BottomSheet>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  rootContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    zIndex: 999,
    pointerEvents: 'box-none',
  },
  contentContainer: {
    flex: 1,
    width: '100%',
    paddingBottom: 0,
    backgroundColor: '#2A2E38',
  paddingHorizontal: 0,
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    width: '100%',
  },
  bottomSheetBackground: {
    backgroundColor: '#2A2E38',
  },
});

export default ActiveWorkoutModal; 