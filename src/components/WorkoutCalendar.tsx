import React, { useState, useEffect, useMemo } from 'react';
import { Box, VStack, HStack, Text, Pressable, Center } from 'native-base';
import { FlatList, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { MonthData, WorkoutDay } from '../types';

interface WorkoutCalendarProps {
  data: MonthData;
  onDayPress: (date: string) => void;
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

const WorkoutCalendar: React.FC<WorkoutCalendarProps> = ({ data, onDayPress }) => {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [visibleMonth, setVisibleMonth] = useState({ month: data.month, year: data.year });
  
  const getDaysInMonth = (month: number, year: number): number => {
    const daysPerMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    // Check for leap year
    if (month === 1 && ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0)) {
      return 29;
    }
    return daysPerMonth[month];
  };

  // Generate months data (current month and future months)
  const monthSections = useMemo(() => {
    const sections: MonthSection[] = [];
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const currentDay = today.getDate();

    // Generate 6 months starting from current month
    for (let i = 0; i <= 6; i++) {
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
  }, []);

  const formatDate = (day: number, month: number, year: number): string => {
    // Use UTC to avoid timezone issues
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };
  
  const getWorkoutForDate = (day: number, month: number, year: number): WorkoutDay | undefined => {
    const dateStr = formatDate(day, month, year);
    return data.workouts.find(w => w.date === dateStr);
  };

  const isToday = (day: number, month: number, year: number): boolean => {
    const today = new Date();
    return (
      today.getDate() === day &&
      today.getMonth() === month &&
      today.getFullYear() === year
    );
  };

  const handleDayPress = (day: number, month: number, year: number) => {
    const dateStr = formatDate(day, month, year);
    console.log('Handle day press selected');
    setSelectedDate(dateStr);
    onDayPress(dateStr);
  };

  // const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
  //   const scrollY = event.nativeEvent.contentOffset.y;
  //   const monthHeight = 250;
    
  //   // Calculate which month is at the top of the viewport
  //   const topVisibleMonthIndex = Math.floor(scrollY / monthHeight);
    
  //   if (topVisibleMonthIndex >= 0 && topVisibleMonthIndex < monthSections.length) {
  //     const topMonth = monthSections[topVisibleMonthIndex];
  //     // console.log(
  //     //   `Topmost visible month: ${new Date(topMonth.year, topMonth.month).toLocaleString('default', { month: 'long' })} ${topMonth.year}`
  //     // );
  //   }
  // };

  // Memoize the render function to improve performance
  const renderMonthMemo = useMemo(() => ({ item: section }: { item: MonthSection }) => {
    // For January 2025, we want Wednesday (3) as the first day
    let firstDayOfMonth;
    if (section.year === 2025 && section.month === 0) {
      firstDayOfMonth = 3; // Wednesday
    } else {
      // Calculate other months based on January 2025
      const baseDate = new Date(2025, 0, 1); // January 1st, 2025 (Wednesday)
      const targetDate = new Date(section.year, section.month, 1);
      const daysDiff = Math.floor((targetDate.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24));
      firstDayOfMonth = (3 + daysDiff) % 7; // (Wednesday + days difference) % 7
      if (firstDayOfMonth < 0) firstDayOfMonth += 7;
    }

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

    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const currentDay = today.getDate();

    // Check if this section is a future month
    const isFutureMonth = 
      (section.year > currentYear) || 
      (section.year === currentYear && section.month > currentMonth);

    // Check if this section is the current visible month
    const isVisibleMonth = section.month === visibleMonth.month && section.year === visibleMonth.year;

    return (
      <VStack 
        space={1} 
        mb={2} 
        bg="transparent"
        p={2}
        borderRadius="lg"
      >
        {/* Month header */}
        <Text 
          fontSize="lg" 
          fontWeight="bold" 
          mb={1}
          color={isFutureMonth ? "gray.500" : "white"}
        >
          {new Date(section.year, section.month).toLocaleString('default', { month: 'long' })} {section.year}
        </Text>
        
        {/* Week days header */}
        <HStack space={2} justifyContent="space-between" mb={1}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <Box key={day} flex={1} alignItems="center">
              <Text fontSize="2xs" color="gray.400">{day}</Text>
            </Box>
          ))}
        </HStack>

        {/* Weeks */}
        {weeks.map((week, weekIndex) => (
          <HStack key={`${section.year}-${section.month}-week-${weekIndex}`} space={2}>
            {week.map((day, dayIndex) => {
              if (day === 0) {
                return <Box key={`empty-${dayIndex}`} flex={1} h={10} />;
              }

              const workout = getWorkoutForDate(day, section.month, section.year);
              const dateStr = formatDate(day, section.month, section.year);
              const isSelected = dateStr === selectedDate;
              const todayHighlight = isToday(day, section.month, section.year);

              // Check if this day is in the future
              const isFutureDay = 
                isFutureMonth || 
                (section.year === currentYear && 
                 section.month === currentMonth && 
                 day > currentDay);

              return (
                <Pressable
                  key={`${section.year}-${section.month}-${day}`}
                  flex={1}
                  onPress={() => handleDayPress(day, section.month, section.year)}
                  opacity={isFutureDay ? 0.5 : 1}
                >
                  <Box
                    h={10}
                    alignItems="center"
                    justifyContent="center"
                    bg={todayHighlight ? "#6B8EF2" : "#2A2E38"}
                    borderRadius="lg"
                    borderWidth={isSelected ? 3 : 0}
                    borderColor="#4169E1"
                  >
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
            })}
          </HStack>
        ))}
      </VStack>
    );
  }, [visibleMonth, selectedDate, getWorkoutForDate, handleDayPress]);

  return (
    <Box flex={1} bg="#1E2028">
      {/* Calendar */}
      <Box flex={1} bg="#1E2028" px={2} pt={4}>
        <FlatList
          data={monthSections}
          renderItem={renderMonthMemo}
          keyExtractor={(item) => `${item.year}-${item.month}`}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          initialScrollIndex={0}
          getItemLayout={(data, index) => ({
            length: 200,
            offset: 200 * index,
            index,
          })}
          maxToRenderPerBatch={2}
          windowSize={3}
          removeClippedSubviews={true}
          style={{ backgroundColor: '#1E2028' }}
        />
      </Box>
    </Box>
  );
};

export default WorkoutCalendar; 