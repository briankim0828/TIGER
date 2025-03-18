import React from 'react';
import { Box } from 'native-base';
import WorkoutCalendar from '../components/WorkoutCalendar';
import { MonthData, WorkoutDay } from '../types';

const currentMonth = new Date().getMonth();
const currentYear = new Date().getFullYear();

const mockData: MonthData = {
  month: currentMonth,
  year: currentYear,
  workouts: []
};

const ProgressScreen: React.FC = () => {
  const handleDayPress = (day: any) => {
    console.log('Selected day:', day);
  };

  return (
    <Box flex={1} bg="#1E2028">
      <WorkoutCalendar data={mockData} onDayPress={handleDayPress} />
    </Box>
  );
};

export default ProgressScreen; 