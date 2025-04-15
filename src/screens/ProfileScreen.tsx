import React, { useEffect, useState } from 'react';
import { Box, Text, VStack, HStack, Avatar, ScrollView, Pressable, Spinner, Button, IconButton, useToast } from 'native-base';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../utils/supabaseClient';
import { User } from '@supabase/supabase-js';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';

type WorkoutTab = {
  id: number;
  title: string;
  icon: keyof typeof MaterialIcons.glyphMap;
};

const ProfileScreen: React.FC = () => {
  const navigation = useNavigation();
  const toast = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
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
      
      // Update user metadata with cache busting
      const { data: userData, error: userUpdateError } = await supabase.auth.updateUser({
        data: { 
          avatar_url: cacheBustedUrl,
          last_avatar_update: timestamp
        }
      });
      
      if (userUpdateError) throw userUpdateError;
      console.log('User metadata updated:', userData);
      
      // Refresh user data
      await fetchUserData();
      
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
                  uri: user?.user_metadata?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1000&q=80',
                }}
              />
              <IconButton
                icon={uploading ? <Spinner size="sm" color="#fff" /> : <MaterialIcons name="edit" size={20} color="#fff" />}
                position="absolute"
                bottom={0}
                right={0}
                bg="#6B8EF2"
                rounded="full"
                size="sm"
                onPress={pickImage}
                isDisabled={uploading}
                _pressed={{ bg: "#5A7CD9" }}
              />
            </Box>
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