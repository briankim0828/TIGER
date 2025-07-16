// this component is not used at all - deprecated
// replaced by BottomNavbar

import React, { useEffect, useRef, useState } from 'react';
import { HStack, Pressable, Text, Box } from 'native-base';
import { Animated, LayoutChangeEvent, View } from 'react-native';

interface SelectionNavbarProps {
  selectedTab: 'progress' | 'workout';
  onTabChange: (tab: 'progress' | 'workout') => void;
}

interface TabMeasurements {
  width: number;
  x: number;
}

const SelectionNavbar: React.FC<SelectionNavbarProps> = ({ selectedTab, onTabChange }) => {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [measurements, setMeasurements] = useState<{
    progress?: TabMeasurements;
    workout?: TabMeasurements;
  }>({});

  const handleLayout = (tab: 'progress' | 'workout') => (event: LayoutChangeEvent) => {
    const { width, x } = event.nativeEvent.layout;
    setMeasurements(prev => ({
      ...prev,
      [tab]: { width, x }
    }));
  };

  useEffect(() => {
    if (measurements.progress && measurements.workout) {
      const toValue = selectedTab === 'progress' ? measurements.progress.x : measurements.workout.x;
      const width = selectedTab === 'progress' ? measurements.progress.width : measurements.workout.width;
      
      slideAnim.setValue(selectedTab === 'progress' ? measurements.progress.x : measurements.workout.x);
      
      Animated.spring(slideAnim, {
        toValue,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();
    }
  }, [selectedTab, measurements]);

  return (
    <Box bg="#1E2028" pb={0}>
      <HStack py={2} px={4} space={8} justifyContent="center" alignItems="center">
        <View onLayout={handleLayout('progress')}>
          <Pressable onPress={() => onTabChange('progress')}>
            <Text
              color={selectedTab === 'progress' ? '#6B8EF2' : 'gray.400'}
              fontWeight={selectedTab === 'progress' ? 'bold' : 'normal'}
              fontSize="md"
            >
              Progress
            </Text>
          </Pressable>
        </View>
        <View onLayout={handleLayout('workout')}>
          <Pressable onPress={() => onTabChange('workout')}>
            <Text
              color={selectedTab === 'workout' ? '#6B8EF2' : 'gray.400'}
              fontWeight={selectedTab === 'workout' ? 'bold' : 'normal'}
              fontSize="md"
            >
              Workout
            </Text>
          </Pressable>
        </View>
      </HStack>
      <Animated.View
        style={{
          position: 'absolute',
          bottom: 4,
          height: 2,
          backgroundColor: '#6B8EF2',
          width: selectedTab === 'progress' 
            ? measurements.progress?.width || 0 
            : measurements.workout?.width || 0,
          transform: [{
            translateX: slideAnim
          }]
        }}
      />
    </Box>
  );
};

export default SelectionNavbar; 