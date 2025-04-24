import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Box, Text, VStack, HStack, Avatar, ScrollView, Pressable, Spinner, Button, IconButton, useToast, AlertDialog } from 'native-base';
import { MaterialIcons } from '@expo/vector-icons';
import { User } from '@supabase/supabase-js';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useData } from '../contexts/DataContext';
import {
  UserProfile,
  getCurrentUser,
  signOutUser,
  fetchUserProfileFromSupabase,
  updateUserProfileAvatar,
  getAvatarPublicUrl,
  uploadAvatar,
  fetchUserWorkoutStats,
  deleteWorkoutSessions
} from '../supabase/supabaseProfile';

type WorkoutTab = {
  id: number;
  title: string;
  icon: keyof typeof MaterialIcons.glyphMap;
};

const ProfileScreen: React.FC = () => {
  const navigation = useNavigation();
  const toast = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [stats, setStats] = useState({
    totalWorkouts: 0,
    hoursTrained: 0
  });
  const [cachedAvatarUrl, setCachedAvatarUrl] = useState<string | null>(null);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const cancelRef = React.useRef(null);
  const { clearStorage, refreshData } = useData();

  const workoutTabs: WorkoutTab[] = [
    { id: 1, title: 'Workouts', icon: 'fitness-center' },
    { id: 2, title: 'Progress', icon: 'trending-up' },
    { id: 3, title: 'Statistics', icon: 'bar-chart' },
    { id: 4, title: 'Goals', icon: 'flag' },
  ];

  const fetchUserData = async () => {
    setLoading(true);
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      console.error('Error fetching user:', error);
      // Handle error appropriately, maybe show a toast
    } finally {
      setLoading(false);
    }
  };

  const fetchUserProfile = useCallback(async () => {
    if (!user) return;
    
    try {
      const profileData = await fetchUserProfileFromSupabase(user.id);
      setUserProfile(profileData);
      
      if (profileData?.avatar_id) {
        const avatarUrl = getAvatarPublicUrl(profileData.avatar_id);
        setCachedAvatarUrl(avatarUrl);
      }
    } catch (error) {
      // Error is logged within fetchUserProfileFromSupabase
      // Handle UI feedback if needed
    }
  }, [user]);

  useEffect(() => {
    fetchUserData();
  }, []);

  useEffect(() => {
    if (user) {
      fetchUserProfile();
      fetchUserStats();
    }
  }, [user, fetchUserProfile]);

  const avatarUrl = useMemo(() => {
    if (cachedAvatarUrl) {
      return cachedAvatarUrl;
    }
    
    if (userProfile?.avatar_id) {
      const url = getAvatarPublicUrl(userProfile.avatar_id);
      if (url) {
          setTimeout(() => setCachedAvatarUrl(url), 0);
          return url;
      }
    }
    
    const initials = userProfile?.display_name?.charAt(0) || 
                    user?.email?.charAt(0)?.toUpperCase() || 
                    '?';
    const color = '6B8EF2'; // Brand blue color
    return `https://ui-avatars.com/api/?name=${initials}&background=${color}&color=fff&size=256&bold=true`;

  }, [userProfile, cachedAvatarUrl, user]);

  const fetchUserStats = async () => {
    if (!user) return;
    try {
      const userStats = await fetchUserWorkoutStats(user.id);
      if (userStats) {
        setStats(userStats);
      }
    } catch (error) {
      // Error logged within fetchUserWorkoutStats
      console.error('Error fetching stats on component level:', error);
    }
  };

  const handleLogout = async () => {
    try {
      const { error } = await signOutUser();
      if (error) throw error;
      // Auth state change listener in App.tsx will handle navigation
    } catch (error) {
      // Error logged within signOutUser
      toast.show({ title: "Logout Error", description: "Failed to log out.", placement: "top" });
    }
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        toast.show({
          title: "Permission needed",
          description: "Please grant permission to access your photos",
          placement: "top",
          duration: 3000,
        });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        await uploadImage(result.assets[0]);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      toast.show({
        title: "Error",
        description: "Failed to pick image. Please try again.",
        placement: "top",
        duration: 3000,
      });
    }
  };

  const uploadImage = async (imageAsset: ImagePicker.ImagePickerAsset) => {
    if (!user || !imageAsset.base64) return;
    
    try {
      setUploading(true);
      
      const uploadResult = await uploadAvatar(user.id, imageAsset.uri, imageAsset.base64);
      
      if (!uploadResult) {
        throw new Error("Avatar upload failed");
      }
      
      const { filePath, publicUrl } = uploadResult;
      
      setCachedAvatarUrl(publicUrl);
      
      const updatedProfile = await updateUserProfileAvatar(user.id, filePath);
      
      if (!updatedProfile) {
        console.error('Failed to update profile after avatar upload');
        throw new Error('Failed to update profile');
      }
      
      setUserProfile(updatedProfile);
      
      toast.show({
        title: "Success",
        description: "Profile picture updated successfully",
        placement: "top",
        duration: 3000,
      });
    } catch (error) {
      console.error('Error updating avatar:', error);
      toast.show({
        title: "Error",
        description: "Failed to update profile picture. Please try again.",
        placement: "top",
        duration: 3000,
      });
    } finally {
      setUploading(false);
    }
  };

  const handleClearAllData = async () => {
    try {
      console.log('[DEBUG] Clearing workout sessions data');
      
      if (!user?.id) {
        throw new Error('No authenticated user found');
      }
      
      const { error: deleteError } = await deleteWorkoutSessions(user.id);
        
      if (deleteError) {
        console.error('Error deleting workout sessions:', deleteError);
        throw deleteError;
      }
      
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        await AsyncStorage.removeItem('workout_sessions');
        console.log('[DEBUG] Successfully cleared local workout session data');
      } catch (localError) {
        console.error('Error clearing local workout sessions:', localError);
      }
      
      await refreshData();
      setStats({ totalWorkouts: 0, hoursTrained: 0 });
      
      setIsAlertOpen(false);
      toast.show({
        title: "Workout Data Cleared",
        description: "All workout session history has been removed",
        placement: "top",
        duration: 3000
      });
      
    } catch (error) {
      console.error('Error clearing workout data:', error);
      toast.show({
        title: "Error",
        description: "Failed to clear workout data",
        placement: "top",
        duration: 3000
      });
      setIsAlertOpen(false);
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
          <VStack space={4} alignItems="center" pt={4}>
            <Box position="relative">
              <Avatar
                size="2xl"
                source={{
                  uri: avatarUrl || undefined
                }}
              />
              <IconButton
                icon={uploading ? <Spinner size="sm" color="#fff" /> : <MaterialIcons name="edit" size={20} color="#fff" />}
                position="absolute"
                bottom={0}
                right={0}
                bg="#1254a1"
                rounded="full"
                size="sm"
                onPress={pickImage}
                isDisabled={uploading}
                _pressed={{ bg: "#5A7CD9" }}
              />
            </Box>
            <VStack space={1} alignItems="center">
              <Text color="white" fontSize="2xl" fontWeight="bold">
                {userProfile?.display_name || user?.email?.split('@')[0] || 'User'}
              </Text>
              <Text color="gray.400" fontSize="md">
                {user?.email}
              </Text>
            </VStack>
          </VStack>

          <VStack space={4}>
            {/* <Text color="white" fontSize="xl" fontWeight="bold">
              Statistics
            </Text> */}
            {/* <HStack space={4} flexWrap="wrap" justifyContent="center">
              <Box bg="#2A2D36" p={4} rounded="lg" width="45%" alignItems="center">
                <Text color="gray.400" fontSize="sm" textAlign="center">Total Workouts</Text>
                <Text color="white" fontSize="xl" fontWeight="bold" textAlign="center">{stats.totalWorkouts}</Text>
              </Box>
              <Box bg="#2A2D36" p={4} rounded="lg" width="45%" alignItems="center">
                <Text color="gray.400" fontSize="sm" textAlign="center">Hours Trained</Text>
                <Text color="white" fontSize="xl" fontWeight="bold" textAlign="center">{stats.hoursTrained}</Text>
              </Box>
            </HStack> */}
            <HStack space={4} flexWrap="wrap" justifyContent="center">
              <Box bg="transparent" p={4} rounded="lg" width="45%" alignItems="center">
                <Text color="white" fontSize="3xl" fontWeight="bold" textAlign="center">{stats.totalWorkouts}</Text>
                <Text color="gray.400" fontSize="sm" textAlign="center">Total Workouts</Text>
              </Box>
              <Box bg="transparent" p={4} rounded="lg" width="45%" alignItems="center">
                <Text color="white" fontSize="3xl" fontWeight="bold" textAlign="center">{stats.hoursTrained}</Text>
                <Text color="gray.400" fontSize="sm" textAlign="center">Hours Trained</Text>
              </Box>
            </HStack>
          </VStack>

          <VStack space={4}>
            <Text color="white" fontSize="xl" fontWeight="bold" pl={3}>
              My Fitness
            </Text>
            <VStack space={4}>
              <HStack space={4} justifyContent="center">
                {workoutTabs.slice(0, 2).map((tab) => (
                  <Pressable
                    key={tab.id}
                    bg="#2A2D36"
                    p={4}
                    rounded="lg"
                    width="47%"
                    alignItems="center"
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
              <HStack space={4} justifyContent="center">
                {workoutTabs.slice(2, 4).map((tab) => (
                  <Pressable
                    key={tab.id}
                    bg="#2A2D36"
                    p={4}
                    rounded="lg"
                    width="47%"
                    alignItems="center"
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
          </VStack>

          <Button
            bg="#FF4B4B"
            _pressed={{ bg: "#E63939" }}
            onPress={handleLogout}
            mt={4}
          >
            Logout
          </Button>

          <Box mt={6} p={4} bg="#262A35" borderRadius="lg">
            <Text fontSize="xl" color="white" fontWeight="bold" mb={4}>
              Developer Options
            </Text>
            
            <Button 
              colorScheme="danger" 
              leftIcon={<MaterialIcons name="delete-forever" size={24} color="white" />}
              onPress={() => setIsAlertOpen(true)}
              mb={2}
            >
              Clear Workout History
            </Button>
            
            <Text fontSize="xs" color="gray.400" mt={1}>
              Warning: This will delete all workout session history from Supabase.
            </Text>
          </Box>
        </VStack>
      </ScrollView>
      
      <AlertDialog 
        leastDestructiveRef={cancelRef} 
        isOpen={isAlertOpen} 
        onClose={() => setIsAlertOpen(false)}
      >
        <AlertDialog.Content>
          <AlertDialog.CloseButton />
          <AlertDialog.Header>Clear Workout History</AlertDialog.Header>
          <AlertDialog.Body>
            This will remove all your workout session history. 
            This action cannot be undone. Your profile and other settings will remain intact.
            Are you sure you want to continue?
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button.Group space={2}>
              <Button variant="unstyled" colorScheme="coolGray" onPress={() => setIsAlertOpen(false)} ref={cancelRef}>
                Cancel
              </Button>
              <Button colorScheme="danger" onPress={handleClearAllData}>
                Delete
              </Button>
            </Button.Group>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog>
    </Box>
  );
};

export default ProfileScreen; 