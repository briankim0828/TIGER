import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Box, VStack, HStack, Text, Pressable } from 'native-base';
import { FlatList, ViewToken, Platform, UIManager, findNodeHandle } from 'react-native';
import { Split, WeekDay, WEEKDAYS } from '../types';

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

const MONTH_HEIGHT = 250;

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Cache system for date strings to avoid repeated string operations
const dateStringCache = new Map<string, string>();
const getDateString = (day: number, month: number, year: number): string => {
  const key = `${year}-${month}-${day}`;
  if (!dateStringCache.has(key)) {
    dateStringCache.set(key, `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
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
const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_PER_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// Get days in month with caching
const daysInMonthCache = new Map<string, number>();
const getDaysInMonth = (month: number, year: number): number => {
  const key = `${year}-${month}`;
  if (!daysInMonthCache.has(key)) {
    let days = DAYS_PER_MONTH[month];
    if (month === 1 && ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0)) {
      days = 29;
    }
    daysInMonthCache.set(key, days);
  }
  return daysInMonthCache.get(key)!;
};

// SuperOptimized DayCell using React.memo with custom comparison
const DayCell = React.memo(({ 
  day, 
  isSelected,
  todayHighlight,
  colorStrip,
  isFutureDay,
  hasWorkout,
  workoutCompleted,
  onPress 
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
    return <Box flex={1} h={10} />;
  }

  const borderWidth = isSelected ? 3 : 0;

  return (
    <Pressable
      flex={1}
      onPress={onPress}
      opacity={isFutureDay ? 0.5 : 1}
    >
      <Box
        h={10}
        alignItems="center"
        justifyContent="center"
        bg={todayHighlight ? "#6B8EF2" : "#2A2E38"}
        borderRadius="lg"
        borderWidth={borderWidth}
        borderColor="#4169E1"
        position="relative"
      >
        <Box
          position="absolute"
          top={0}
          left={0}
          right={0}
          h="1"
          bg={colorStrip}
          borderTopRadius="lg"
        />
        <Text
          fontSize="sm"
          color={isFutureDay ? "gray.500" : (todayHighlight ? "white" : "gray.100")}
          fontWeight={todayHighlight ? "bold" : "normal"}
        >
          {day}
        </Text>
        {hasWorkout && (
          <Box
            w={1.5}
            h={1.5}
            borderRadius="full"
            bg={workoutCompleted ? "#60C1EF" : "#6B8EF2"}
            position="absolute"
            bottom={1}
            opacity={isFutureDay ? 0.5 : 1}
          />
        )}
      </Box>
    </Pressable>
  );
}, (prev, next) => {
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
});

// Memoized day of week header - never changes
const DaysHeader = React.memo(() => (
  <HStack space={2} justifyContent="space-between" mb={1}>
    {DAYS_OF_WEEK.map(day => (
      <Box key={day} flex={1} alignItems="center">
        <Text fontSize="2xs" color="gray.400">{day}</Text>
      </Box>
    ))}
  </HStack>
), () => true); // Always return true since this component never changes

const WorkoutCalendar: React.FC<WorkoutCalendarProps> = ({ month, year, workouts, onDayPress, splits }) => {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [visibleMonth, setVisibleMonth] = useState({ month, year });
  const flatListRef = useRef<FlatList>(null);
  const prevSelectedCellRef = useRef<string | null>(null);
  
  // Create an ultra-fast O(1) lookup for workouts
  const workoutsMap = useMemo(() => {
    const map = new Map<string, boolean>();
    workouts.forEach(workout => {
      map.set(workout.date, workout.completed);
    });
    return map;
  }, [workouts]);

  // Create an ultra-fast lookup for splits by day
  const splitsByDay = useMemo(() => {
    const map = new Map<WeekDay, Split>();
    splits.forEach(split => {
      split.days.forEach(day => {
        if (day in WEEKDAYS) {
          map.set(day as WeekDay, split);
        }
      });
    });
    return map;
  }, [splits]);

  // Fast workout lookup
  const getWorkoutForDate = useCallback((dateStr: string): boolean | undefined => {
    return workoutsMap.get(dateStr);
  }, [workoutsMap]);

  // Fast split lookup
  const getSplitForDate = useCallback((dayOfWeek: WeekDay): Split | undefined => {
    return splitsByDay.get(dayOfWeek);
  }, [splitsByDay]);

  // Cache today's date info
  const todayInfo = useMemo(() => {
    const today = new Date();
    return {
      day: today.getDate(),
      month: today.getMonth(),
      year: today.getFullYear(),
      dateString: getDateString(today.getDate(), today.getMonth(), today.getFullYear())
    };
  }, []);

  // Ultra-fast day selection handler
  const handleDayPress = useCallback((day: number, month: number, year: number) => {
    const dateStr = getDateString(day, month, year);
    
    // If pressing the same date again, clear the selection
    if (dateStr === selectedDate) {
      setSelectedDate(null);
    } else {
      // Update selection state
      setSelectedDate(dateStr);
    }
    
    // Call the onDayPress callback if provided
    if (onDayPress) {
      onDayPress(dateStr);
    }
  }, [onDayPress, selectedDate]);

  // Reduced to only 2 months for even better performance
  const monthSections = useMemo(() => {
    const sections: MonthSection[] = [];
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    // Generate only 2 months for better performance
    for (let i = 0; i < 2; i++) {
      let year = currentYear;
      let month = currentMonth + i;
      
      while (month > 11) {
        month -= 12;
        year += 1;
      }

      sections.push({
        month: month,
        year: year,
        days: Array.from({ length: getDaysInMonth(month, year) }, (_, index) => index + 1)
      });
    }
    return sections;
  }, []);

  // Super-optimized month section
  const MonthSection = React.memo(({ section, selectedDate }: { 
    section: MonthSection;
    selectedDate: string | null;
  }) => {
    const { day: currentDay, month: currentMonth, year: currentYear } = todayInfo;

    // Determine if month is in the future
    const isFutureMonth = 
      (section.year > currentYear) || 
      (section.year === currentYear && section.month > currentMonth);

    // Calculate first day of month - once per month render
    const firstDayOfMonth = getDayOfWeek(section.year, section.month, 1);
    
    // Pre-generate all required date strings for this month
    const dateStrings = useMemo(() => {
      const result = new Map<number, string>();
      section.days.forEach(day => {
        result.set(day, getDateString(day, section.month, section.year));
      });
      return result;
    }, [section.month, section.year]);

    // Pre-generate cell rendering data
    const cellData = useMemo(() => {
      return section.days.map(day => {
        const dateStr = dateStrings.get(day)!;
        
        // Calculate day of week for split lookup
        const dayOfWeek = DAYS_OF_WEEK[getDayOfWeek(section.year, section.month, day)];
        
        // Fast lookups
        const workout = getWorkoutForDate(dateStr);
        const split = getSplitForDate(dayOfWeek as WeekDay);
        
        const todayHighlight = day === currentDay && section.month === currentMonth && section.year === currentYear;
        const isFutureDay = isFutureMonth || (section.year === currentYear && section.month === currentMonth && day > currentDay);

        return {
          day,
          dateStr,
          isSelected: dateStr === selectedDate,
          todayHighlight,
          colorStrip: split?.color || "#3A3E48",
          isFutureDay,
          hasWorkout: !!workout,
          workoutCompleted: workout,
          onPress: () => handleDayPress(day, section.month, section.year)
        };
      });
    }, [section.days, section.month, section.year, selectedDate, currentDay, currentMonth, currentYear, isFutureMonth, getWorkoutForDate, getSplitForDate, handleDayPress]);

    // Generate weeks layout - memoized and stable
    const weeks = useMemo(() => {
      const generatedWeeks: Array<Array<number | null>> = [];
      let currentWeek: Array<number | null> = Array(firstDayOfMonth).fill(null);

    section.days.forEach(day => {
      currentWeek.push(day);
      if (currentWeek.length === 7) {
          generatedWeeks.push([...currentWeek]);
        currentWeek = [];
      }
    });

    if (currentWeek.length > 0) {
        generatedWeeks.push([...currentWeek, ...Array(7 - currentWeek.length).fill(null)]);
      }
      
      return generatedWeeks;
    }, [section.days, firstDayOfMonth]);

    return (
      <VStack space={1} mb={2} p={2} borderRadius="lg">
        <Text 
          fontSize="lg" 
          fontWeight="bold" 
          mb={1}
          color={isFutureMonth ? "gray.500" : "white"}
        >
          {new Date(section.year, section.month).toLocaleString('default', { month: 'long' })} {section.year}
        </Text>
        
        <DaysHeader />

        {weeks.map((week, weekIndex) => (
          <HStack key={`week-${section.year}-${section.month}-${weekIndex}`} space={2}>
            {week.map((dayValue, dayIndex) => {
              if (dayValue === null) {
                return <Box key={`empty-${weekIndex}-${dayIndex}`} flex={1} h={10} />;
              }
              
              const cellInfo = cellData.find(cell => cell.day === dayValue);
              if (!cellInfo) return null;

              return (
                <DayCell
                  key={`day-${section.year}-${section.month}-${dayValue}`}
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
    );
  }, (prev, next) => {
    // Only re-render when these specific props change
    return (
      prev.section.month === next.section.month &&
      prev.section.year === next.section.year &&
      prev.selectedDate === next.selectedDate
    );
  });

  // Ultra-optimized renderItem
  const renderItem = useCallback(({ item }: { item: MonthSection }) => (
    <MonthSection 
      section={item} 
      selectedDate={selectedDate} 
    />
  ), [selectedDate]);

  // Maximize FlatList performance
  const keyExtractor = useCallback((item: MonthSection) => `${item.year}-${item.month}`, []);
  
  const getItemLayout = useCallback((data: any, index: number) => ({
    length: MONTH_HEIGHT,
    offset: MONTH_HEIGHT * index,
    index,
  }), []);

  const viewabilityConfig = useMemo(() => ({
    itemVisiblePercentThreshold: 50,
    minimumViewTime: 0, // Set to 0 to respond immediately
  }), []);

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0) {
      const firstVisibleItem = viewableItems[0].item as MonthSection;
      // Use functional update to avoid depending on previous state
      setVisibleMonth(prev => {
        if (prev.month === firstVisibleItem.month && prev.year === firstVisibleItem.year) {
          return prev; // Return same reference if no change
        }
        return { month: firstVisibleItem.month, year: firstVisibleItem.year };
      });
    }
  }, []);

  return (
    <Box flex={1} bg="#1E2028">
      <Box flex={1} bg="#1E2028" px={2} pt={4}>
        <FlatList
          ref={flatListRef}
          data={monthSections}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          extraData={selectedDate}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={32}
          initialScrollIndex={0}
          getItemLayout={getItemLayout}
          windowSize={3}
          removeClippedSubviews={false}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          updateCellsBatchingPeriod={10}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          style={{ backgroundColor: '#1E2028' }}
          maintainVisibleContentPosition={{
            minIndexForVisible: 0
          }}
        />
      </Box>
    </Box>
  );
};

export default WorkoutCalendar; 