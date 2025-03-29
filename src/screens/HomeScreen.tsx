import React, { useState } from 'react';
import { Box } from 'native-base';
import ProgressScreen from './ProgressScreen';
import WorkoutScreen from './WorkoutScreen';
import ProfileScreen from './ProfileScreen';
import BottomNavbar from '../components/BottomNavbar';

const HomeScreen: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState<'progress' | 'workout' | 'profile'>('progress');

  const renderContent = () => {
    switch (selectedTab) {
      case 'progress':
        return <ProgressScreen />;
      case 'workout':
        return <WorkoutScreen />;
      case 'profile':
        return <ProfileScreen />;
      default:
        return <ProgressScreen />;
    }
  };

  return (
    <Box flex={1} bg="#1E2028">
      <Box flex={1}>
        {renderContent()}
      </Box>
      <BottomNavbar selectedTab={selectedTab} onTabChange={setSelectedTab} />
    </Box>
  );
};

export default HomeScreen; 