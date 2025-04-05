import React, { useEffect, useState } from 'react';
import { Box, Text, VStack, HStack, Avatar, ScrollView, Pressable, Spinner, Button } from 'native-base';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../utils/supabaseClient';
import { User } from '@supabase/supabase-js';
import { useNavigation } from '@react-navigation/native';

type WorkoutTab = {
  id: number;
  title: string;
  icon: keyof typeof MaterialIcons.glyphMap;
};

const ProfileScreen: React.FC = () => {
  const navigation = useNavigation();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalWorkouts: 0,
    hoursTrained: 0
  });

  const workoutTabs: WorkoutTab[] = [
    { id: 1, title: 'Workouts', icon: 'fitness-center' },
    { id: 2, title: 'Progress', icon: 'trending-up' },
    { id: 3, title: 'Statistics', icon: 'bar-chart' },
    { id: 4, title: 'Goals', icon: 'flag' },
  ];

  useEffect(() => {
    fetchUserData();
    fetchUserStats();
  }, []);

  const fetchUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    } catch (error) {
      console.error('Error fetching user:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserStats = async () => {
    try {
      // Fetch workout sessions from your storage service
      const { data: sessions } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('user_id', user?.id);

      if (sessions) {
        setStats({
          totalWorkouts: sessions.length,
          hoursTrained: sessions.reduce((acc, session) => acc + (session.duration || 0), 0)
        });
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      // Navigation will be handled by the auth state change listener in App.tsx
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  if (loading) {
    return (
      <Box flex={1} bg="#1E2028" justifyContent="center" alignItems="center">
        <Spinner color="#6B8EF2" />
      </Box>
    );
  }

  return (
    <Box flex={1} bg="#1E2028">
      <ScrollView>
        <VStack space={6} p={4}>
          {/* Profile Header */}
          <VStack space={4} alignItems="center" pt={4}>
            <Avatar
              size="2xl"
              source={{
                uri: user?.user_metadata?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1000&q=80',
              }}
            />
            <VStack space={1} alignItems="center">
              <Text color="white" fontSize="2xl" fontWeight="bold">
                {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'}
              </Text>
              <Text color="gray.400" fontSize="md">
                {user?.email}
              </Text>
            </VStack>
          </VStack>

          {/* Workout Tabs */}
          <VStack space={4}>
            <Text color="white" fontSize="xl" fontWeight="bold">
              My Fitness
            </Text>
            <HStack space={4} flexWrap="wrap">
              {workoutTabs.map((tab) => (
                <Pressable
                  key={tab.id}
                  bg="#2A2D36"
                  p={4}
                  rounded="lg"
                  width="45%"
                  mb={4}
                >
                  <VStack space={2} alignItems="center">
                    <MaterialIcons name={tab.icon} size={24} color="#fff" />
                    <Text color="white" fontSize="md">
                      {tab.title}
                    </Text>
                  </VStack>
                </Pressable>
              ))}
            </HStack>
          </VStack>

          {/* Stats Section */}
          <VStack space={4}>
            <Text color="white" fontSize="xl" fontWeight="bold">
              Statistics
            </Text>
            <HStack space={4} flexWrap="wrap">
              <Box bg="#2A2D36" p={4} rounded="lg" width="45%">
                <Text color="gray.400" fontSize="sm">Total Workouts</Text>
                <Text color="white" fontSize="xl" fontWeight="bold">{stats.totalWorkouts}</Text>
              </Box>
              <Box bg="#2A2D36" p={4} rounded="lg" width="45%">
                <Text color="gray.400" fontSize="sm">Hours Trained</Text>
                <Text color="white" fontSize="xl" fontWeight="bold">{stats.hoursTrained}</Text>
              </Box>
            </HStack>
          </VStack>

          {/* Logout Button */}
          <Button
            bg="#FF4B4B"
            _pressed={{ bg: "#E63939" }}
            onPress={handleLogout}
            mt={4}
          >
            Logout
          </Button>
        </VStack>
      </ScrollView>
    </Box>
  );
};

export default ProfileScreen; 