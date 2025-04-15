import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { Box, Text, Pressable, VStack, HStack } from 'native-base';
import { Split, Exercise } from '../types';

interface SessionSummaryModalProps {
  selectedDate: string | null;
  scheduledSplit: Split | null;
  onClose: () => void;
  onStartWorkout: () => void;
}

const SessionSummaryModal: React.FC<SessionSummaryModalProps> = ({
  selectedDate,
  scheduledSplit,
  onClose,
  onStartWorkout,
}) => {
  // Log props when component mounts or props change
  useEffect(() => {
    console.log('SessionSummaryModal - Activated with data:', {
      selectedDate,
      scheduledSplit: scheduledSplit ? {
        id: scheduledSplit.id,
        name: scheduledSplit.name,
        days: scheduledSplit.days,
        exercises: scheduledSplit.exercises.map(ex => ({
          id: ex.id,
          name: ex.name,
          bodyPart: ex.bodyPart
        }))
      } : null
    });
  }, [selectedDate, scheduledSplit]);

  // Refs
  const bottomSheetRef = useRef<BottomSheet>(null);
  
  // State for exercises
  const [currentExercises, setCurrentExercises] = React.useState<Exercise[]>([]);
  
  // Snap points for different states - must be a memoized array to prevent re-renders
  const snapPoints = useMemo(() => ['12%', '70%'], []);
  
  // Initialize component
  useEffect(() => {
    // Small delay to ensure the component is fully mounted
    const timer = setTimeout(() => {
      if (scheduledSplit && bottomSheetRef.current) {
        // Initialize with exercises from the scheduled split if available
        const exercisesWithSets = scheduledSplit.exercises.map(ex => ({
          ...ex,
          splitIds: [scheduledSplit.id],
          sets: [{ id: `set-${ex.id}-1`, weight: 0, reps: 0, completed: false }]
        }));
        
        console.log('SessionSummaryModal - Initializing exercises:', JSON.stringify(exercisesWithSets, null, 2));
        setCurrentExercises(exercisesWithSets);
      }
    }, 100);
    
    return () => clearTimeout(timer);
  }, [scheduledSplit]);
  
  // Handle opening bottom sheet separately to ensure it works properly
  useEffect(() => {
    const timer = setTimeout(() => {
      if (bottomSheetRef.current) {
        bottomSheetRef.current.snapToIndex(1);
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, []);
  
  // Handle bottom sheet changes
  const handleSheetChanges = useCallback((index: number) => {    
    // If sheet is closed, call onClose
    if (index === -1) {
      console.log('SessionSummaryModal - Workout cancelled');
      // set the visibility of the session summary modal to false in prgressScreen
      onClose();
    }
  }, [onClose]);
  
  // Cancel workout
  const handleCancelWorkout = useCallback(() => {
    bottomSheetRef.current?.close();
  }, []);
  
  // Helper function to get day of week
  const getDayOfWeek = (dateString: string | null) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[date.getDay()];
  };
  
  const handleStartWorkout = useCallback(() => {
    console.log('SessionSummaryModal - Starting workout');
    bottomSheetRef.current?.close();
    // Small delay to ensure the sheet is closed before starting workout
    setTimeout(() => {
      onStartWorkout();
    }, 300);
  }, [onStartWorkout]);
  
  return (
    <GestureHandlerRootView style={styles.rootContainer}>
      <BottomSheet
        ref={bottomSheetRef}
        onChange={handleSheetChanges}
        enablePanDownToClose={true}
        index={-1}
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
          <Box width="100%" px={3} pb={4}>
            <Text color="white" fontSize="xl" fontWeight="bold" textAlign="center">
              {scheduledSplit ? scheduledSplit.name : "No splits scheduled"}
            </Text>
         
            {scheduledSplit && (
              <Box bg="transparent" p={2} borderRadius="lg" alignSelf="center">
                <Text color="white" fontSize="lg" mb={2} >
                  {getDayOfWeek(selectedDate || new Date().toISOString().split('T')[0])}, {new Date(selectedDate || new Date().toISOString().split('T')[0]).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </Text>
              </Box>
            )}
            
            {/* Scheduled exercises preview */}
            {currentExercises.length > 0 && (
              <Box bg="transparent" p={4} borderRadius="lg" mb={4}>
                <VStack space={1}>
                  {currentExercises.map(exercise => (
                    <Text key={exercise.id} color="white" fontSize="sm">
                      • {exercise.name} ({exercise.bodyPart})
                    </Text>
                  ))}
                </VStack>
              </Box>
            )}
            <HStack space={2}>
              <Pressable
                mt={4}
                bg="#6B8EF2"
                py={3}
                flex={1}
                borderRadius="lg"
                onPress={handleStartWorkout}
                _pressed={{ opacity: 0.8 }}
              >
                <Text color="white" fontSize="md" fontWeight="bold" textAlign="center">
                  Start Workout
                </Text>
              </Pressable>
              
              <Pressable
                mt={4}
                bg="red.500"
                py={3}
                flex={1}
                borderRadius="lg"
                onPress={handleCancelWorkout}
                _pressed={{ opacity: 0.8 }}
              >
                <Text color="white" fontSize="md" fontWeight="bold" textAlign="center">
                  Cancel
                </Text>
              </Pressable>
            </HStack>
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
    bottom: 0,
    top: 0,
    zIndex: 100,
    pointerEvents: 'box-none',
  },
  contentContainer: {
    flex: 1,
    padding: 10,
    alignItems: 'center',
  },
});

export default SessionSummaryModal; 