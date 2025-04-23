import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
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
        exercises: scheduledSplit.exercises.map(ex => ex.name).join(', ')
      } : null
    });
  }, [selectedDate, scheduledSplit]);

  // Refs
  const bottomSheetRef = useRef<BottomSheet>(null);
  
  // State for exercises
  const [currentExercises, setCurrentExercises] = React.useState<Exercise[]>([]);
  const [contentHeight, setContentHeight] = useState(0);
  
  // Calculate snap points based on content height
  const snapPoints = useMemo(() => {
    // Use minimum height + content height or percentage-based fallback
    const calculatedHeight = contentHeight > 0 ? contentHeight + 40 : '50%';
    return [calculatedHeight];
  }, [contentHeight]);
  
  // Handle the content layout to get its height
  const onContentLayout = useCallback((event: any) => {
    const { height } = event.nativeEvent.layout;
    setContentHeight(height);
  }, []);
  
  // Initialize component
  useEffect(() => {
    // Small delay to ensure the component is fully mounted
    const timer = setTimeout(() => {
      if (scheduledSplit && bottomSheetRef.current) {
        // Initialize with exercises from the scheduled split if available
        const exercisesWithSplitId = scheduledSplit.exercises.map(ex => ({
          ...ex,
          splitIds: [scheduledSplit.id]
        }));
        
        // console.log('SessionSummaryModal - Initializing exercises:', JSON.stringify(exercisesWithSets, null, 2));
        setCurrentExercises(exercisesWithSplitId);
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
      // set the visibility of the session summary modal to false in prgressScreen
      onClose();
    }
  }, [onClose]);
  
  // Cancel workout
  const handleCancelWorkout = useCallback(() => {
    console.log('SessionSummaryModal - Workout cancelled');
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
          <Box width="100%" px={3} pb={4} onLayout={onContentLayout}>
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
              <Box bg="transparent" p={2} borderRadius="lg" mb={2} width="100%">
                <Box flexDirection="row" flexWrap="wrap">
                  {currentExercises.map((exercise, index) => (
                    <Box key={exercise.id} width="50%" mb={2} pr={index % 2 === 0 ? 1 : 0} pl={index % 2 === 1 ? 1 : 0}>
                      <Text color="white" fontSize="sm">
                        {index + 1}. {exercise.name}
                      </Text>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}
            <HStack space={2}>
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
    zIndex: 999,
    pointerEvents: 'box-none',
  },
  contentContainer: {
    flex: 1,
    padding: 10,
    alignItems: 'center',
  },
});

export default SessionSummaryModal; 