import React, { useCallback } from 'react';
import { HStack, Pressable, Text, Box, VStack } from '@gluestack-ui/themed';
import { AntDesign } from '@expo/vector-icons';
import { setBottomNavHeight } from '../navigation/layoutMetrics';

interface BottomNavbarProps {
  selectedTab: 'progress' | 'workout' | 'profile';
  onTabChange: (tab: 'progress' | 'workout' | 'profile') => void;
}

const BottomNavbar: React.FC<BottomNavbarProps> = ({ selectedTab, onTabChange }) => {
  const activeColor = '$primary500';
  const inactiveColor = '$textLight400';
  const activeHex = '#6B8EF2';
  const inactiveHex = '#adb5bd';
  const iconSize = 20;

  const onLayout = useCallback((e: any) => {
    const h = e?.nativeEvent?.layout?.height;
    if (typeof h === 'number') setBottomNavHeight(Math.ceil(h));
  }, []);

  return (
    <Box bg="#121213ff" borderTopWidth={1} borderColor="$borderDark800" onLayout={onLayout}>
      <HStack px="$4" space="2xl" justifyContent="space-around" alignItems="center" pt="$4" pb="$1">
        <Pressable onPress={() => onTabChange('workout')} accessibilityRole="button" accessibilityLabel="Workout Tab">
          <VStack alignItems="center" space="xs">
            <AntDesign 
              name="appstore-o" 
              color={selectedTab === 'workout' ? activeHex : inactiveHex} 
              size={iconSize}
            />
            <Text
              color={selectedTab === 'workout' ? activeColor : inactiveColor}
              fontSize="$xs"
            >
              Workout
            </Text>
          </VStack>
        </Pressable>
        <Pressable onPress={() => onTabChange('progress')} accessibilityRole="button" accessibilityLabel="Progress Tab">
          <VStack alignItems="center" space="xs">
            <AntDesign 
              name="calendar" 
              color={selectedTab === 'progress' ? activeHex : inactiveHex} 
              size={iconSize}
            />
            <Text
              color={selectedTab === 'progress' ? activeColor : inactiveColor}
              fontSize="$xs"
            >
              Progress
            </Text>
          </VStack>
        </Pressable>
        <Pressable onPress={() => onTabChange('profile')} accessibilityRole="button" accessibilityLabel="Profile Tab">
          <VStack alignItems="center" space="xs">
            <AntDesign 
              name="user" 
              color={selectedTab === 'profile' ? activeHex : inactiveHex} 
              size={iconSize}
            />
            <Text
              color={selectedTab === 'profile' ? activeColor : inactiveColor}
              fontSize="$xs"
            >
              Profile
            </Text>
          </VStack>
        </Pressable>
      </HStack>
    </Box>
  );
};

export default BottomNavbar; 