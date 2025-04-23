import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { StyleSheet, ScrollView, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { Box, Text, Pressable, HStack, VStack, Input, Button, Divider } from 'native-base';
import { Exercise } from '../types';
import { useWorkout } from '../contexts/WorkoutContext';

interface ActiveWorkoutModalProps {
  isVisible: boolean;
  exercises: Exercise[];
  onClose: () => void;
}

const ActiveWorkoutModal: React.FC<ActiveWorkoutModalProps> = ({
  isVisible,
  exercises,
  onClose,
}) => {
  // Access the updateSet function from WorkoutContext
  const { updateSet, currentWorkoutSession } = useWorkout();
  
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
      onClose();
    }
  }, [onClose]);
  
  // End workout
  const handleEndWorkout = useCallback(() => {
    console.log('ActiveWorkoutModal - Ending workout');
    // Save workout data logic would go here
    bottomSheetRef.current?.close();
  }, []);
  
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

  // Handle weight change
  const handleWeightChange = useCallback((exerciseIndex: number, setIndex: number, weight: string) => {
    const weightValue = parseFloat(weight) || 0;
    console.log(`ActiveWorkoutModal - Weight changed for exercise ${exerciseIndex}, set ${setIndex}: ${weightValue}`);
    updateSet(exerciseIndex, setIndex, { weight: weightValue });
  }, [updateSet]);

  // Handle reps change
  const handleRepsChange = useCallback((exerciseIndex: number, setIndex: number, reps: string) => {
    const repsValue = parseInt(reps) || 0;
    console.log(`ActiveWorkoutModal - Reps changed for exercise ${exerciseIndex}, set ${setIndex}: ${repsValue}`);
    updateSet(exerciseIndex, setIndex, { reps: repsValue });
  }, [updateSet]);

  // Handle set completion toggle
  const handleSetCompletion = useCallback((exerciseIndex: number, setIndex: number, completed: boolean) => {
    const newCompletedStatus = !completed;
    console.log(`ActiveWorkoutModal - Set completion toggled for exercise ${exerciseIndex}, set ${setIndex}: ${newCompletedStatus}`);
    updateSet(exerciseIndex, setIndex, { completed: newCompletedStatus });
  }, [updateSet]);
  
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
              <Box width="100%" pb={80}> {/* Added padding to bottom for button area */}
                
                {/* Exercise list with sets */}
                <VStack space={2} width="100%">
                  {currentExercises.map((exercise, exerciseIndex) => (
                    <Box key={exercise.id}>
                      <Pressable 
                        onPress={() => toggleExerciseExpansion(exercise.id)}
                      >
                        <Box 
                          bg={"transparent"} 
                          p={4} 
                          borderRadius="lg"
                          borderColor="#6B8EF2"
                        >
                          <Text color="white" fontSize="md" fontWeight="bold">
                            {exercise.name}
                          </Text>
                          <Text color="gray.400" fontSize="xs">
                            {exercise.bodyPart}
                          </Text>
                          
                          {/* Sets for this exercise */}
                          {expandedExercises[exercise.id] && exercise.sets && (
                            <VStack space={2} mt={2} px={2}>
                              {exercise.sets.map((set, setIndex) => (
                                <HStack key={set.id} justifyContent="space-between" alignItems="center" mt={2}>
                                  <Text color="white" width="60px">Set {setIndex + 1}</Text>
                                  <HStack space={2} flex={1} justifyContent="flex-end">
                                    <Input 
                                      placeholder="Weight" 
                                      keyboardType="numeric"
                                      width="80px"
                                      color="white"
                                      value={set.weight > 0 ? set.weight.toString() : ''}
                                      onChangeText={(text) => handleWeightChange(exerciseIndex, setIndex, text)}
                                    />
                                    <Input 
                                      placeholder="Reps" 
                                      keyboardType="numeric"
                                      width="80px"
                                      color="white"
                                      value={set.reps > 0 ? set.reps.toString() : ''}
                                      onChangeText={(text) => handleRepsChange(exerciseIndex, setIndex, text)}
                                    />
                                    <Button 
                                      size="sm" 
                                      colorScheme={set.completed ? "green" : "gray"}
                                      onPress={() => handleSetCompletion(exerciseIndex, setIndex, set.completed)}
                                    >
                                      {set.completed ? "Done" : "Do"}
                                    </Button>
                                  </HStack>
                                </HStack>
                              ))}
                              
                              <Pressable
                                onPress={() => {/* Add your onPress logic here */}}
                                mt={2}
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
                
                <Box mt={6} mb={2} px={2}>
                  <Pressable
                    bg="transparent"
                    py={2}
                    px={4}
                    borderRadius="md"
                    borderWidth={1}
                    borderColor="#6B8EF2"
                    alignItems="center"
                    justifyContent="center"
                    _pressed={{ opacity: 0.8 }}
                  >
                    <Text color="#6B8EF2" fontSize="md" fontWeight="bold">
                      Add Exercise
                    </Text>
                  </Pressable>
                </Box>
              </Box>
            </ScrollView>
            
            {/* Fixed buttons at bottom */}
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
                  bg="red.500"
                  py={3}
                  px={6}
                  borderRadius="lg"
                  onPress={handleEndWorkout}
                  _pressed={{ opacity: 0.8 }}
                  flex={1}
                  alignItems="center"
                  justifyContent="center"
                >
                  <Text color="white" fontSize="md" fontWeight="bold" textAlign="center">
                    End Workout
                  </Text>
                </Pressable>
              </HStack>
            </Box>
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