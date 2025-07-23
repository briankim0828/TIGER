import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { Box, VStack, HStack, Text, Pressable } from "@gluestack-ui/themed";
import {
  Platform,
  UIManager,
} from "react-native";
import { Split, WeekDay, WEEKDAYS } from "../types";

interface WorkoutCalendarProps {
  month: number;
  year: number;
  workouts: { date: string; completed: boolean }[];
  onDayPress?: (date: string) => void;
  splits: Split[];
}

interface MonthSection {
  month: number;
  year: number;
  days: number[];
}

// Enable LayoutAnimation for Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Cache system for date strings to avoid repeated string operations
const dateStringCache = new Map<string, string>();
const getDateString = (day: number, month: number, year: number): string => {
  const key = `${year}-${month}-${day}`;
  if (!dateStringCache.has(key)) {
    dateStringCache.set(
      key,
      `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(
        2,
        "0"
      )}`
    );
  }
  return dateStringCache.get(key)!;
};

// Day of week calculations are expensive - cache them
const dayOfWeekCache = new Map<string, number>();
const getDayOfWeek = (year: number, month: number, day: number): number => {
  const key = `${year}-${month}-${day}`;
  if (!dayOfWeekCache.has(key)) {
    dayOfWeekCache.set(key, new Date(year, month, day).getDay());
  }
  return dayOfWeekCache.get(key)!;
};

// Pre-calculated constants
const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_PER_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// Get days in month with caching
const daysInMonthCache = new Map<string, number>();
const getDaysInMonth = (month: number, year: number): number => {
  const key = `${year}-${month}`;
  if (!daysInMonthCache.has(key)) {
    let days = DAYS_PER_MONTH[month];
    if (
      month === 1 &&
      ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0)
    ) {
      days = 29;
    }
    daysInMonthCache.set(key, days);
  }
  return daysInMonthCache.get(key)!;
};

// SuperOptimized DayCell using React.memo with custom comparison
const DayCell = React.memo(
  ({
    day,
    isSelected,
    todayHighlight,
    colorStrip,
    isFutureDay,
    hasWorkout,
    workoutCompleted,
    onPress,
  }: {
    day: number;
    isSelected: boolean;
    todayHighlight: boolean;
    colorStrip: string;
    isFutureDay: boolean;
    hasWorkout: boolean;
    workoutCompleted?: boolean;
    onPress: () => void;
  }) => {
    // Empty cell render is very cheap
    if (day === 0) {
      return <Box flex={1} h={40} />;
    }

    const borderWidth = isSelected ? 1.5 : 0;

    return (
      <Pressable flex={1} onPress={onPress} opacity={isFutureDay ? 0.5 : 1} accessibilityRole="button">
        <Box
          h={40}
          alignItems="center"
          justifyContent="center"
          bg={hasWorkout ? "$green500" : todayHighlight ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.2)"}
          borderRadius="$md"
          borderWidth={borderWidth}
          borderColor={isSelected ? "$borderLight300" : "transparent"}
          position="relative"
          $pressed={{ bg: "$coolGray700" }}
        >
          {!hasWorkout && (
            <Box
              position="absolute"
              top={0}
              left={0}
              right={0}
              h={4}
              bg={colorStrip}
              borderTopLeftRadius="$lg"
              borderTopRightRadius="$lg"
            />
          )}
          <Text
            fontSize="$sm"
            color={
              isFutureDay ? "$textLight500" : todayHighlight ? "$textLight50" : "$textLight100"
            }
            fontWeight={todayHighlight ? "$bold" : "$normal"}
          >
            {day}
          </Text>
        </Box>
      </Pressable>
    );
  },
  (prev, next) => {
    // Custom equality check - only update when these specific props change
    return (
      prev.day === next.day &&
      prev.isSelected === next.isSelected &&
      prev.todayHighlight === next.todayHighlight &&
      prev.colorStrip === next.colorStrip &&
      prev.isFutureDay === next.isFutureDay &&
      prev.hasWorkout === next.hasWorkout &&
      prev.workoutCompleted === next.workoutCompleted
    );
  }
);

// Memoized day of week header - never changes
const DaysHeader = React.memo(
  () => (
    <HStack space="sm" justifyContent="space-between" mb="$1">
      {DAYS_OF_WEEK.map((day) => (
        <Box key={day} flex={1} alignItems="center">
          <Text fontSize="$2xs" color="$textLight400">
            {day}
          </Text>
        </Box>
      ))}
    </HStack>
  ),
  () => true
); // Always return true since this component never changes

const WorkoutCalendar: React.FC<WorkoutCalendarProps> = ({
  month,
  year,
  workouts,
  onDayPress,
  splits,
}) => {
  // Cache today's date info
  const todayInfo = useMemo(() => {
    const today = new Date();
    return {
      day: today.getDate(),
      month: today.getMonth(),
      year: today.getFullYear(),
      dateString: getDateString(
        today.getDate(),
        today.getMonth(),
        today.getFullYear()
      ),
    };
  }, []);

  // Initialize selectedDate to today's date
  const [selectedDate, setSelectedDate] = useState<string>(todayInfo.dateString);

  // Create an ultra-fast O(1) lookup for workouts
  const workoutsMap = useMemo(() => {
    const map = new Map<string, boolean>();
    workouts.forEach((workout) => {
      map.set(workout.date, workout.completed);
    });
    return map;
  }, [workouts]);

  // Create an ultra-fast lookup for splits by day
  const splitsByDay = useMemo(() => {
    const map = new Map<WeekDay, Split>();
    splits.forEach((split) => {
      split.days.forEach((day) => {
        if (day) map.set(day as WeekDay, split);
      });
    });
    return map;
  }, [splits]);

  // Fast workout lookup
  const getWorkoutForDate = useCallback(
    (dateStr: string): boolean | undefined => {
      return workoutsMap.get(dateStr);
    },
    [workoutsMap]
  );

  // Fast split lookup
  const getSplitForDate = useCallback(
    (dayOfWeek: WeekDay): Split | undefined => {
      return splitsByDay.get(dayOfWeek);
    },
    [splitsByDay]
  );

  // Ultra-fast day selection handler
  const handleDayPress = useCallback(
    (day: number, month: number, year: number) => {
      const dateStr = getDateString(day, month, year);

      // Always set selectedDate to the clicked date
      setSelectedDate(dateStr);

      // Find and log the cell info for the selected date
      const dayOfWeek = DAYS_OF_WEEK[getDayOfWeek(year, month, day)];
      const workout = getWorkoutForDate(dateStr);
      const split = getSplitForDate(dayOfWeek as WeekDay);
      
      // console.log('[DEBUG] Selected Cell Info:', {
      //   date: dateStr,
      //   dayOfWeek,
      // });

      // Call the onDayPress callback if provided
      if (onDayPress) {
        onDayPress(dateStr);
      }
    },
    [onDayPress, getWorkoutForDate, getSplitForDate]
  );

  // Generate current month data
  const monthData = useMemo(() => {
    const days = Array.from(
      { length: getDaysInMonth(month, year) },
      (_, index) => index + 1
    );
    
    // Calculate first day of month
    const firstDayOfMonth = getDayOfWeek(year, month, 1);
    
    // Pre-generate all required date strings for this month
    const dateStrings = new Map<number, string>();
    days.forEach((day) => {
      dateStrings.set(day, getDateString(day, month, year));
    });
    
    // Determine if month is in the future
    const isFutureMonth =
      year > todayInfo.year ||
      (year === todayInfo.year && month > todayInfo.month);
    
    // Pre-generate cell rendering data
    const cellData = days.map((day) => {
      const dateStr = dateStrings.get(day)!;
      
      // Calculate day of week for split lookup
      const dayOfWeek = DAYS_OF_WEEK[getDayOfWeek(year, month, day)];
      
      // Fast lookups
      const workout = getWorkoutForDate(dateStr);
      const split = getSplitForDate(dayOfWeek as WeekDay);
      
      const todayHighlight =
        day === todayInfo.day &&
        month === todayInfo.month &&
        year === todayInfo.year;
        
      const isFutureDay =
        isFutureMonth ||
        (year === todayInfo.year &&
          month === todayInfo.month &&
          day > todayInfo.day);
      
      return {
        day,
        dateStr,
        isSelected: dateStr === selectedDate,
        todayHighlight,
        colorStrip: split?.color || "#3A3E48",
        isFutureDay,
        hasWorkout: !!workout,
        workoutCompleted: workout,
        onPress: () => handleDayPress(day, month, year),
      };
    });
    
    // Generate weeks layout
    const weeks: Array<Array<number | null>> = [];
    let currentWeek: Array<number | null> = Array(firstDayOfMonth).fill(null);
    
    days.forEach((day) => {
      currentWeek.push(day);
      if (currentWeek.length === 7) {
        weeks.push([...currentWeek]);
        currentWeek = [];
      }
    });
    
    if (currentWeek.length > 0) {
      weeks.push([
        ...currentWeek,
        ...Array(7 - currentWeek.length).fill(null),
      ]);
    }
    
    return {
      days,
      firstDayOfMonth,
      dateStrings,
      cellData,
      weeks,
      isFutureMonth,
    };
  }, [month, year, selectedDate, todayInfo, getWorkoutForDate, getSplitForDate, handleDayPress]);

  return (
    <Box bg="$1E2028" px="$1" pt="$4">
      <VStack space="xs" p="$2" borderRadius="$lg">
        <Text
          fontSize="$lg"
          fontWeight="$bold"
          mb="$1"
          color={monthData.isFutureMonth ? "$textLight500" : "$textLight50"}
          pl="$3"
        >
          {new Date(year, month).toLocaleString("default", {
            month: "long",
          })}{" "}
          {year}
        </Text>

        <DaysHeader />

        {monthData.weeks.map((week, weekIndex) => (
          <HStack
            key={`week-${year}-${month}-${weekIndex}`}
            space="sm"
          >
            {week.map((dayValue, dayIndex) => {
              if (dayValue === null) {
                return (
                  <Box
                    key={`empty-${weekIndex}-${dayIndex}`}
                    flex={1}
                    h={40}
                  />
                );
              }

              const cellInfo = monthData.cellData.find((cell) => cell.day === dayValue);
              if (!cellInfo) return null;

              return (
                <DayCell
                  key={`day-${year}-${month}-${dayValue}`}
                  day={cellInfo.day}
                  isSelected={cellInfo.isSelected}
                  todayHighlight={cellInfo.todayHighlight}
                  colorStrip={cellInfo.colorStrip}
                  isFutureDay={cellInfo.isFutureDay}
                  hasWorkout={cellInfo.hasWorkout}
                  workoutCompleted={cellInfo.workoutCompleted}
                  onPress={cellInfo.onPress}
                />
              );
            })}
          </HStack>
        ))}
      </VStack>
    </Box>
  );
};

export default WorkoutCalendar;
