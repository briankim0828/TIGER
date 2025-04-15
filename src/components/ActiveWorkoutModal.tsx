import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { StyleSheet, ScrollView } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { Box, Text, Pressable, HStack, VStack, Input, Button } from 'native-base';
import { Exercise } from '../types';

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
  // Log props when component mounts or props change
  useEffect(() => {
    console.log('ActiveWorkoutModal - Activated with data:', {
      isVisible,
      exercises: exercises.map(ex => ({
        id: ex.id,
        name: ex.name,
        bodyPart: ex.bodyPart,
        sets: ex.sets
      }))
    });
  }, [isVisible, exercises]);

  // Refs
  const bottomSheetRef = useRef<BottomSheet>(null);
  
  // State
  const [workoutTimer, setWorkoutTimer] = useState(0);
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);
  const [currentExercises, setCurrentExercises] = useState<Exercise[]>([]);
  
  // Snap points for different states - must be a memoized array to prevent re-renders
  const snapPoints = useMemo(() => ['12%', '100%'], []);
  
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
        bottomSheetRef.current.snapToIndex(2); // Open to full height
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
  useEffect(() => {
    if (currentExercises.length > 0 && activeExerciseIndex >= 0) {
      const activeExercise = currentExercises[activeExerciseIndex];
      console.log('ActiveWorkoutModal - Active exercise changed:', {
        index: activeExerciseIndex,
        exercise: {
          id: activeExercise.id,
          name: activeExercise.name,
          bodyPart: activeExercise.bodyPart,
          sets: activeExercise.sets
        }
      });
    }
  }, [activeExerciseIndex, currentExercises]);
  
  return (
    <GestureHandlerRootView style={styles.rootContainer}>
      <BottomSheet
        ref={bottomSheetRef}
        onChange={handleSheetChanges}
        enablePanDownToClose={false}
        index={isVisible ? 2 : -1}
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
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            <Box width="100%" px={4}>
              <HStack justifyContent="space-between" alignItems="center" mb={6}>
                <Text color="white" fontSize="xl" fontWeight="bold">
                  Workout in Progress
                </Text>
                <Text color="white" fontSize="lg">
                  {formatTimer(workoutTimer)}
                </Text>
              </HStack>
              
              {/* Exercise list with sets */}
              <VStack space={4} mb={4} width="100%">
                {currentExercises.map((exercise, index) => (
                  <Pressable 
                    key={exercise.id}
                    onPress={() => setActiveExerciseIndex(index)}
                  >
                    <Box 
                      bg={index === activeExerciseIndex ? "#3A3E48" : "#1E2028"} 
                      p={4} 
                      borderRadius="lg"
                      borderWidth={index === activeExerciseIndex ? 1 : 0}
                      borderColor="#6B8EF2"
                    >
                      <Text color="white" fontSize="md" fontWeight="bold">
                        {exercise.name}
                      </Text>
                      <Text color="gray.400" fontSize="xs">
                        {exercise.bodyPart}
                      </Text>
                      
                      {/* Sets for this exercise */}
                      {index === activeExerciseIndex && exercise.sets && (
                        <VStack space={2} mt={2}>
                          {exercise.sets.map((set, setIndex) => (
                            <HStack key={set.id} justifyContent="space-between" alignItems="center" mt={2}>
                              <Text color="gray.400" width="60px">Set {setIndex + 1}</Text>
                              <HStack space={2} flex={1} justifyContent="flex-end">
                                <Input 
                                  placeholder="Weight" 
                                  keyboardType="numeric"
                                  width="80px"
                                  color="white"
                                  value={set.weight > 0 ? set.weight.toString() : ''}
                                />
                                <Input 
                                  placeholder="Reps" 
                                  keyboardType="numeric"
                                  width="80px"
                                  color="white"
                                  value={set.reps > 0 ? set.reps.toString() : ''}
                                />
                                <Button 
                                  size="sm" 
                                  colorScheme={set.completed ? "green" : "gray"}
                                >
                                  {set.completed ? "Done" : "Do"}
                                </Button>
                              </HStack>
                            </HStack>
                          ))}
                          
                          <Button 
                            size="sm" 
                            variant="outline"
                            colorScheme="blue"
                            mt={2}
                          >
                            Add Set
                          </Button>
                        </VStack>
                      )}
                    </Box>
                  </Pressable>
                ))}
              </VStack>
              
              <HStack space={2} justifyContent="space-between" mt={4}>
                <Button 
                  colorScheme="blue" 
                  size="sm"
                  flex={1}
                >
                  Add Exercise
                </Button>
                
                <Button 
                  colorScheme="gray" 
                  size="sm"
                  flex={1}
                >
                  Replace Exercise
                </Button>
              </HStack>
              
              <Pressable
                mt={6}
                bg="red.500"
                py={3}
                px={6}
                borderRadius="lg"
                onPress={handleEndWorkout}
                _pressed={{ opacity: 0.8 }}
                mb={4}
              >
                <Text color="white" fontSize="md" fontWeight="bold" textAlign="center">
                  End Workout
                </Text>
              </Pressable>
            </Box>
          </ScrollView>
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
    paddingBottom: 0, // Added prop to get rid of the bottom padding
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