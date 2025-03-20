import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  
  // Add refs for caching
  const isInitialLoadRef = useRef(true);
  const processedDataRef = useRef<{
    splits: Split[];
    monthData: MonthData;
  }>({
    splits: [],
    monthData: {
      month: currentMonth,
      year: currentYear,
      workouts: []
    }
  });

  // Initial load - should only happen once when app starts
  useEffect(() => {
    const initialLoad = async () => {
      if (!isInitialLoadRef.current) return;
      
      setLoading(true);
      try {
        // Load splits data first
        const splitsData = await AsyncStorage.getItem('splits');
        
        if (splitsData) {
          const parsedSplits = JSON.parse(splitsData);
          console.log('Initial load - splits:', parsedSplits.length);
          setSplits(parsedSplits);
          processedDataRef.current.splits = parsedSplits;
        } else {
          console.log('No splits data found on initial load');
          setSplits([]);
          processedDataRef.current.splits = [];
        }

        // Load workouts data
        const workoutsData = await AsyncStorage.getItem('workout_data');
        if (workoutsData) {
          const parsedData = JSON.parse(workoutsData);
          console.log('Initial load - workouts:', parsedData);
          setMonthData(parsedData);
          processedDataRef.current.monthData = parsedData;
        } else {
          // Only use defaults on initial load
          const defaultData = {
            month: currentMonth,
            year: currentYear,
            workouts: []
          };
          setMonthData(defaultData);
          processedDataRef.current.monthData = defaultData;
        }

        // Increment the calendar key to force a complete re-render
        setCalendarKey(prev => prev + 1);
      } catch (error) {
        console.error('Error on initial load:', error);
      } finally {
        setLoading(false);
        setIsInitialLoad(false);
        isInitialLoadRef.current = false;
      }
    };
    
    initialLoad();
  }, []);

  // When returning to this screen, only update with newest data, don't reset to defaults
  useFocusEffect(
    React.useCallback(() => {
      if (!isInitialLoadRef.current) {
        const refreshData = async () => {
          console.log('Screen focused, refreshing data...');
          try {
            // Get latest splits data
            const splitsData = await AsyncStorage.getItem('splits');
            if (splitsData) {
              const parsedSplits = JSON.parse(splitsData);
              // Only update if data has changed
              if (JSON.stringify(parsedSplits) !== JSON.stringify(processedDataRef.current.splits)) {
                console.log('Refresh - splits:', parsedSplits.length);
                setSplits(parsedSplits);
                processedDataRef.current.splits = parsedSplits;
              }
            }

            // Get latest workout data
            const workoutsData = await AsyncStorage.getItem('workout_data');
            if (workoutsData) {
              const parsedData = JSON.parse(workoutsData);
              // Only update if data has changed
              if (JSON.stringify(parsedData) !== JSON.stringify(processedDataRef.current.monthData)) {
                console.log('Refresh - workout data:', parsedData);
                setMonthData(parsedData);
                processedDataRef.current.monthData = parsedData;
                setCalendarKey(prev => prev + 1);
              }
            }
          } catch (error) {
            console.error('Error refreshing data:', error);
          }
        };
        
        refreshData();
      }
    }, [isInitialLoadRef])
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