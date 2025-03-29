import React from 'react';
import { Box, Text } from 'native-base';

const ProfileScreen: React.FC = () => {
  return (
    <Box flex={1} bg="#1E2028" p={4}>
      <Text color="white" fontSize="xl" fontWeight="bold">
        My Profile
      </Text>
    </Box>
  );
};

export default ProfileScreen; 