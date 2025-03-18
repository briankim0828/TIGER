import React from 'react';
import { Box, VStack, Text, Avatar, HStack, Divider } from 'native-base';

const ProfileScreen = () => {
  return (
    <Box flex={1} bg="#1E2028" pt={10} px={4}>
      <VStack space={6}>
        <HStack space={4} alignItems="center">
          <Avatar bg="#6B8EF2" size="xl">
            PR
          </Avatar>
          <VStack>
            <Text color="white" fontSize="xl" fontWeight="bold">
              Workout User
            </Text>
            <Text color="gray.400" fontSize="sm">
              Fitness Enthusiast
            </Text>
          </VStack>
        </HStack>

        <Divider bg="gray.700" />

        <VStack space={4}>
          <Text color="white" fontSize="lg" fontWeight="bold">
            Statistics
          </Text>
          <HStack justifyContent="space-between">
            <VStack bg="#2A2E38" p={4} borderRadius="lg" flex={1} mr={2}>
              <Text color="gray.400" fontSize="xs">
                Workouts
              </Text>
              <Text color="white" fontSize="xl" fontWeight="bold">
                0
              </Text>
            </VStack>
            <VStack bg="#2A2E38" p={4} borderRadius="lg" flex={1} ml={2}>
              <Text color="gray.400" fontSize="xs">
                Exercises
              </Text>
              <Text color="white" fontSize="xl" fontWeight="bold">
                0
              </Text>
            </VStack>
          </HStack>
        </VStack>

        <VStack space={4}>
          <Text color="white" fontSize="lg" fontWeight="bold">
            Settings
          </Text>
          <VStack space={2} bg="#2A2E38" p={4} borderRadius="lg">
            <Text color="white" fontSize="md">
              App Preferences
            </Text>
            <Text color="white" fontSize="md">
              Units (kg/lbs)
            </Text>
            <Text color="white" fontSize="md">
              Dark/Light Mode
            </Text>
          </VStack>
        </VStack>
      </VStack>
    </Box>
  );
};

export default ProfileScreen; 