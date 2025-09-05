import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { StyleSheet, ScrollView, View, TextInput as RNTextInput } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Text, Pressable, HStack, VStack, Input, InputField, Button, ButtonText, Divider, useToast, Toast, ToastTitle, ToastDescription } from '@gluestack-ui/themed';
import { useWorkout } from '../contexts/WorkoutContext';
import { Entypo, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { navigate } from '../navigation/rootNavigation';
import { registerSelectionCallback } from '../navigation/selectionRegistry';
import { useLiveSessionSnapshot } from '../db/live/workouts';

// Using global navigation helper since this modal is rendered outside NavigationContainer

type RenderSet = { id: string; weight: number; reps: number; completed: boolean };
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
  const USER_ID = 'local-user'; // TODO: replace with auth when available
  
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
        weight: (s.weight as number | null | undefined) ? Number(s.weight) : 0,
        reps: s.reps ?? 0,
        completed: (s.completed ?? 0) === 1,
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
  const [tick, setTick] = useState(0); // periodic re-render for timer
  // currentExercises derived from live snapshot
  const [expandedExercises, setExpandedExercises] = useState<{[key: string]: boolean}>({});
  const [isEndingWorkout, setIsEndingWorkout] = useState(false);
  const [addingSetFor, setAddingSetFor] = useState<string | null>(null);
  const addingSetLockRef = useRef(false);
  const [isDiscardAlertOpen, setIsDiscardAlertOpen] = useState(false); // New state for discard alert
  
  // Snap points for different states - must be a memoized array to prevent re-renders
  // const snapPoints = useMemo(() => ['12%', '100%'], []);
  const snapPoints = useMemo(() => ['10%', '100%'], []);
  
  // Initialize with active session when opened
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isVisible) return;
      const sid = await getActiveSessionId(USER_ID);
      if (!sid) return;
      if (!cancelled) setSessionId(sid);
      // Fetch header info (split title, startedAt)
      try {
        const info = await getSessionInfo(sid);
        if (info?.startedAt) setSessionStartedAtMs(Date.parse(info.startedAt));
        if (info?.splitId) {
          const name = (await getSplitName(info.splitId)) || '';
          if (!cancelled) setSplitTitle(name);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [isVisible, USER_ID, getActiveSessionId, getSessionInfo, getSplitName]);
  
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
      setExpandedExercises({});
  // currentExercises derived from live snapshot; nothing to reset
      // Reset any other state as needed
    }
    
    return () => {
      console.log('ActiveWorkoutModal - Component cleanup, resetting state');
      setIsEndingWorkout(false);
      setExpandedExercises({});
  // currentExercises derived from live snapshot; nothing to reset
    };
  }, [isVisible]);

  // Timer tick: compute elapsed from sessionStartedAtMs
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isVisible && sessionStartedAtMs) {
      interval = setInterval(() => setTick((t) => t + 1), 1000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isVisible, sessionStartedAtMs]);
  
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
        if (sessionId) await endWorkout(sessionId, { status: 'completed' });
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
  }, [endWorkout, onSave, isEndingWorkout, toast, sessionId]);
  
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
  
  // Toggle exercise expansion
  const toggleExerciseExpansion = useCallback((exerciseId: string) => {
    setExpandedExercises(prev => ({
      ...prev,
      [exerciseId]: !prev[exerciseId]
    }));
  }, []);

  // Create state for TextInput temporary values
  const [localInputValues, setLocalInputValues] = useState<{[key: string]: {weight: string, reps: string}}>({});

  // Initialize localInputValues when exercises change
  useEffect(() => {
    if (currentExercises.length > 0) {
      const newValues: {[key: string]: {weight: string, reps: string}} = {};
      
      currentExercises.forEach((exercise, exerciseIndex) => {
        if (exercise.sets) {
          exercise.sets.forEach((set, setIndex) => {
            const key = `${exercise.id}-${set.id || setIndex}`;
            newValues[key] = {
              weight: set.weight > 0 ? String(set.weight) : '',
              reps: set.reps > 0 ? String(set.reps) : ''
            };
          });
        }
      });
      
      setLocalInputValues(newValues);
    }
  }, [currentExercises]);

  // Handle weight input change locally (no update to context)
  const handleInputChange = useCallback((exerciseId: string, setKey: string, field: 'weight' | 'reps', value: string) => {
    setLocalInputValues(prev => ({
      ...prev,
      [setKey]: {
        ...prev[setKey],
        [field]: value
      }
    }));
  }, []);

  // Handle reps input change locally (no update to context)
  const handleSetFieldBlur = useCallback((exerciseId: string, setIndex: number, field: 'weight' | 'reps') => {
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
    const original = set[field as 'weight' | 'reps'] || 0;
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
    updateSet(s.id, { completed: s.completed ? 0 : 1 } as any).catch(console.error);
  }, [currentExercises, updateSet, sessionId]);
  
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
  const renderHeader = () => (
    <Box bg="#2A2E38" px="$4" py="$3" borderColor="$borderDark700" borderBottomWidth={1} width="100%">
      <HStack justifyContent="center" alignItems="center">
        <VStack alignItems="center">
          <Text color="$textLight50" fontWeight="$bold" fontSize="$lg" numberOfLines={1}>
            {splitTitle || 'Active Workout'}
          </Text>
          <Text color="$primary400" fontWeight="$semibold" fontSize="$md">
            {formatTimer(elapsedSec)}
          </Text>
        </VStack>
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
    const localValue = localInputValues[setKey] || { weight: '', reps: '' };

    return (
      <HStack key={set.id || setIndex} alignItems="center" space="sm" my="$1" px="$1">
        <Pressable onPress={() => handleToggleSetCompletion(exerciseId, setIndex)} p="$2">
          <MaterialCommunityIcons
            name={set.completed ? "check-circle" : "checkbox-blank-circle-outline"}
            size={24}
            color={set.completed ? "#22c55e" : "#71717a"}
          />
        </Pressable>
        <Text w="$10" textAlign="center" color="$textLight400" fontWeight="$medium">Set {setIndex + 1}</Text>
        <Input flex={1} size="sm" variant="outline" borderColor="$borderDark700">
          <InputField
            placeholder="Weight"
            value={localValue.weight}
            onChangeText={(text) => handleInputChange(exerciseId, setKey, 'weight', text)}
            onBlur={() => handleSetFieldBlur(exerciseId, setIndex, 'weight')}
            keyboardType="numeric"
            color="$textLight50"
            placeholderTextColor="$textLight600"
            textAlign="center"
          />
        </Input>
        <Text color="$textLight400" px="$1">x</Text>
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
                  {currentExercises.map((exercise, exerciseIndex) => (
                    <Box key={exercise.id}>
                      <Pressable 
                        onPress={() => toggleExerciseExpansion(exercise.id)}
                      >
                        <Box 
                          bg={"transparent"} 
                          p="$4" 
                          borderRadius="$lg"
                        >
                          <HStack space="md" alignItems="center">
                            <Text color="$textLight50" fontSize="$lg" fontWeight="$semibold" flex={1} numberOfLines={1}>
                              {exercise.name}
                            </Text>
                            <Ionicons
                              name={expandedExercises[exercise.id] ? "chevron-up-outline" : "chevron-down-outline"}
                              size={20}
                              color="#adb5bd"
                            />
                          </HStack>
                          
                          {expandedExercises[exercise.id] && (
                            <VStack mt="$3" space="md">
                              {exercise.sets && exercise.sets.map((set, idx) => renderSetRow(set, exercise.id, idx, exerciseIndex))}
                              <Button variant="outline" action="secondary" onPress={() => handleAddNewSet(exercise.id)} mt="$2" size="sm" disabled={addingSetFor === exercise.id}>
                                <Ionicons name="add-outline" size={20} color="#6B8EF2" style={{ marginRight: 4 }} />
                                <ButtonText>Add Set</ButtonText>
                              </Button>
                            </VStack>
                          )}
                        </Box>
                      </Pressable>
                      
                      {/* Add divider after each exercise except the last one */}
                      {exerciseIndex < currentExercises.length - 1 && (
                        <Divider bg="$borderDark700" h={1} my="$1" opacity={1} width="95%" alignSelf="center" />
                      )}
                    </Box>
                  ))}
                </VStack>
                
                <Box mt="$2" mb="$2" px="$2">
                  <Button variant="solid" action="primary" onPress={handleAddExercisePress} my="$4" size="lg">
                    <Ionicons name="add-circle-outline" size={24} color="white" style={{ marginRight: 8 }}/>
                    <ButtonText>Add Exercise</ButtonText>
                  </Button>
                </Box>

                <HStack space="md" mt="$4" px="$2">
                  <Pressable
                    bg="transparent"
                    py="$3"
                    px="$6"
                    borderRadius="$lg"
                    borderWidth={1.5}
                    borderColor="$red500"
                    flex={1}
                    alignItems="center"
                    justifyContent="center"
                    $pressed={{ opacity: 0.6 }}
                    onPress={async () => {
                      // Discard: close modal and delete workout
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
                    <Text color="$red500" fontSize="$md" fontWeight="$bold" textAlign="center">
                      Discard Workout
                    </Text>
                  </Pressable>
              
                  <Pressable
                    bg={isEndingWorkout ? "$coolGray500" : "$red500"}
                    py="$3"
                    px="$6"
                    borderRadius="$lg"
                    onPress={handleEndWorkout}
                    $pressed={{ opacity: 0.6 }}
                    flex={1}
                    alignItems="center"
                    justifyContent="center"
                    opacity={isEndingWorkout ? 0.7 : 1}
                    disabled={isEndingWorkout}
                  >
                    <Text color="$textLight50" fontSize="$md" fontWeight="$bold" textAlign="center">
                      {isEndingWorkout ? "Saving..." : "Finish Workout"}
                    </Text>
                  </Pressable>
                </HStack>
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