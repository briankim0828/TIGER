import React, { useState } from 'react';
import { Box } from 'native-base';
import SelectionNavbar from '../components/SelectionNavbar';
import WorkoutScreen from './WorkoutScreen';
import ProgressScreen from './ProgressScreen';

const HomeScreen: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState<'progress' | 'workout'>('progress');

  return (
    <Box flex={1} bg="#1E2028">
      <SelectionNavbar selectedTab={selectedTab} onTabChange={setSelectedTab} />
      {selectedTab === 'progress' ? (
        <ProgressScreen />
      ) : (
        <WorkoutScreen />
      )}
    </Box>
  );
};

export default HomeScreen; 