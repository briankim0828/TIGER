import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { StyleSheet, ScrollView, View, TextInput } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { Box, Text, Pressable, HStack, VStack, Input, Button, Divider, Icon } from 'native-base';
import { Exercise } from '../types';
import { useWorkout } from '../contexts/WorkoutContext';
import { Ionicons } from '@expo/vector-icons';

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
  // Access the updateSet function from WorkoutContext
  const { updateSet, currentWorkoutSession, addSet, endWorkout } = useWorkout();
  
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
        split_id: currentWorkoutSession.split_id,
        user_id: currentWorkoutSession.user_id,
        exercises_count: currentWorkoutSession.exercises.length,
        sets_status: currentWorkoutSession.sets.map((exerciseSets, i) => ({
          exercise: currentWorkoutSession.exercises[i]?.name,
          sets: exerciseSets.map(set => ({
            id: set.id,
            weight: set.weight,
            reps: set.reps,
            completed: set.completed
          }))
        }))
      });
    }
  }, [isVisible, exercises, currentWorkoutSession]);

  // Refs
  const bottomSheetRef = useRef<BottomSheet>(null);
  
  // State
  const [workoutTimer, setWorkoutTimer] = useState(0);
  const [currentExercises, setCurrentExercises] = useState<Exercise[]>([]);
  const [expandedExercises, setExpandedExercises] = useState<{[key: string]: boolean}>({});
  const [isEndingWorkout, setIsEndingWorkout] = useState(false);
  
  // Snap points for different states - must be a memoized array to prevent re-renders
  // const snapPoints = useMemo(() => ['12%', '100%'], []);
  const snapPoints = ['10%', '100%'];
  
  // Initialize with exercises
  useEffect(() => {
    // if (exercises.length > 0) {
    //   console.log('ActiveWorkoutModal - Setting current exercises:', JSON.stringify(exercises, null, 2));
    //   setCurrentExercises(exercises);
    // }

    console.log('ActiveWorkoutModal - Setting current exercises:', JSON.stringify(exercises, null, 2));
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
    }, 300);
    
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
      console.log('ActiveWorkoutModal - Sheet closed, calling onClose');
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
    } catch (error) {
      console.error('Error ending workout:', error);
      // Reset the flag if there was an error
      setIsEndingWorkout(false);
    }
  }, [endWorkout, onSave, isEndingWorkout]);
  
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
            const key = `${exerciseIndex}-${setIndex}`;
            newValues[key] = {
              weight: set.weight > 0 ? set.weight.toString() : '',
              reps: set.reps > 0 ? set.reps.toString() : ''
            };
          });
        }
      });
      
      setLocalInputValues(newValues);
    }
  }, [currentExercises]);

  // Handle weight input change locally (no update to context)
  const handleWeightInputChange = useCallback((exerciseIndex: number, setIndex: number, text: string) => {
    const key = `${exerciseIndex}-${setIndex}`;
    setLocalInputValues(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        weight: text
      }
    }));
  }, []);

  // Handle reps input change locally (no update to context)
  const handleRepsInputChange = useCallback((exerciseIndex: number, setIndex: number, text: string) => {
    const key = `${exerciseIndex}-${setIndex}`;
    setLocalInputValues(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        reps: text
      }
    }));
  }, []);

  // Handle weight change when editing is complete
  const handleWeightEditComplete = useCallback((exerciseIndex: number, setIndex: number) => {
    const key = `${exerciseIndex}-${setIndex}`;
    const value = localInputValues[key]?.weight || '';
    const weightValue = parseFloat(value) || 0;
    console.log(`ActiveWorkoutModal - Weight updated for exercise ${exerciseIndex}, set ${setIndex}: ${weightValue}`);
    updateSet(exerciseIndex, setIndex, { weight: weightValue });
  }, [localInputValues, updateSet]);

  // Handle reps change when editing is complete
  const handleRepsEditComplete = useCallback((exerciseIndex: number, setIndex: number) => {
    const key = `${exerciseIndex}-${setIndex}`;
    const value = localInputValues[key]?.reps || '';
    const repsValue = parseInt(value) || 0;
    console.log(`ActiveWorkoutModal - Reps updated for exercise ${exerciseIndex}, set ${setIndex}: ${repsValue}`);
    updateSet(exerciseIndex, setIndex, { reps: repsValue });
  }, [localInputValues, updateSet]);

  // Handle set completion toggle
  const handleSetCompletion = useCallback((exerciseIndex: number, setIndex: number, completed: boolean) => {
    const newCompletedStatus = !completed;
    console.log(`ActiveWorkoutModal - Set completion toggled for exercise ${exerciseIndex}, set ${setIndex}: ${newCompletedStatus}`);
    updateSet(exerciseIndex, setIndex, { completed: newCompletedStatus });
  }, [updateSet]);
  
  // Handle Add Set button click
  const handleAddSet = useCallback((exerciseIndex: number) => {
    console.log(`ActiveWorkoutModal - Adding set for exercise ${exerciseIndex}`);
    addSet(exerciseIndex);
  }, [addSet]);
  
  return (
    <GestureHandlerRootView style={styles.rootContainer}>
      <BottomSheet
        ref={bottomSheetRef}
        onChange={handleSheetChanges}
        enablePanDownToClose={false}
        index={isVisible ? 1 : -1}
        snapPoints={snapPoints}
        handleIndicatorStyle={{
          backgroundColor: 'white',
          width: 40,
          height: 4,
        }}
        backgroundStyle={{
          backgroundColor: '#2A2E38',
        }}
      >
        <BottomSheetView style={styles.contentContainer}>
          <HStack justifyContent="space-between" alignItems="center" px={4}>
                <Text color="white" fontSize="xl" fontWeight="bold">
                  Workout in Progress
                </Text>
                <Text color="white" fontSize="lg">
                  {formatTimer(workoutTimer)}
                </Text>
          </HStack>
          
          <Box flex={1} width="100%" display="flex">
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
              <Box width="100%" pb={30}> {/* Added padding to bottom for button area */}
                
                {/* Exercise list with sets */}
                <VStack space={1} width="100%">
                  {currentExercises.map((exercise, exerciseIndex) => (
                    <Box key={exercise.id}>
                      <Pressable 
                        onPress={() => toggleExerciseExpansion(exercise.id)}
                        // borderWidth={1}
                        // borderColor="red"
                      >
                        <Box 
                          bg={"transparent"} 
                          p={4} 
                          borderRadius="lg"
                          borderColor="#6B8EF2"
                        >
                          <HStack space={2} alignItems="flex-end">
                            <Text color="white" fontSize="md" fontWeight="bold">
                              {exercise.name}
                            </Text>
                            <Text color="gray.400" fontSize="md" opacity={0.7}>
                              {exercise.bodyPart}
                            </Text>
                          </HStack>
                          
                          {/* Sets for this exercise */}
                          {expandedExercises[exercise.id] && exercise.sets && (
                            <VStack px={0} pt={2} space={1}>
                              {/* Column headers */}
                              {/* <HStack justifyContent="space-between" alignItems="center" mb={1} p={1}>
                                <Text color="gray.400" width="60px" fontSize="xs">Set</Text>
                                <HStack space={2} flex={1} justifyContent="flex-end">
                                  <Text color="gray.400" width="70px" fontSize="xs" textAlign="center">Weight</Text>
                                  <Text color="gray.400" width="70px" fontSize="xs" textAlign="center">Reps</Text>

                                  <Box width="35px">
                                    <Text color="gray.400" fontSize="xs" textAlign="center">Done</Text>
                                  </Box>
                                </HStack>
                              </HStack> */}

                              <HStack justifyContent="space-between" alignItems="center" mb={1} p={1}>
                                <Text color="rgba(255, 255, 255, 0.8)" width="60px" fontSize="xs">Set</Text>
                                <HStack space={2} flex={1} justifyContent="flex-end">
                                  <Text color="rgba(255, 255, 255, 0.8)" width="70px" fontSize="xs" textAlign="center">Weight</Text>
                                  <Text color="rgba(255, 255, 255, 0.8)" width="70px" fontSize="xs" textAlign="center">Reps</Text>

                                  <Box width="35px">
                                    <Text color="rgba(255, 255, 255, 0.8)" fontSize="xs" textAlign="center">Done</Text>
                                  </Box>
                                </HStack>
                              </HStack>
                              
                              {exercise.sets.map((set, setIndex) => (
                                <Box 
                                  key={set.id}
                                  backgroundColor={set.completed ? "rgba(72, 170, 90, 0.35)" : "transparent"}
                                  borderRadius="lg"
                                  px={1}
                                  py={1}
                                >
          
                                  <HStack justifyContent="space-between" alignItems="center">
                                    <Text color="white" width="60px" pl={1.5}>{setIndex + 1}</Text>
                                    <HStack space={2} flex={1} justifyContent="flex-end">
                                      <View style={{
                                        width: 70,
                                        height: 35,
                                        // backgroundColor: '#3A3E48',
                                        backgroundColor: 'transparent',
                                        borderRadius: 4,
                                        // borderColor: set.completed ? "transparent" : "rgba(255, 255, 255, 0.25)",
                                        // borderWidth: 1,
                                        paddingHorizontal: 8,
                                        justifyContent: 'center'
                                      }}>
                                        <TextInput 
                                          placeholder="Weight" 
                                          placeholderTextColor="rgba(255, 255, 255, 0.25)"
                                          keyboardType="numeric"
                                          style={{
                                            color: 'white',
                                            height: 40,
                                            fontSize: 14,
                                            textAlign: 'center'
                                          }}
                                          value={localInputValues[`${exerciseIndex}-${setIndex}`]?.weight || ''}
                                          onChangeText={(text) => handleWeightInputChange(exerciseIndex, setIndex, text)}
                                          onEndEditing={() => handleWeightEditComplete(exerciseIndex, setIndex)}
                                          onBlur={() => handleWeightEditComplete(exerciseIndex, setIndex)}
                                        />
                                      </View>
                                      <View style={{
                                        width: 70,
                                        height: 35,
                                        // backgroundColor: '#3A3E48',
                                        // borderColor: set.completed ? "transparent" : "rgba(255, 255, 255, 0.25)",
                                        // borderWidth: 1,
                                        backgroundColor: 'transparent',
                                        borderRadius: 4,
                                        paddingHorizontal: 8,
                                        justifyContent: 'center'
                                      }}>
                                        <TextInput 
                                          placeholder="Reps" 
                                          placeholderTextColor="rgba(255, 255, 255, 0.25)"
                                          keyboardType="numeric"
                                          style={{
                                            color: 'white',
                                            height: 40,
                                            fontSize: 14,
                                            textAlign: 'center'
                                          }}
                                          value={localInputValues[`${exerciseIndex}-${setIndex}`]?.reps || ''}
                                          onChangeText={(text) => handleRepsInputChange(exerciseIndex, setIndex, text)}
                                          onEndEditing={() => handleRepsEditComplete(exerciseIndex, setIndex)}
                                          onBlur={() => handleRepsEditComplete(exerciseIndex, setIndex)}
                                        />
                                      </View>
                                      <Pressable
                                        width="35px"
                                        height="35px"
                                        borderRadius="lg"
                                        bg={set.completed ? "green.500" : "gray.700"}
                                        justifyContent="center"
                                        alignItems="center"
                                        onPress={() => handleSetCompletion(exerciseIndex, setIndex, set.completed)}
                                        _pressed={{ opacity: 0.7 }}
                                      >
                                        <Icon 
                                          as={Ionicons} 
                                          name="checkmark" 
                                          size="md" 
                                          color="white" 
                                        />
                                      </Pressable>
                                    </HStack>
                                  </HStack>
                                </Box>
                              ))}
                              
                              <Pressable
                                onPress={() => handleAddSet(exerciseIndex)}
                                mt={1.5}
                                py={2}
                                px={4}
                                borderRadius="md"
                                borderWidth={1}
                                borderColor="#6B8EF2"
                                alignItems="center"
                                justifyContent="center"
                                _pressed={{ opacity: 0.8 }}
                              >
                                <Text color="#6B8EF2" fontSize="sm" fontWeight="bold">
                                  Add Set
                                </Text>
                              </Pressable>
                            </VStack>
                          )}
                        </Box>
                      </Pressable>
                      
                      {/* Add divider after each exercise except the last one */}
                      {exerciseIndex < currentExercises.length - 1 && (
                        <Divider bg="gray.700" thickness="1" my={1} opacity={1} width="95%" alignSelf="center" />
                      )}
                    </Box>
                  ))}
                </VStack>
                
                <Box mt={2} mb={2} px={2}>
                  <Pressable
                    bg="transparent"
                    py={2}
                    px={4}
                    borderRadius="md"
                    borderWidth={1}
                    borderColor="gray.400"
                    alignItems="center"
                    justifyContent="center"
                    _pressed={{ opacity: 0.8 }}
                  >
                    <Text color="white" fontSize="md" fontWeight="bold">
                      Add Exercise
                    </Text>
                  </Pressable>
                </Box>

                <HStack space={2} mt={4} px={2}>
                  <Pressable
                    bg="transparent"
                    py={3}
                    px={6}
                    borderRadius="lg"
                    borderWidth={1.5}
                  borderColor="red.500"
                  flex={1}
                  alignItems="center"
                  justifyContent="center"
                  _pressed={{ opacity: 0.8 }}
                >
                  <Text color="red.500" fontSize="md" fontWeight="bold" textAlign="center">
                    Discard Workout
                  </Text>
                </Pressable>
              
                <Pressable
                  bg={isEndingWorkout ? "gray.500" : "red.500"}
                  py={3}
                  px={6}
                  borderRadius="lg"
                  onPress={handleEndWorkout}
                  _pressed={{ opacity: 0.8 }}
                  flex={1}
                  alignItems="center"
                  justifyContent="center"
                  opacity={isEndingWorkout ? 0.7 : 1}
                  disabled={isEndingWorkout}
                >
                  <Text color="white" fontSize="md" fontWeight="bold" textAlign="center">
                    {isEndingWorkout ? "Saving..." : "End Workout"}
                  </Text>
                </Pressable>
              </HStack>
              </Box>
            </ScrollView>
            
            {/* Fixed buttons at bottom
            <Box 
              position="absolute" 
              bottom={0} 
              left={0} 
              right={0} 
              bg="#2A2E38" 
              p={2} 
              pb={3}
              // mb={2}
              // borderWidth={1}
              // borderColor="red"
              // borderTopWidth={1}
              // borderTopColor="gray.700"
            >
              <HStack space={2}>
                <Pressable
                  bg="transparent"
                  py={3}
                  px={6}
                  borderRadius="lg"
                  borderWidth={1.5}
                  borderColor="red.500"
                  flex={1}
                  alignItems="center"
                  justifyContent="center"
                  _pressed={{ opacity: 0.8 }}
                >
                  <Text color="red.500" fontSize="md" fontWeight="bold" textAlign="center">
                    Cancel Workout
                  </Text>
                </Pressable>
              
                <Pressable
                  bg={isEndingWorkout ? "gray.500" : "red.500"}
                  py={3}
                  px={6}
                  borderRadius="lg"
                  onPress={handleEndWorkout}
                  _pressed={{ opacity: 0.8 }}
                  flex={1}
                  alignItems="center"
                  justifyContent="center"
                  opacity={isEndingWorkout ? 0.7 : 1}
                  disabled={isEndingWorkout}
                >
                  <Text color="white" fontSize="md" fontWeight="bold" textAlign="center">
                    {isEndingWorkout ? "Saving..." : "End Workout"}
                  </Text>
                </Pressable>
              </HStack>
            </Box> */}
          </Box>
        </BottomSheetView>
      </BottomSheet>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 60,
    top: 0,
    zIndex: 100,
    pointerEvents: 'box-none',
  },
  contentContainer: {
    flex: 1,
    width: '100%',
    paddingBottom: 0,
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    width: '100%',
  },
});

export default ActiveWorkoutModal; 