import React, { useState, useEffect } from 'react';
import { Box, Text } from 'native-base';
import WorkoutCalendar from '../components/WorkoutCalendar';
import { MonthData, WorkoutDay } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Split } from './WorkoutScreen';
import { useFocusEffect } from '@react-navigation/native';

const ProgressScreen: React.FC = () => {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [loading, setLoading] = useState(true);
  const [calendarKey, setCalendarKey] = useState(0);
  const [monthData, setMonthData] = useState<MonthData>({
    month: currentMonth,
    year: currentYear,
    workouts: []
  });
  const [splits, setSplits] = useState<Split[]>([]);

  // Initial load - should only happen once when app starts
  useEffect(() => {
    const initialLoad = async () => {
      setLoading(true);
      try {
        // Load splits data first
        const splitsData = await AsyncStorage.getItem('splits');
        
        if (splitsData) {
          const parsedSplits = JSON.parse(splitsData);
          console.log('Initial load - splits:', parsedSplits.length);
          setSplits(parsedSplits);
        } else {
          console.log('No splits data found on initial load');
          setSplits([]);
        }

        // Load workouts data
        const workoutsData = await AsyncStorage.getItem('workout_data');
        if (workoutsData) {
          const parsedData = JSON.parse(workoutsData);
          console.log('Initial load - workouts:', parsedData);
          setMonthData(parsedData);
        } else {
          // Only use defaults on initial load
          setMonthData({
            month: currentMonth,
            year: currentYear,
            workouts: []
          });
        }

        // Increment the calendar key to force a complete re-render
        setCalendarKey(prev => prev + 1);
      } catch (error) {
        console.error('Error on initial load:', error);
      } finally {
        setLoading(false);
        setIsInitialLoad(false);
      }
    };
    
    initialLoad();
  }, []);

  // When returning to this screen, only update with newest data, don't reset to defaults
  useFocusEffect(
    React.useCallback(() => {
      if (!isInitialLoad) {
        const refreshData = async () => {
          console.log('Screen focused, refreshing data...');
          try {
            // Get latest splits data
            const splitsData = await AsyncStorage.getItem('splits');
            if (splitsData) {
              const parsedSplits = JSON.parse(splitsData);
              console.log('Refresh - splits:', parsedSplits.length);
              setSplits(parsedSplits);
            }

            // Get latest workout data
            const workoutsData = await AsyncStorage.getItem('workout_data');
            if (workoutsData) {
              const parsedData = JSON.parse(workoutsData);
              console.log('Refresh - workout data:', parsedData);
              setMonthData(parsedData);
              setCalendarKey(prev => prev + 1);
            }
          } catch (error) {
            console.error('Error refreshing data:', error);
          }
        };
        
        refreshData();
      }
    }, [isInitialLoad])
  );

  return (
    <Box flex={1} bg="#1E2028">
      {splits.length > 0 ? (
        <WorkoutCalendar 
          key={`calendar-${calendarKey}`}
          data={monthData} 
          splits={splits} 
        />
      ) : (
        <Box flex={1} justifyContent="center" alignItems="center">
          <Text color="white" fontSize="md">Loading calendar...</Text>
        </Box>
      )}
    </Box>
  );
};

export default ProgressScreen; 