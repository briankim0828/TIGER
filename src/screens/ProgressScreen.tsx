import React, { useEffect, useState } from 'react';
import { Box } from 'native-base';
import WorkoutCalendar from '../components/WorkoutCalendar';
import { MonthData, WorkoutDay } from '../types';
import { Split } from './WorkoutScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';

const currentMonth = new Date().getMonth();
const currentYear = new Date().getFullYear();

const mockData: MonthData = {
  month: currentMonth,
  year: currentYear,
  workouts: []
};

interface ProgressScreenProps {
  splits: Split[];
}

const ProgressScreen: React.FC<ProgressScreenProps> = ({ splits }) => {
  const [monthData, setMonthData] = useState<MonthData>(mockData);

  return (
    <Box flex={1} bg="#1E2028">
      <WorkoutCalendar data={monthData} splits={splits} />
    </Box>
  );
};

export default ProgressScreen; 