import React, { useState, useEffect } from 'react';
import { Box } from 'native-base';
import SelectionNavbar from '../components/SelectionNavbar';
import WorkoutScreen from './WorkoutScreen';
import ProgressScreen from './ProgressScreen';
import { Split } from './WorkoutScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HomeScreen: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState<'progress' | 'workout'>('progress');
  const [splits, setSplits] = useState<Split[]>([]);

  // Load splits from AsyncStorage
  useEffect(() => {
    const loadSplits = async () => {
      try {
        const savedSplits = await AsyncStorage.getItem('splits');
        if (savedSplits) {
          setSplits(JSON.parse(savedSplits));
        }
      } catch (error) {
        console.error('Error loading splits:', error);
      }
    };
    loadSplits();
  }, []);

  return (
    <Box flex={1} bg="#1E2028">
      <SelectionNavbar selectedTab={selectedTab} onTabChange={setSelectedTab} />
      {selectedTab === 'progress' ? (
        <ProgressScreen splits={splits} />
      ) : (
        <WorkoutScreen />
      )}
    </Box>
  );
};

export default HomeScreen; 