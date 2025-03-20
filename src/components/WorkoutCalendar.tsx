import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Box, VStack, HStack, Text, Pressable, Center } from 'native-base';
import { FlatList, NativeScrollEvent, NativeSyntheticEvent, ViewToken } from 'react-native';
import { MonthData, WorkoutDay } from '../types';
import { Split } from '../screens/WorkoutScreen';

interface WorkoutCalendarProps {
  data: MonthData;
  onDayPress?: (date: string) => void;
  splits: Split[];
}

interface MonthSection {
  month: number;
  year: number;
  days: number[];
}

interface ScrollMetrics {
  y: number;
  height: number;
  headerHeight: number;
}

const MONTH_HEIGHT = 250; // Approximate height of a month section

const WorkoutCalendar: React.FC<WorkoutCalendarProps> = ({ data, onDayPress, splits }) => {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [visibleMonth, setVisibleMonth] = useState({ month: data.month, year: data.year });
  const flatListRef = useRef<FlatList>(null);
  
  // Log when splits data is received
  useEffect(() => {
    console.log('Calendar received splits:', splits?.length || 0);
  }, [splits]);

  // Update visible month when data changes
  useEffect(() => {
    setVisibleMonth({ month: data.month, year: data.year });
  }, [data.month, data.year]);

  // Memoize the getDaysInMonth function
  const getDaysInMonth = useCallback((month: number, year: number): number => {
    const daysPerMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (month === 1 && ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0)) {
      return 29;
    }
    return daysPerMonth[month];
  }, []);

  // Memoize the formatDate function
  const formatDate = useCallback((day: number, month: number, year: number): string => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }, []);

  // Memoize the getWorkoutForDate function
  const getWorkoutForDate = useCallback((day: number, month: number, year: number): WorkoutDay | undefined => {
    const dateStr = formatDate(day, month, year);
    return data.workouts.find(w => w.date === dateStr);
  }, [data.workouts, formatDate]);

  // Memoize the getSplitForDate function
  const getSplitForDate = useCallback((day: number, month: number, year: number): Split | undefined => {
    if (!splits || splits.length === 0) {
      return undefined;
    }

    const date = new Date(year, month, day);
    const dayIndex = date.getDay();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayOfWeek = dayNames[dayIndex];
    
    return splits.find(split => split.days.includes(dayOfWeek));
  }, [splits]);

  // Memoize the isToday function
  const isToday = useCallback((day: number, month: number, year: number): boolean => {
    const today = new Date();
    return (
      today.getDate() === day &&
      today.getMonth() === month &&
      today.getFullYear() === year
    );
  }, []);

  // Memoize the handleDayPress function
  const handleDayPress = useCallback((day: number, month: number, year: number) => {
    const dateStr = formatDate(day, month, year);
    const split = getSplitForDate(day, month, year);
    
    console.log('Selected day:', {
      date: dateStr,
      split: split ? `${split.name} day, ${split.exercises.length} exercises` : 'No split assigned',
      dayOfWeek: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(year, month, day).getDay()]
    });

    setSelectedDate(dateStr);
    if (onDayPress) {
      onDayPress(dateStr);
    }
  }, [formatDate, getSplitForDate, onDayPress]);

  // Generate months data (current month and 5 future months)
  const monthSections = useMemo(() => {
    const sections: MonthSection[] = [];
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    // Generate 6 months starting from current month
    for (let i = 0; i < 6; i++) {
      let year = currentYear;
      let month = currentMonth + i;
      
      // Adjust year if month goes beyond 11
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
  }, [getDaysInMonth]);

  // Memoize the CalendarCell component
  const CalendarCell = useMemo(() => React.memo(({ 
    day, 
    month, 
    year, 
    section, 
    isFutureMonth, 
    isFutureDay, 
    isSelected, 
    todayHighlight, 
    workout, 
    split, 
    onPress 
  }: {
    day: number;
    month: number;
    year: number;
    section: MonthSection;
    isFutureMonth: boolean;
    isFutureDay: boolean;
    isSelected: boolean;
    todayHighlight: boolean;
    workout?: WorkoutDay;
    split?: Split;
    onPress: () => void;
  }) => {
    if (day === 0) {
      return <Box key={`empty-${year}-${month}-${day}`} flex={1} h={10} />;
    }

    const colorStrip = split?.color || "#3A3E48";
    // console.log(`Rendering cell for ${day}/${month+1}/${year} with color: ${colorStrip}`);

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
          borderWidth={isSelected ? 2 : 0}
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
          {workout && (
            <Box
              w={1.5}
              h={1.5}
              borderRadius="full"
              bg={workout.completed ? "#60C1EF" : "#6B8EF2"}
              position="absolute"
              bottom={1}
              opacity={isFutureDay ? 0.5 : 1}
            />
          )}
        </Box>
      </Pressable>
    );
  }), []);

  // Memoize the month section component
  const MonthSection = useMemo(() => React.memo(({ section }: { section: MonthSection }) => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const currentDay = today.getDate();

    // Check if this section is a future month
    const isFutureMonth = 
      (section.year > currentYear) || 
      (section.year === currentYear && section.month > currentMonth);

    // Calculate first day of month
    const firstDayOfMonth = new Date(section.year, section.month, 1).getDay();
    console.log(`First day of ${section.month + 1}/${section.year} is ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][firstDayOfMonth]}`);

    // Generate weeks
    const weeks: Array<number[]> = [];
    let currentWeek: number[] = Array(firstDayOfMonth).fill(0);

    section.days.forEach(day => {
      currentWeek.push(day);
      if (currentWeek.length === 7) {
        weeks.push([...currentWeek]);
        currentWeek = [];
      }
    });

    if (currentWeek.length > 0) {
      weeks.push([...currentWeek, ...Array(7 - currentWeek.length).fill(0)]);
    }

    return (
      <VStack 
        space={1} 
        mb={2} 
        bg="transparent"
        p={2}
        borderRadius="lg"
      >
        <Text 
          fontSize="lg" 
          fontWeight="bold" 
          mb={1}
          color={isFutureMonth ? "gray.500" : "white"}
        >
          {new Date(section.year, section.month).toLocaleString('default', { month: 'long' })} {section.year}
        </Text>
        
        <HStack space={2} justifyContent="space-between" mb={1}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <Box key={day} flex={1} alignItems="center">
              <Text fontSize="2xs" color="gray.400">{day}</Text>
            </Box>
          ))}
        </HStack>

        {weeks.map((week, weekIndex) => (
          <HStack key={`week-${section.year}-${section.month}-${weekIndex}`} space={2}>
            {week.map((day, dayIndex) => {
              const workout = getWorkoutForDate(day, section.month, section.year);
              const split = getSplitForDate(day, section.month, section.year);
              const dateStr = formatDate(day, section.month, section.year);
              const isSelected = dateStr === selectedDate;
              const todayHighlight = isToday(day, section.month, section.year);
              const isFutureDay = 
                isFutureMonth || 
                (section.year === currentYear && 
                 section.month === currentMonth && 
                 day > currentDay);

              // Only log for debugging purposes
              // if (day > 0) {
              //   console.log(`Week ${weekIndex}, Day ${dayIndex}: ${day}/${section.month+1}/${section.year}, split:`, split?.name || 'none');
              // }

              return (
                <CalendarCell
                  key={`cell-${section.year}-${section.month}-${day}-${dayIndex}`}
                  day={day}
                  month={section.month}
                  year={section.year}
                  section={section}
                  isFutureMonth={isFutureMonth}
                  isFutureDay={isFutureDay}
                  isSelected={isSelected}
                  todayHighlight={todayHighlight}
                  workout={workout}
                  split={split}
                  onPress={() => handleDayPress(day, section.month, section.year)}
                />
              );
            })}
          </HStack>
        ))}
      </VStack>
    );
  }), [selectedDate, getWorkoutForDate, getSplitForDate, formatDate, isToday, handleDayPress]);

  // Memoize the renderItem function
  const renderItem = useCallback(({ item }: { item: MonthSection }) => (
    <MonthSection section={item} />
  ), []);

  // Memoize the keyExtractor function
  const keyExtractor = useCallback((item: MonthSection) => `${item.year}-${item.month}`, []);

  // Memoize the getItemLayout function
  const getItemLayout = useCallback((data: any, index: number) => ({
    length: MONTH_HEIGHT,
    offset: MONTH_HEIGHT * index,
    index,
  }), []);

  // Handle viewable items change
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0) {
      const firstVisibleItem = viewableItems[0].item as MonthSection;
      setVisibleMonth({ month: firstVisibleItem.month, year: firstVisibleItem.year });
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
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          initialScrollIndex={0}
          getItemLayout={getItemLayout}
          maxToRenderPerBatch={1}
          windowSize={2}
          removeClippedSubviews={true}
          initialNumToRender={2}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{
            itemVisiblePercentThreshold: 50,
            minimumViewTime: 100,
          }}
          style={{ backgroundColor: '#1E2028' }}
        />
      </Box>
    </Box>
  );
};

export default WorkoutCalendar; 