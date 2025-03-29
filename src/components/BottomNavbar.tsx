import React from 'react';
import { HStack, Pressable, Text, Box, VStack, Icon } from 'native-base';
import { AntDesign } from '@expo/vector-icons';

interface BottomNavbarProps {
  selectedTab: 'progress' | 'workout' | 'profile';
  onTabChange: (tab: 'progress' | 'workout' | 'profile') => void;
}

const BottomNavbar: React.FC<BottomNavbarProps> = ({ selectedTab, onTabChange }) => {
  return (
    <Box bg="#1E2028" borderTopWidth={1} borderColor="gray.800">
      <HStack py={2} px={4} space={8} justifyContent="space-around" alignItems="center">
        <Pressable onPress={() => onTabChange('progress')}>
          <VStack alignItems="center" space={1}>
            <Icon 
              as={AntDesign} 
              name="calendar" 
              color={selectedTab === 'progress' ? '#6B8EF2' : 'gray.400'} 
              size="md"
            />
            <Text
              color={selectedTab === 'progress' ? '#6B8EF2' : 'gray.400'}
              fontSize="xs"
            >
              Progress
            </Text>
          </VStack>
        </Pressable>
        <Pressable onPress={() => onTabChange('workout')}>
          <VStack alignItems="center" space={1}>
            <Icon 
              as={AntDesign} 
              name="appstore-o" 
              color={selectedTab === 'workout' ? '#6B8EF2' : 'gray.400'} 
              size="md"
            />
            <Text
              color={selectedTab === 'workout' ? '#6B8EF2' : 'gray.400'}
              fontSize="xs"
            >
              Workout
            </Text>
          </VStack>
        </Pressable>
        <Pressable onPress={() => onTabChange('profile')}>
          <VStack alignItems="center" space={1}>
            <Icon 
              as={AntDesign} 
              name="user" 
              color={selectedTab === 'profile' ? '#6B8EF2' : 'gray.400'} 
              size="md"
            />
            <Text
              color={selectedTab === 'profile' ? '#6B8EF2' : 'gray.400'}
              fontSize="xs"
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