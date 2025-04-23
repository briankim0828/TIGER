import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Box, Text, VStack, HStack, Avatar, ScrollView, Pressable, Spinner, Button, IconButton, useToast, AlertDialog } from 'native-base';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../utils/supabaseClient';
import { User } from '@supabase/supabase-js';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { useData } from '../contexts/DataContext';

type WorkoutTab = {
  id: number;
  title: string;
  icon: keyof typeof MaterialIcons.glyphMap;
};

// Interface for profile data from profiles table
interface UserProfile {
  user_id: string;
  email: string;
  display_name: string;
  avatar_id: string | null;
  updated_at: string;
}

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
  // Store cached avatar URL to prevent flickering
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
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    } catch (error) {
      console.error('Error fetching user:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch user profile with memoization to reduce redundant fetches
  const fetchUserProfile = useCallback(async () => {
    if (!user) return;
    
    try {
      console.log('Fetching user profile for:', user.id);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
        
      if (error) {
        console.error('Error fetching user profile:', error);
        return;
      }
      
      if (data) {
        console.log('Profile data retrieved:', data);
        setUserProfile(data as UserProfile);
        
        // Update cached avatar URL when profile changes
        if (data.avatar_id) {
          const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(data.avatar_id);
            
          // Add timestamp as cache buster
          const timestamp = new Date().getTime();
          const avatarUrl = `${publicUrl}?t=${timestamp}`;
          setCachedAvatarUrl(avatarUrl);
        }
      } else {
        console.log('No profile found for user');
      }
    } catch (error) {
      console.error('Exception fetching user profile:', error);
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

  // Only compute the avatar URL when userProfile or cachedAvatarUrl changes
  const avatarUrl = useMemo(() => {
    // If we have a cached URL, use it
    if (cachedAvatarUrl) {
      return cachedAvatarUrl;
    }
    
    // Generate default avatar if no profile or avatar_id
    if (!userProfile?.avatar_id) {
      const initials = userProfile?.display_name?.charAt(0) || 
                      user?.email?.charAt(0)?.toUpperCase() || 
                      '?';
      const color = '6B8EF2'; // Brand blue color in hex (without #)
      return `https://ui-avatars.com/api/?name=${initials}&background=${color}&color=fff&size=256&bold=true`;
    }
    
    // Generate URL from Supabase storage with cache busting
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(userProfile.avatar_id);
      
    // Add cache busting and save to cached state
    const url = `${publicUrl}?t=${new Date().getTime()}`;
    // Update the cache in the next tick to avoid render issues
    setTimeout(() => setCachedAvatarUrl(url), 0);
    return url;
  }, [userProfile, cachedAvatarUrl, user]);

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

  const pickImage = async () => {
    try {
      // Request permission
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

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
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
    if (!user) return;
    
    try {
      setUploading(true);
      
      // Generate a completely unique filename to avoid any caching issues
      const fileExt = imageAsset.uri.split('.').pop();
      const timestamp = Date.now();
      const filePath = `${user.id}_${timestamp}.${fileExt}`;
      
      console.log('Image selected:', {
        uri: imageAsset.uri,
        width: imageAsset.width,
        height: imageAsset.height,
        type: imageAsset.type,
        fileSize: imageAsset.fileSize,
      });
      
      // Convert base64 to ArrayBuffer
      const base64Data = imageAsset.base64;
      if (!base64Data) throw new Error('No base64 data found');
      
      // Check the first few characters of base64 to confirm it's an image
      console.log('Base64 data prefix:', base64Data.substring(0, 30) + '...');
      
      const arrayBuffer = decode(base64Data);
      console.log('ArrayBuffer created with byte length:', arrayBuffer.byteLength);
      
      console.log('Creating new file at path:', filePath);
      
      // Always use upload with a unique path to avoid any caching or replacement issues
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, arrayBuffer, {
          contentType: `image/${fileExt}`,
          cacheControl: 'no-cache, no-store, must-revalidate'
        });
      
      if (uploadError) {
        console.error('Upload error details:', uploadError);
        throw uploadError;
      }
      
      console.log('Upload success:', uploadData);
      
      // Get public URL with cache busting
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);
      
      // Add strong cache busting
      const cacheBustedUrl = `${publicUrl}?t=${timestamp}&nocache=${Math.random()}`;
      console.log('New avatar URL with cache busting:', cacheBustedUrl);
      
      // Update cached avatar immediately to prevent flickering
      setCachedAvatarUrl(cacheBustedUrl);
      
      // Update the profiles table instead of user metadata
      if (!userProfile) {
        console.error('Cannot update avatar: user profile not found');
        throw new Error('User profile not found');
      }
      
      const { data: updatedProfile, error: profileUpdateError } = await supabase
        .from('profiles')
        .update({ 
          avatar_id: filePath,  // Store the file path (not the full URL)
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .select()
        .single();
      
      if (profileUpdateError) {
        console.error('Profile update error:', profileUpdateError);
        throw profileUpdateError;
      }
      
      console.log('Profile updated with new avatar_id:', updatedProfile);
      
      // Update the local state with the updated profile
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

  // Add function to handle data clearing with confirmation
  const handleClearAllData = async () => {
    try {
      console.log('[DEBUG] Clearing workout sessions data');
      
      // Get the current user ID
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser?.user?.id) {
        throw new Error('No authenticated user found');
      }
      
      // Delete workout sessions from Supabase
      const { error } = await supabase
        .from('workout_sessions')
        .delete()
        .eq('user_id', currentUser.user.id);
        
      if (error) {
        console.error('Error deleting workout sessions from Supabase:', error);
        throw error;
      }
      
      // Also clear workout sessions from local storage/AsyncStorage
      try {
        // Import AsyncStorage directly
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        // Clear only workout sessions from AsyncStorage
        await AsyncStorage.removeItem('workout_sessions');
        console.log('[DEBUG] Successfully cleared local workout session data');
      } catch (localError) {
        console.error('Error clearing local workout sessions:', localError);
        // Continue even if local clear fails
      }
      
      // Refresh app state through DataContext
      await refreshData();
      
      // Refresh stats after deletion
      setStats({
        totalWorkouts: 0,
        hoursTrained: 0
      });
      
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
            <Box position="relative">
              <Avatar
                size="2xl"
                source={{
                  uri: avatarUrl
                }}
              />
              <IconButton
                icon={uploading ? <Spinner size="sm" color="#fff" /> : <MaterialIcons name="edit" size={20} color="#fff" />}
                position="absolute"
                bottom={0}
                right={0}
                bg="#1254a1"
                rounded="full"
                // borderWidth={1}
                // borderColor="white"
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

          {/* Add a "Developer Options" section */}
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
      
      {/* Confirmation dialog */}
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