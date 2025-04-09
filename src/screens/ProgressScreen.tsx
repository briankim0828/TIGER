import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { Box, Text, Pressable } from "native-base";
import WorkoutCalendar from "../components/WorkoutCalendar";
import { Split } from "../types";
import { useFocusEffect } from "@react-navigation/native";
import { storageService } from "../services/storage";
import RBSheet from 'react-native-raw-bottom-sheet';

import { GestureHandlerRootView } from 'react-native-gesture-handler';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { StyleSheet } from "react-native";


interface WorkoutSession {
  date: string;
  completed: boolean;
}

const ProgressScreen: React.FC = () => {

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();

  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [loading, setLoading] = useState(true);
  const [calendarKey, setCalendarKey] = useState(0);
  const [splits, setSplits] = useState<Split[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);

  // Add refs for caching
  const isInitialLoadRef = useRef(true);
  const processedDataRef = useRef<{
    splits: Split[];
    workouts: WorkoutSession[];
  }>({
    splits: [],
    workouts: [],
  });

  const bottomSheetRef = useRef<BottomSheet>(null);

  // callbacks
  const handleSheetChanges = useCallback((index: number) => {
    console.log('handleSheetChanges', index);
  }, []);

  // Get today's date string in the same format as the calendar
  const todayString = useMemo(() => {
    return `${currentYear}-${String(currentMonth + 1).padStart(
      2,
      "0"
    )}-${String(today.getDate()).padStart(2, "0")}`;
  }, [currentYear, currentMonth, today]);

  // Check if selected date is in the future
  const isFutureDate = useMemo(() => {
    if (!selectedDate) return false;
    return selectedDate > todayString;
  }, [selectedDate, todayString]);

  // Initial load - should only happen once when app starts
  useEffect(() => {
    const initialLoad = async () => {
      if (!isInitialLoadRef.current) return;

      setLoading(true);
      try {
        // Load splits data first
        const splitsData = await storageService.getSplits();
        const workoutsData = await storageService.getWorkoutSessions();

        if (splitsData) {
          setSplits(splitsData);
          processedDataRef.current.splits = splitsData;
        } else {
          setSplits([]);
          processedDataRef.current.splits = [];
        }

        if (workoutsData) {
          const formattedWorkouts = workoutsData.map((session) => ({
            date: session.date,
            completed: session.completed,
          }));
          setWorkouts(formattedWorkouts);
          processedDataRef.current.workouts = formattedWorkouts;
        } else {
          setWorkouts([]);
          processedDataRef.current.workouts = [];
        }

        // Increment the calendar key to force a complete re-render
        setCalendarKey((prev) => prev + 1);
      } catch (error) {
        console.error("Error on initial load:", error);
      } finally {
        setLoading(false);
        setIsInitialLoad(false);
        isInitialLoadRef.current = false;
      }
    };

    initialLoad();
  }, []);

  // When returning to this screen, only update with newest data, don't reset to defaults
  useFocusEffect(
    React.useCallback(() => {
      if (!isInitialLoadRef.current) {
        const refreshData = async () => {
          try {
            // Get latest splits data
            const splitsData = await storageService.getSplits();
            const workoutsData = await storageService.getWorkoutSessions();

            if (splitsData) {
              // Only update if data has changed
              if (
                JSON.stringify(splitsData) !==
                JSON.stringify(processedDataRef.current.splits)
              ) {
                setSplits(splitsData);
                processedDataRef.current.splits = splitsData;
              }
            }

            if (workoutsData) {
              const formattedWorkouts = workoutsData.map((session) => ({
                date: session.date,
                completed: session.completed,
              }));
              // Only update if data has changed
              if (
                JSON.stringify(formattedWorkouts) !==
                JSON.stringify(processedDataRef.current.workouts)
              ) {
                setWorkouts(formattedWorkouts);
                processedDataRef.current.workouts = formattedWorkouts;
              }
            }
          } catch (error) {
            console.error("Error refreshing data:", error);
          }
        };

        refreshData();
      }
    }, [isInitialLoadRef])
  );

  const handleDayPress = useCallback(
    (date: string) => {
      // If selecting today's date or pressing the same date again, clear the selection
      if (date === todayString || date === selectedDate) {
        setSelectedDate(null);
      } else {
        setSelectedDate(date);
      }
    },
    [todayString, selectedDate]
  );
  bottomSheetRef.current?.close();

  const handleWorkoutPress = useCallback(() => {
    bottomSheetRef.current?.expand();
    if (selectedDate) {
      console.log(`showing workout for ${selectedDate}`);
    } else {
      console.log("begin workout");
    }
  }, [selectedDate]);

  // Get the day of week from the selected date
  const getDayOfWeek = useCallback((dateString: string | null) => {
    if (!dateString) return null;
    
    const date = new Date(dateString);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[date.getDay()];
  }, []);

  // Find the split scheduled for the selected day
  const getScheduledSplit = useCallback((dayOfWeek: string | null) => {
    if (!dayOfWeek) return null;
    
    return splits.find(split => split.days.includes(dayOfWeek));
  }, [splits]);

  // Get the scheduled split for the selected date
  const scheduledSplit = useMemo(() => {
    const dayOfWeek = getDayOfWeek(selectedDate || todayString);
    return getScheduledSplit(dayOfWeek);
  }, [selectedDate, todayString, getDayOfWeek, getScheduledSplit]);

  if (loading) {
    return (
      <Box flex={1} justifyContent="center" alignItems="center" bg="#1E2028">
        <Text color="white" fontSize="md">
          Loading calendar...
        </Text>
      </Box>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <Box flex={1} bg="#1E2028">
        <Box flex={1}>
          <Text color="white" fontSize="2xl" fontWeight="bold" pl={4}>
            My Progress
          </Text>

          {/* calendar component */}
          <WorkoutCalendar
            key={`calendar-${calendarKey}`}
            month={currentMonth}
            year={currentYear}
            workouts={workouts}
            splits={splits}
            onDayPress={handleDayPress}
          />

          {/* button - now positioned below calendar */}
          <Box px={4} py={1} >
            <Pressable
              bg="#6B8EF2"
              py={4}
              px={6}
              borderRadius="xl"
              onPress={handleWorkoutPress}
              _pressed={{ opacity: 0.8 }}
              opacity={isFutureDate ? 0.65 : 1}
              disabled={isFutureDate}
            >
              <Text
                color="white"
                fontSize="lg"
                fontWeight="bold"
                textAlign="center"
                p={0.1}
              >
                {isFutureDate
                  ? "Not Yet..."
                  : selectedDate
                    ? `Session from ${selectedDate}`
                    : "Begin Workout"}
              </Text>
            </Pressable>
          </Box>
        </Box>
        <BottomSheet
          ref={bottomSheetRef}
          onChange={handleSheetChanges}
          enablePanDownToClose={true}
          index={-1}
        >
          <BottomSheetView style={styles.contentContainer}>
            <Text color="white" fontSize="xl" fontWeight="bold" mb={4}>
              {selectedDate ? `Session from ${selectedDate}` : "Begin Workout"}
            </Text>
            
            {scheduledSplit && (
              <Box bg="#2A2E38" p={4} borderRadius="lg" mb={4}>
                <Text color="white" fontSize="md">
                  Scheduled Split: <Text fontWeight="bold" color={scheduledSplit.color || "#6B8EF2"}>{scheduledSplit.name}</Text>
                </Text>
                <Text color="gray.400" fontSize="sm" mt={1}>
                  {getDayOfWeek(selectedDate || todayString)} Day
                </Text>
              </Box>
            )}
            
            <Pressable
              mt={4}
              bg="red.500"
              py={3}
              px={6}
              borderRadius="lg"
              onPress={() => bottomSheetRef.current?.close()}
              _pressed={{ opacity: 0.8 }}
            >
              <Text color="white" fontSize="md" fontWeight="bold">
                Finish
              </Text>
            </Pressable>
          </BottomSheetView>
        </BottomSheet>
      </Box>
    </GestureHandlerRootView>
  );
};

export default ProgressScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'grey',
  },
  contentContainer: {
    flex: 1,
    padding: 36,
    height: 300,
    alignItems: 'center',
  },
});