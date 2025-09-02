import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Text, Pressable, VStack, HStack } from '@gluestack-ui/themed';
import { Exercise } from '../types';
import type { ProgramSplit } from '../types/ui';
import { useDatabase } from '../db/queries';

interface SessionSummaryModalProps {
  selectedDate: string | null;
  scheduledSplit: ProgramSplit | null;
  onClose: () => void;
  onStartWorkout: () => void;
}

const SessionSummaryModal: React.FC<SessionSummaryModalProps> = ({
  selectedDate,
  scheduledSplit,
  onClose,
  onStartWorkout,
}) => {
  const insets = useSafeAreaInsets();
  const db = useDatabase();
  // Log props when component mounts or props change
  useEffect(() => {
    console.log('SessionSummaryModal - Activated with data:', {
      selectedDate,
      scheduledSplit: scheduledSplit ? {
        name: scheduledSplit.name,
        exerciseCount: scheduledSplit.exerciseCount
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
        // Fetch exercises from DB for preview
        (async () => {
          try {
            const joins = await db.getSplitExercises(scheduledSplit.id);
            const exs = joins.map(j => ({ id: j.exercise.id, name: j.exercise.name, bodyPart: j.exercise.bodyPart || 'Uncategorized', splitIds: [scheduledSplit.id] } as Exercise));
            setCurrentExercises(exs);
          } catch (e) {
            console.warn('[SessionSummaryModal] failed to load split exercises', e);
            setCurrentExercises([]);
          }
        })();
      }
    }, 100);
    
    return () => clearTimeout(timer);
  }, [scheduledSplit, db]);
  
  // Handle opening bottom sheet separately to ensure it works properly
  useEffect(() => {
    const timer = setTimeout(() => {
      if (bottomSheetRef.current) {
        // bottomSheetRef.current.snapToIndex(1);
        bottomSheetRef.current.expand();
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
  topInset={insets.top}
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
          <Box width="100%" paddingHorizontal="$3" paddingBottom="$4" onLayout={onContentLayout}>
            <Text color="$white" size="xl" fontWeight="$bold" textAlign="center">
              {scheduledSplit ? scheduledSplit.name : "No splits scheduled"}
            </Text>
         
            {scheduledSplit && (
              <Box backgroundColor="transparent" padding="$2" borderRadius="$lg" alignSelf="center">
                <Text color="$white" size="lg" marginBottom="$2">
                  {getDayOfWeek(selectedDate || new Date().toISOString().split('T')[0])}, {new Date(selectedDate || new Date().toISOString().split('T')[0]).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </Text>
              </Box>
            )}
            
            {/* Scheduled exercises preview */}
            {currentExercises.length > 0 && (
              <Box backgroundColor="transparent" padding="$2" borderRadius="$lg" marginBottom="$2" width="100%">
                <Box flexDirection="row" flexWrap="wrap">
                  {currentExercises.map((exercise, index) => (
                    <Box key={exercise.id} width="50%" marginBottom="$2" paddingRight={index % 2 === 0 ? '$1' : '$0'} paddingLeft={index % 2 === 1 ? '$1' : '$0'}>
                      <Text color="$white" size="sm">
                        {index + 1}. {exercise.name}
                      </Text>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}
            <HStack space="sm">
              <Pressable
                marginTop="$4"
                backgroundColor="$red500"
                paddingVertical="$3"
                flex={1}
                borderRadius="$lg"
                onPress={handleCancelWorkout}
                style={({pressed}) => pressed ? {opacity: 0.8} : {}}
              >
                <Text color="$white" size="md" fontWeight="$bold" textAlign="center">
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                marginTop="$4"
                backgroundColor="#6B8EF2"
                paddingVertical="$3"
                flex={1}
                borderRadius="$lg"
                onPress={handleStartWorkout}
                style={({pressed}) => pressed ? {opacity: 0.8} : {}}
              >
                <Text color="$white" size="md" fontWeight="$bold" textAlign="center">
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