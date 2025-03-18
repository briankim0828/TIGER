import React, { useState } from 'react';
import { Box } from 'native-base';
import WorkoutCalendar from '../components/WorkoutCalendar';
import SelectionNavbar from '../components/SelectionNavbar';
import WorkoutScreen from './WorkoutScreen';

// Mock data
const currentMonth = new Date().getMonth();
const currentYear = new Date().getFullYear();

const mockData = {
  month: currentMonth,
  year: currentYear,
  workouts: []
};

const HomeScreen = () => {
  const [selectedTab, setSelectedTab] = useState<'progress' | 'workout'>('progress');

  const handleDayPress = (date: string) => {
    console.log('Day pressed:', date);
  };

  return (
    <Box flex={1} bg="#1E2028">
      <SelectionNavbar selectedTab={selectedTab} onTabChange={setSelectedTab} />
      {selectedTab === 'progress' ? (
        <WorkoutCalendar data={mockData} onDayPress={handleDayPress} />
      ) : (
        <WorkoutScreen />
      )}
    </Box>
  );
};

export default HomeScreen; 