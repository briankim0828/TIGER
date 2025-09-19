import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import BottomSheet, { BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Text, Pressable, VStack, HStack, Button, Icon, ScrollView } from '@gluestack-ui/themed';
import { AntDesign } from '@expo/vector-icons';
import type { ProgramSplit } from '../types/ui';
import { useDatabase } from '../db/queries';
import { navigate } from '../navigation/rootNavigation';
import { registerSelectionCallback, ExerciseLite } from '../navigation/selectionRegistry';
import { useWorkout } from '../contexts/WorkoutContext';
import { supabase } from '../utils/supabaseClient';

type ExerciseRow = { id: string; name: string };

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
  const { startWorkout } = useWorkout();
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
  
  // State for session exercise preview (modifiable before starting)
  const [currentExercises, setCurrentExercises] = useState<ExerciseRow[]>([]);
  const snapPoints = useMemo(() => ['100%'], []);
  
  // Initialize component
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!scheduledSplit) { setCurrentExercises([]); return; }
      try {
        const joins = await db.getSplitExercises(scheduledSplit.id);
        if (cancelled) return;
        const exs: ExerciseRow[] = joins.map(j => ({ id: j.exercise.id, name: j.exercise.name }));
        setCurrentExercises(exs);
      } catch (e) {
        console.warn('[SessionSummaryModal] failed to load split exercises', e);
        setCurrentExercises([]);
      }
    })();
    return () => { cancelled = true; };
  }, [scheduledSplit, db]);
  
  // Handle opening bottom sheet separately to ensure it works properly
  useEffect(() => {
    // Open immediately to full height like SplitDetailScreen
    const t = setTimeout(() => bottomSheetRef.current?.expand(), 50);
    return () => clearTimeout(t);
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
    bottomSheetRef.current?.close();
  }, []);
  
  // Helper function to get day of week and long weekday label
  const getDayOfWeek = (dateString: string | null) => {
    if (!dateString) return null;
    const [y, m, d] = dateString.split('-').map((s) => parseInt(s, 10));
    if (!y || !m || !d) return null;
    const date = new Date(y, m - 1, d); // local time to avoid TZ shifts
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[date.getDay()];
  };
  const getLongWeekday = (dateString: string | null) => {
    if (!dateString) return null;
    const [y, m, d] = dateString.split('-').map((s) => parseInt(s, 10));
    if (!y || !m || !d) return null;
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  };
  
  const handleStartWorkout = useCallback(async () => {
    // If there are no exercises, do not allow starting
    if (currentExercises.length === 0) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;
      if (!userId) return;
      const ids = currentExercises.map(e => e.id);
      // Allow starting without a split when none is scheduled by passing null
      const splitIdOrNull = scheduledSplit?.id ?? null;
      // If logging a workout for a past date, override startedAt to that local date at noon
      let startedAtOverride: string | undefined;
      if (selectedDate) {
        const [y, m, d] = selectedDate.split('-').map((s) => parseInt(s, 10));
        if (y && m && d) {
          const today = new Date();
          const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
          if (selectedDate < todayStr) {
            const localNoon = new Date(y, m - 1, d, 12, 0, 0);
            startedAtOverride = localNoon.toISOString();
          }
        }
      }
      const { sessionId } = await startWorkout(userId, splitIdOrNull, { fromSplitExerciseIds: ids, startedAtOverride });
      if (sessionId) bottomSheetRef.current?.close();
    } catch (e) {
      console.error('SessionSummaryModal - failed to start workout', e);
    }
  }, [scheduledSplit, currentExercises, startWorkout, selectedDate]);

  const handleAddExercise = useCallback(() => {
    // Use selection registry to add to current session preview
    const requestId = `session-summary-add-${Date.now()}`;
    registerSelectionCallback(requestId, async (selected: ExerciseLite[]) => {
      if (!selected || selected.length === 0) return;
      setCurrentExercises((prev) => {
        const map = new Map(prev.map(e => [e.id, e] as const));
        for (const s of selected) {
          if (!map.has(s.id)) map.set(s.id, { id: s.id, name: s.name });
        }
        // Keep insertion order: prev first, then new additions
        const nextIds = [...prev.map(e => e.id)];
        for (const s of selected) if (!nextIds.includes(s.id)) nextIds.push(s.id);
        const next: ExerciseRow[] = nextIds.map(id => map.get(id)!).filter(Boolean) as ExerciseRow[];
        return next;
      });
    });
    navigate('ExerciseSelectionModalScreen', { requestId, allowMultiple: true });
  }, []);

  const handleRemoveExercise = useCallback((index: number) => {
    setCurrentExercises((prev) => prev.filter((_, i) => i !== index));
  }, []);
  
  // Local pressed-state tracking for reliable opacity feedback
  const [isCancelPressed, setIsCancelPressed] = useState(false);
  const [isStartPressed, setIsStartPressed] = useState(false);
  const [isAddPressed, setIsAddPressed] = useState(false);
  const startDisabled = currentExercises.length === 0;
  
  return (
    <GestureHandlerRootView style={styles.rootContainer}>
      <BottomSheet
        ref={bottomSheetRef}
        onChange={handleSheetChanges}
        enablePanDownToClose
        index={0}
        snapPoints={snapPoints}
        topInset={insets.top}
        backdropComponent={(props) => (
          <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.5} pressBehavior="close" />
        )}
        handleIndicatorStyle={{ backgroundColor: '#666' }}
        backgroundStyle={{ backgroundColor: '#1E2028' }}
      >
        <Box flex={1}>
          {/* Header with today's date centered, back button on left */}
          <Box p="$5" position="relative" alignItems="center" justifyContent="center" pt="$2">
            {/* <Button
              variant="link"
              onPress={() => bottomSheetRef.current?.close()}
              position="absolute"
              left="$2"
            >
              
              <Icon as={AntDesign as any} name="left" color="$white" />
            </Button> */}
            <Text color="$white" fontSize="$lg" fontWeight="$bold" numberOfLines={1}>
              {new Date(selectedDate || new Date().toISOString().split('T')[0]).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
            </Text>
          </Box>

          {/* Split name row with menu icon */}
          <HStack alignItems="center" justifyContent="space-between" px="$4" pb="$2">
            <Text color="$white" fontSize="$2xl" fontWeight="$bold" numberOfLines={1}>
              {scheduledSplit ? scheduledSplit.name : `${getLongWeekday(selectedDate) || 'Today'} workout`}
            </Text>
            {/* @ts-ignore */}
            <Icon as={AntDesign as any} name="ellipsis1" color="$white" />
          </HStack>

          {/* Summary row and (optional) Reorder button, mimicking SplitDetailScreen */}
          <HStack alignItems="center" justifyContent="space-between" px="$4" pb="$2">
            <Text color="$gray400" fontSize="$sm">Total of {currentExercises.length}</Text>
            <Button variant="outline" size="xs" borderColor="#6B8EF2" onPress={() => { /* no-op */ }} px="$2">
              <HStack alignItems="center" space="xs">
                {/* @ts-ignore */}
                <Icon as={AntDesign as any} name="swap" color="#6B8EF2" size="xs" />
                <Text color="#6B8EF2" fontSize="$xs">Reorder</Text>
              </HStack>
            </Button>
          </HStack>

          {/* Exercises list */}
          <ScrollView flex={1} showsVerticalScrollIndicator={false}>
          <VStack space="md" p="$3">
            {currentExercises.length > 0 ? (
              <VStack space="md">
                {currentExercises.map((exercise, index) => (
                  <Box key={exercise.id} backgroundColor="transparent" p="$2">
                    <HStack alignItems="center" justifyContent="space-between">
                      <HStack space="md" alignItems="center" flex={1}>
                        {/* Avatar with first letter */}
                        <Box width={48} height={48} backgroundColor="#2A2E38" borderRadius="$md" alignItems="center" justifyContent="center">
                          <Text color="$white" fontWeight="$bold" fontSize="$lg">
                            {exercise.name.charAt(0).toUpperCase()}
                          </Text>
                        </Box>
                        <VStack flex={1}>
                          <Text color="$white" fontSize="$md" numberOfLines={1}>{exercise.name}</Text>
                          <Text color="$gray400" fontSize="$xs">{/* Placeholder for sets/rep summary */}</Text>
                        </VStack>
                      </HStack>
                      <Button variant="link" onPress={() => handleRemoveExercise(index)}>
                        {/* @ts-ignore */}
                        <Icon as={AntDesign as any} name="close" color="$red500" />
                      </Button>
                    </HStack>
                  </Box>
                ))}

                {/* Add Exercise button */}
                <Pressable
                  width="$full"
                  borderStyle="dashed"
                  borderWidth="$1"
                  borderColor="#6B8EF2"
                  backgroundColor="transparent"
                  borderRadius="$lg"
                  py="$2"
                  onPressIn={() => setIsAddPressed(true)}
                  onPressOut={() => setIsAddPressed(false)}
                  style={{ opacity: isAddPressed ? 0.7 : 1 }}
                  onPress={handleAddExercise}
                >
                  <HStack space="sm" justifyContent="center" alignItems="center">
                    {/* @ts-ignore */}
                    <Icon as={AntDesign as any} name="plus" color="#6B8EF2" size="sm" />
                    <Text color="#6B8EF2" fontSize="$md">Add Exercise</Text>
                  </HStack>
                </Pressable>
              </VStack>
            ) : (
              <Box backgroundColor="transparent" borderRadius="$lg" p="$3" >
                <VStack space="xl" alignItems="center">
                  <Text color="$gray400" fontSize="$lg">Add exercises to this session</Text>
                  <Box width="$full">
                    <Pressable
                      width="$full"
                      borderStyle="dashed"
                      borderWidth="$1"
                      borderColor="#6B8EF2"
                      backgroundColor="transparent"
                      borderRadius="$lg"
                      py="$2"
                      onPressIn={() => setIsAddPressed(true)}
                      onPressOut={() => setIsAddPressed(false)}
                      style={{ opacity: isAddPressed ? 0.7 : 1 }}
                      onPress={handleAddExercise}
                    >
                      <HStack space="sm" justifyContent="center" alignItems="center">
                        {/* @ts-ignore */}
                        <Icon as={AntDesign as any} name="plus" color="#6B8EF2" size="sm" />
                        <Text color="#6B8EF2" fontSize="$md">Add Exercise</Text>
                      </HStack>
                    </Pressable>
                  </Box>
                </VStack>
              </Box>
            )}
          </VStack>
          </ScrollView>

          {/* Bottom action buttons */}
          <Box p="$4" pb="$12">
            <HStack space="sm">
              <Pressable
                backgroundColor="$red500"
                paddingVertical="$3"
                flex={1}
                borderRadius="$lg"
                onPressIn={() => setIsCancelPressed(true)}
                onPressOut={() => setIsCancelPressed(false)}
                onPress={handleCancelWorkout}
                style={{ opacity: isCancelPressed ? 0.8 : 1 }}
              >
                <Text color="$white" size="md" fontWeight="$bold" textAlign="center">Cancel</Text>
              </Pressable>
              <Pressable
                backgroundColor="#6B8EF2"
                paddingVertical="$3"
                flex={1}
                borderRadius="$lg"
                onPressIn={() => { if (!startDisabled) setIsStartPressed(true); }}
                onPressOut={() => setIsStartPressed(false)}
                onPress={startDisabled ? undefined : handleStartWorkout}
                isDisabled={startDisabled}
                pointerEvents={startDisabled ? 'none' : 'auto'}
                style={{ opacity: startDisabled ? 0.6 : (isStartPressed ? 0.8 : 1) }}
              >
                <Text color="$white" size="md" fontWeight="$bold" textAlign="center">Start Workout</Text>
              </Pressable>
            </HStack>
          </Box>
        </Box>
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