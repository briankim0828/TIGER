import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { StyleSheet, ScrollView, View, TextInput as RNTextInput } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import {
  Box,
  Text,
  Pressable,
  HStack,
  VStack,
  Input,
  InputField,
  Button,
  ButtonText,
  ButtonIcon,
  Divider,
  useToast,
  Toast,
  ToastTitle,
  ToastDescription,
  CloseIcon,
  Heading,
  CheckCircleIcon,
  CircleIcon,
} from '@gluestack-ui/themed';
import { Exercise, Set } from '../types';
import { useWorkout } from '../contexts/WorkoutContext';
import { Entypo, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

// Define your root stack param list if not already done globally
// Make sure this matches your actual navigation setup
type RootStackParamList = {
  // ... include other screens from your root stack
  MainTabs: undefined; // Example
  ExerciseSelectionModalScreen: undefined; // Add this line
  // If ExerciseSelectionView needs params like splitName:
  // ExerciseSelectionModalScreen: { splitName: string | null };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface ActiveWorkoutModalProps {
  isVisible: boolean;
  exercises: Exercise[];
  onClose: () => void;
  onSave?: () => Promise<void>;  // Optional prop for handling save operation
}

const ActiveWorkoutModal: React.FC<ActiveWorkoutModalProps> = ({
  isVisible,
  exercises,
  onClose,
  onSave
}) => {
  const navigation = useNavigation<NavigationProp>();
  // Use the new discardWorkout function from context
  const { updateSet, currentWorkoutSession, addSet, endWorkout, discardWorkout } = useWorkout();
  const toast = useToast();
  
  // Log props when component mounts or props change
  useEffect(() => {
    // console.log('ActiveWorkoutModal - Activated with data:', {
    //   isVisible,
    //   exercises: exercises.map(ex => ({
    //     id: ex.id,
    //     name: ex.name,
    //     bodyPart: ex.bodyPart,
    //     sets: ex.sets?.length
    //   }))
    // });
    
    if (currentWorkoutSession && isVisible) {
      console.log('ActiveWorkoutModal - Current workout session:', {
        session_date: currentWorkoutSession.session_date,
        // split_id: currentWorkoutSession.split_id,
        // user_id: currentWorkoutSession.user_id,
        exercises_count: currentWorkoutSession.exercises.length,
        exercises: currentWorkoutSession.exercises.map(ex => ({          
          name: ex.name,      
        }))
        // sets_status: currentWorkoutSession.sets.map((exerciseSets, i) => ({
        //   exercise: currentWorkoutSession.exercises[i]?.name,
        //   sets: exerciseSets.map(set => ({
        //     id: set.id,
        //     weight: set.weight,
        //     reps: set.reps,
        //     completed: set.completed
        //   }))
        // }))
      });
    }
  }, [isVisible, exercises, currentWorkoutSession]);

  // Refs
  const bottomSheetRef = useRef<BottomSheet>(null);
  const cancelRef = useRef(null); // Ref for AlertDialog cancel button
  
  // State
  const [workoutTimer, setWorkoutTimer] = useState(0);
  const [currentExercises, setCurrentExercises] = useState<Exercise[]>([]);
  const [expandedExercises, setExpandedExercises] = useState<{[key: string]: boolean}>({});
  const [isEndingWorkout, setIsEndingWorkout] = useState(false);
  const [isDiscardAlertOpen, setIsDiscardAlertOpen] = useState(false); // New state for discard alert
  
  // Snap points for different states - must be a memoized array to prevent re-renders
  // const snapPoints = useMemo(() => ['12%', '100%'], []);
  const snapPoints = useMemo(() => ['10%', '100%'], []);
  
  // Initialize with exercises
  useEffect(() => {
    // if (exercises.length > 0) {
    //   console.log('ActiveWorkoutModal - Setting current exercises:', JSON.stringify(exercises, null, 2));
    //   setCurrentExercises(exercises);
    // }

    // console.log('ActiveWorkoutModal - Setting current exercises:', JSON.stringify(exercises, null, 2));
    setCurrentExercises(exercises);
  }, [exercises]);
  
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
  
  // Reset isEndingWorkout when modal closes or visibility changes
  useEffect(() => {
    if (!isVisible) {
      console.log('ActiveWorkoutModal - Visibility changed to false, resetting state');
      setIsEndingWorkout(false);
      setWorkoutTimer(0);
      setExpandedExercises({});
      setCurrentExercises([]);
      // Reset any other state as needed
    }
    
    return () => {
      console.log('ActiveWorkoutModal - Component cleanup, resetting state');
      setIsEndingWorkout(false);
      setWorkoutTimer(0);
      setExpandedExercises({});
      setCurrentExercises([]);
    };
  }, [isVisible]);
  
  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (isVisible) {
      interval = setInterval(() => {
        setWorkoutTimer(prev => prev + 1);
      }, 1000);
    } else {
      setWorkoutTimer(0); // Reset timer when closed
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isVisible]);
  
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
        console.log('ActiveWorkoutModal - Calling endWorkout from context directly');
        await endWorkout();
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
  }, [endWorkout, onSave, isEndingWorkout, toast]);
  
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
    const exerciseIndex = currentExercises.findIndex(ex => ex.id === exerciseId);
    if (exerciseIndex === -1) return;

    const exercise = currentExercises[exerciseIndex];
    if (!exercise || !exercise.sets || !exercise.sets[setIndex]) return;

    const setKey = `${exerciseId}-${exercise.sets[setIndex].id || setIndex}`;
    const numericValue = parseFloat(localInputValues[setKey]?.[field] || '0');
    
    if (isNaN(numericValue) && (localInputValues[setKey]?.[field]?.trim() !== '')) {
        toast.show({
            placement: "top",
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
    
    const originalSetValue = exercise.sets[setIndex][field];
    const currentValue = localInputValues[setKey]?.[field] || '';
    
    if (currentValue.trim() === '' && originalSetValue !== 0) {
        updateSet(exerciseIndex, setIndex, { [field]: 0 });
    } else if (!isNaN(numericValue) && numericValue !== originalSetValue) {
        updateSet(exerciseIndex, setIndex, { [field]: numericValue });
    }
  }, [currentExercises, localInputValues, updateSet, toast]);

  // Handle set completion toggle
  const handleToggleSetCompletion = useCallback((exerciseId: string, setIndex: number) => {
    const exerciseIndex = currentExercises.findIndex(ex => ex.id === exerciseId);
    if (exerciseIndex === -1) return;

    const exercise = currentExercises[exerciseIndex];
    if (exercise && exercise.sets && exercise.sets[setIndex]) {
      const currentSet = exercise.sets[setIndex];
      updateSet(exerciseIndex, setIndex, { completed: !currentSet.completed });
    }
  }, [currentExercises, updateSet]);
  
  // Handle Add Set button click
  const handleAddNewSet = useCallback((exerciseId: string) => {
    console.log(`ActiveWorkoutModal - Adding set for exercise ${exerciseId}`);
    const exerciseIndex = currentExercises.findIndex(ex => ex.id === exerciseId);
    if (exerciseIndex !== -1) {
        addSet(exerciseIndex); // Use exerciseIndex (number)
    } else {
        console.error("Could not find exercise to add set to:", exerciseId);
    }
  }, [addSet, currentExercises]); // Added currentExercises dependency

  // Function to handle the actual discard action using the context function
  const handleConfirmDiscard = useCallback(() => {
    console.log('ActiveWorkoutModal - Confirming discard');
    setIsDiscardAlertOpen(false); // Close the alert
    discardWorkout(); // Call the context function to discard the workout
    bottomSheetRef.current?.close(); // Close the modal
    toast.show({
      placement: "top",
      render: ({ id }) => (
        <Toast nativeID={id} action="info" variant="accent">
          <VStack space="xs">
            <ToastTitle>Workout Discarded</ToastTitle>
          </VStack>
        </Toast>
      ),
    });
  }, [discardWorkout, toast]);

  // Function to open the discard confirmation dialog
  const openDiscardAlert = () => {
    setIsDiscardAlertOpen(true);
  };

  const handleAddExercisePress = () => {
    console.log('ActiveWorkoutModal - Navigating to Exercise Selection');
    navigation.navigate('ExerciseSelectionModalScreen');
  };

  const renderHeader = () => (
    <Box
      bg="$backgroundDark900"
      px="$4"
      py="$3"
      borderTopLeftRadius="$lg"
      borderTopRightRadius="$lg"
      borderColor="$borderDark700"
      borderBottomWidth={1}
    >
      <HStack justifyContent="space-between" alignItems="center">
        <Pressable onPress={openDiscardAlert} p="$2">
          <Ionicons name="close-outline" size={30} color="#adb5bd" />
        </Pressable>
        <VStack alignItems="center">
          <Text color="$textLight50" fontWeight="$bold" fontSize="$lg">
            Active Workout
          </Text>
          <Text color="$primary400" fontWeight="$semibold" fontSize="$md">
            {formatTimer(workoutTimer)}
          </Text>
        </VStack>
        <Button variant="link" onPress={handleEndWorkout} p="$2">
          <ButtonText color="$primary400" fontWeight="$semibold" fontSize="$md">Save</ButtonText>
        </Button>
      </HStack>
    </Box>
  );

  const renderSetRow = (set: Set | undefined, exerciseId: string, setIndex: number, exerciseIndexProp: number) => {
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
        handleComponent={renderHeader}
        backgroundStyle={styles.bottomSheetBackground}
      >
        <BottomSheetView style={styles.contentContainer}>
          <Box flex={1} width="100%" display="flex">
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
                              <Button variant="outline" action="secondary" onPress={() => handleAddNewSet(exercise.id)} mt="$2" size="sm">
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
                    onPress={openDiscardAlert}
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
    zIndex: 100,
    pointerEvents: 'box-none',
  },
  contentContainer: {
    flex: 1,
    width: '100%',
    paddingBottom: 0,
    backgroundColor: '#1E2028',
    paddingHorizontal: 16,
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