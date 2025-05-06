import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { Box, Text, Pressable } from "@gluestack-ui/themed";
import WorkoutCalendar from "../components/WorkoutCalendar";
import { useFocusEffect } from "@react-navigation/native";
import { useData } from "../contexts/DataContext";
import { useWorkout } from "../contexts/WorkoutContext";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ScrollView, StyleSheet } from "react-native";
import SessionSummaryModal from "../components/SessionSummaryModal";
import { Split, Exercise, WorkoutDay } from '../types';

interface WorkoutSession {
  date: string;
  completed: boolean;
}

const ProgressScreen: React.FC = () => {
  const { splits, workoutSessions, loading: dataLoading } = useData();
  const { startWorkout } = useWorkout();

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();

  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [loading, setLoading] = useState(true);
  const [calendarKey, setCalendarKey] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string>(useMemo(() => {
    return `${currentYear}-${String(currentMonth + 1).padStart(
      2,
      "0"
    )}-${String(today.getDate()).padStart(2, "0")}`;
  }, [currentYear, currentMonth, today]));
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [showSessionSummary, setShowSessionSummary] = useState(false);

  const isInitialLoadRef = useRef(true);
  const processedDataRef = useRef<{
    workouts: WorkoutSession[];
    workoutDays: WorkoutDay[];
  }>({
    workouts: [],
    workoutDays: [],
  });

  const todayString = useMemo(() => {
    return `${currentYear}-${String(currentMonth + 1).padStart(
      2,
      "0"
    )}-${String(today.getDate()).padStart(2, "0")}`;
  }, [currentYear, currentMonth, today]);

  const isFutureDate = useMemo(() => {
    if (!selectedDate) return false;
    return selectedDate > todayString;
  }, [selectedDate, todayString]);

  const isToday = useMemo(() => {
    return selectedDate === todayString;
  }, [selectedDate, todayString]);

  const getDayOfWeek = useCallback((dateString: string | null) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[date.getDay()];
  }, []);

  const scheduledSplit = useMemo(() => {
    const dayOfWeek = getDayOfWeek(selectedDate);
    if (!dayOfWeek) return null;
    return splits.find(split => split.days.includes(dayOfWeek)) || null;
  }, [selectedDate, splits, getDayOfWeek]);

  useFocusEffect(
    useCallback(() => {
      const processData = async () => {
        const formattedWorkouts = workoutSessions.map((session) => ({
          date: session.date,
          completed: session.completed,
        }));
        processedDataRef.current.workouts = formattedWorkouts;
        processedDataRef.current.workoutDays = workoutSessions.map(session => ({
          date: session.date,
          completed: session.completed,
          splitId: session.splitName || undefined
        }));

        setWorkouts(formattedWorkouts);

        if (isInitialLoadRef.current) {
          setIsInitialLoad(false);
          isInitialLoadRef.current = false;
        }
        setLoading(false);
        setCalendarKey((prev) => prev + 1);
      };

      if (!dataLoading) {
        processData();
      }
    }, [dataLoading, workoutSessions])
  );

  const handleDayPress = useCallback(
    (date: string) => {
      if (date === selectedDate) {
        return;
      }
      
      const workoutSession = workoutSessions.find(session => session.date === date);
      const dayOfWeek = getDayOfWeek(date);
      const currentSplit = dayOfWeek ? splits.find(split => split.days.includes(dayOfWeek)) : null;
      
      console.log('[DEBUG] Selected Date Info:', {
        date,
        split: currentSplit?.name,
        workoutSession: workoutSession 
          ? {
              date: workoutSession.date,
              startTime: workoutSession.startTime,
              durationSec: workoutSession.durationSec,
              exercisesCount: workoutSession.exercises.length,
              totalSets: workoutSession.sets.flat().length,
              completed: workoutSession.completed
            } 
          : 'No session found'
      });
      
      setSelectedDate(date);
    },
    [selectedDate, workoutSessions, getDayOfWeek, splits]
  );

  const handleWorkoutPress = useCallback(() => {
    if (scheduledSplit) {
      setShowSessionSummary(true);
    } else {
      console.log('No split scheduled for this day');
    }
  }, [scheduledSplit]);

  const handleCloseSummary = useCallback(() => {
    setShowSessionSummary(false);
  }, []);

  const handleStartWorkout = useCallback(async () => {
    if (!scheduledSplit || !selectedDate) {
      console.error("Cannot start workout: Missing split or selected date.");
      return;
    }
    
    const exercisesForWorkout: Exercise[] = scheduledSplit.exercises.map(ex => ({
      id: ex.id,
      name: ex.name,
      bodyPart: ex.bodyPart,
      splitIds: [scheduledSplit.id],
      sets: [],
    }));

    await startWorkout(exercisesForWorkout, selectedDate, scheduledSplit.name);
    setShowSessionSummary(false);
  }, [scheduledSplit, selectedDate, startWorkout]);

  if (loading || dataLoading) {
    return (
      <Box flex={1} justifyContent="center" alignItems="center" bg="$backgroundDark900">
        <Text color="$textLight50">Loading Progress...</Text>
      </Box>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <ScrollView style={{ flex: 1, backgroundColor: "#1E2028" }}>
        <Box flex={1} py="$4">
          <Text color="$textLight50" fontSize="$2xl" fontWeight="$bold" pl="$4" mb="$4">
            My Progress
          </Text>

          <WorkoutCalendar
            key={`calendar-${calendarKey}`}
            month={currentMonth}
            year={currentYear}
            workouts={workouts}
            splits={splits}
            onDayPress={handleDayPress}
          />

          <Box px="$4" py="$1" pt="$5">
            <Pressable
              bg="$primary500"
              py="$4"
              px="$6"
              borderRadius="$xl"
              onPress={handleWorkoutPress}
              $pressed={{ opacity: 0.8 }}
              opacity={isFutureDate ? 0.65 : 1}
              disabled={isFutureDate}
              accessibilityRole="button"
            >
              <Text
                color="$textLight50"
                fontSize="$lg"
                fontWeight="$bold"
                textAlign="center"
              >
                {isFutureDate
                  ? "Not Yet..."
                  : isToday
                    ? "Begin Today's Workout"
                    : `Session from ${new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
              </Text>
            </Pressable>
          </Box>
        </Box>
      </ScrollView>
      
      {showSessionSummary && (
        <SessionSummaryModal
          selectedDate={selectedDate}
          scheduledSplit={scheduledSplit}
          onClose={handleCloseSummary}
          onStartWorkout={handleStartWorkout}
        />
      )}
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1E2028",
  },
});

export default ProgressScreen;

