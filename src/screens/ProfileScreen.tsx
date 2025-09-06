import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Box,
  Text,
  VStack,
  HStack,
  Avatar,
  AvatarFallbackText,
  AvatarImage,
  ScrollView,
  Pressable,
  Spinner,
  Button,
  ButtonText,
  ButtonIcon,
  Icon,
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogBody,
  AlertDialogFooter,
  useToast,
  Toast,
  ToastTitle,
  ToastDescription
} from '@gluestack-ui/themed';
import { MaterialIcons } from '@expo/vector-icons';
import { User } from '@supabase/supabase-js';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
// DataContext removed – using workout history queries instead
import { useWorkoutHistory } from '../db/queries';
import {
  UserProfile,
  getCurrentUser,
  signOutUser,
  fetchUserProfileFromSupabase,
  updateUserProfileAvatar,
  getAvatarPublicUrl,
  uploadAvatar,
} from '../supabase/supabaseProfile';

type WorkoutTab = {
  id: number;
  title: string;
  icon: keyof typeof MaterialIcons.glyphMap;
};

// Define a type for the IconButton icon mapping
type IconMappingType = {
  [key: string]: React.ComponentType<any>;
};

// Define the mapping from MaterialIcons names to gluestack-ui Icon components
const iconMapping: IconMappingType = {
  // Add mappings as needed, e.g., if IconButton used specific icons
  // 'edit': EditIcon, // Assuming EditIcon is imported from '@gluestack-ui/themed'
  // 'logout': LogoutIcon, // Assuming LogoutIcon is imported
};

const ProfileScreen: React.FC = () => {
  const navigation = useNavigation();
  const toast = useToast(); // gluestack-ui toast hook
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
  const history = useWorkoutHistory();
  const USER_ID = 'local-user';

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
      toast.show({
        placement: "top",
        render: ({ id }) => {
          return (
            <Toast nativeID={id} action="error" variant="accent">
              <VStack space="xs">
                <ToastTitle>Error</ToastTitle>
                <ToastDescription>Failed to fetch user data.</ToastDescription>
              </VStack>
            </Toast>
          );
        },
      });
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
      // Error logged within fetchUserProfileFromSupabase
      // Handle UI feedback if needed
       toast.show({
        placement: "top",
        render: ({ id }) => {
          return (
            <Toast nativeID={id} action="error" variant="accent">
              <VStack space="xs">
                <ToastTitle>Error</ToastTitle>
                <ToastDescription>Failed to fetch profile.</ToastDescription>
              </VStack>
            </Toast>
          );
        },
      });
    }
  }, [user, toast]); // Added toast dependency

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
          // Defer state update slightly
          setTimeout(() => setCachedAvatarUrl(url), 0);
          return url;
      }
    }

    // Fallback logic (remains the same)
    const initials = userProfile?.display_name?.charAt(0) ||
                    user?.email?.charAt(0)?.toUpperCase() ||
                    '?';
    const color = '6B8EF2'; // Brand blue color
    return `https://ui-avatars.com/api/?name=${initials}&background=${color}&color=fff&size=256&bold=true`;

  }, [userProfile, cachedAvatarUrl, user]);

  const fetchUserStats = async () => {
    try {
      const s = await history.getWorkoutStats(user?.id ?? USER_ID);
      setStats(s);
    } catch (error) {
      console.error('Error fetching stats (local DB):', error);
    }
  };

  const handleLogout = async () => {
    try {
      const { error } = await signOutUser();
      if (error) throw error;
      // Auth state change listener in App.tsx will handle navigation
    } catch (error) {
      // Error logged within signOutUser
      toast.show({
        placement: "top",
        render: ({ id }) => {
          return (
            <Toast nativeID={id} action="error" variant="accent">
              <VStack space="xs">
                <ToastTitle>Logout Error</ToastTitle>
                <ToastDescription>Failed to log out.</ToastDescription>
              </VStack>
            </Toast>
          );
        },
      });
    }
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        toast.show({
          placement: "top",
          render: ({ id }) => {
            return (
              <Toast nativeID={id} action="warning" variant="accent">
                <VStack space="xs">
                  <ToastTitle>Permission needed</ToastTitle>
                  <ToastDescription>Please grant permission to access your photos</ToastDescription>
                </VStack>
              </Toast>
            );
          },
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
        placement: "top",
        render: ({ id }) => {
          return (
            <Toast nativeID={id} action="error" variant="accent">
              <VStack space="xs">
                <ToastTitle>Error</ToastTitle>
                <ToastDescription>Failed to pick image. Please try again.</ToastDescription>
              </VStack>
            </Toast>
          );
        },
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

      // Update local state immediately for better UX
      setCachedAvatarUrl(publicUrl + `?t=${new Date().getTime()}`); // Append timestamp to bypass cache

      const updatedProfile = await updateUserProfileAvatar(user.id, filePath);

      if (!updatedProfile) {
        console.error('Failed to update profile after avatar upload');
        throw new Error('Failed to update profile');
      }

      setUserProfile(updatedProfile); // Update profile state

      toast.show({
        placement: "top",
        render: ({ id }) => {
          return (
            <Toast nativeID={id} action="success" variant="accent">
              <VStack space="xs">
                <ToastTitle>Success</ToastTitle>
                <ToastDescription>Profile picture updated successfully</ToastDescription>
              </VStack>
            </Toast>
          );
        },
      });
    } catch (error) {
      console.error('Error updating avatar:', error);
      toast.show({
         placement: "top",
        render: ({ id }) => {
          return (
            <Toast nativeID={id} action="error" variant="accent">
              <VStack space="xs">
                <ToastTitle>Error</ToastTitle>
                <ToastDescription>Failed to update profile picture. Please try again.</ToastDescription>
              </VStack>
            </Toast>
          );
        },
      });
    } finally {
      setUploading(false);
    }
  };


  const handleClearAllData = async () => {
    try {
      console.log('[ProfileScreen] Clearing workout history (local DB only)');
      await history.deleteAllWorkouts(user?.id ?? USER_ID);
      setStats({ totalWorkouts: 0, hoursTrained: 0 });

      setIsAlertOpen(false);
      toast.show({
        placement: "top",
        render: ({ id }) => {
          return (
            <Toast nativeID={id} action="success" variant="accent">
              <VStack space="xs">
                <ToastTitle>Workout Data Cleared</ToastTitle>
                <ToastDescription>All local workout history removed</ToastDescription>
              </VStack>
            </Toast>
          );
        },
      });

    } catch (error) {
      console.error('Error clearing workout data:', error);
      toast.show({
        placement: "top",
        render: ({ id }) => {
          return (
            <Toast nativeID={id} action="error" variant="accent">
              <VStack space="xs">
                <ToastTitle>Error</ToastTitle>
                <ToastDescription>Failed to clear workout data.</ToastDescription>
              </VStack>
            </Toast>
          );
        },
      });
      setIsAlertOpen(false); // Close alert even on error
    }
  };

  if (loading) {
    return (
      <Box flex={1} justifyContent="center" alignItems="center" bg="#232530">
        <Spinner size="large" color="#6B8EF2" />
      </Box>
    );
  }

  const displayName = userProfile?.display_name || user?.email?.split('@')[0] || 'User';
  const fallbackName = userProfile?.display_name || user?.email || 'User';


  return (
    <ScrollView bg="#1E2028" flex={1}>
      <VStack space="xl" alignItems="center" pt={8} pb={4}>
        <Pressable onPress={pickImage}>
          <Avatar size="xl" bg="$primary500">
             {/* Add key to force re-render on URL change */}
            <AvatarImage source={{ uri: avatarUrl }} alt="User Avatar" key={avatarUrl} />
            <AvatarFallbackText>{fallbackName}</AvatarFallbackText>
            {(uploading) && (
                <Box
                    position="absolute"
                    top={0} left={0} right={0} bottom={0}
                    justifyContent="center"
                    alignItems="center"
                    bg="rgba(0,0,0,0.5)"
                    borderRadius="$full"
                >
                    <Spinner size="small" color="white" />
                </Box>
            )}
          </Avatar>
        </Pressable>
        <Text color="white" fontSize="$2xl" fontWeight="bold">
          {displayName}
        </Text>
      </VStack>

      {/* Workout Stats Section */}
      <HStack bg="#2A2E38" px={4} py={4} justifyContent="space-around" alignItems="center" mx={4} borderRadius="lg">
        <VStack alignItems="center">
          <Text color="white" fontSize="$xl" fontWeight="bold">{stats.totalWorkouts}</Text>
          <Text color="gray.400" fontSize="$sm">Total Workouts</Text>
        </VStack>
        <VStack alignItems="center">
          <Text color="white" fontSize="$xl" fontWeight="bold">{stats.hoursTrained}</Text>
          <Text color="gray.400" fontSize="$sm">Hours Trained</Text>
        </VStack>
        {/* Add more stats if needed */}
      </HStack>

      {/* Workout Tabs Section - Example Grid Layout */}
      <Box px={4} mt={6}>
        <Text color="white" fontSize="$lg" fontWeight="bold" mb={3}>My Activity</Text>
        <HStack flexWrap="wrap" justifyContent="space-between">
          {workoutTabs.map((tab) => (
            <Pressable
              key={tab.id}
              bg="#2A2E38"
              p={4}
              borderRadius="lg"
              alignItems="center"
              justifyContent="center"
              width="48%" // Adjust for desired spacing
              mb={3}
              $pressed={{ opacity: 0.7 }}
              // Add onPress handler if needed
            >
              <Icon as={MaterialIcons} color="#6B8EF2" mb={2}>
                {tab.icon}
              </Icon>
              <Text color="white" fontSize="$sm" fontWeight="medium">{tab.title}</Text>
            </Pressable>
          ))}
        </HStack>
      </Box>

  {/* Settings & Options Section */}
      <VStack px={4} mt={4} space="md" pb={8}>
         <Text color="white" fontSize="$lg" fontWeight="bold" mb={0}>Settings</Text>
         {/* Example Setting Item */}
        <Pressable
             bg="#2A2E38"
             p={4}
             borderRadius="lg"
             $pressed={{ opacity: 0.7 }}
             // onPress={() => navigation.navigate('SomeSettingScreen')} // Example navigation
         >
             <HStack justifyContent="space-between" alignItems="center">
                 <Text color="white" fontSize="$md">Account Settings</Text>
                 <Icon as={MaterialIcons} color="gray.400">
                   chevron-right
                 </Icon>
             </HStack>
         </Pressable>

         {/* Debug: Database Inspector */}
         <Button
           variant="outline"
           action="secondary"
           size="lg"
           onPress={() => (navigation as any).navigate('DebugDatabase')}
         >
           <ButtonText>Open Debug Database</ButtonText>
         </Button>

         {/* Logout Button */}
         <Button
          variant="solid" // or "outline", "link"
          action="secondary" // "primary", "secondary", "positive", "negative"
          size="lg" // "xs", "sm", "md", "lg", "xl"
          mt={4}
          onPress={handleLogout}
          bg="$red600" // Example: Use semantic token for red
          $pressed={{ bg: "$red700" }}
        >
          <ButtonText>Logout</ButtonText>
        </Button>

         {/* Clear All Data Button */}
         <Button
           variant="outline"
           action="negative"
           size="lg"
           mt={2}
           onPress={() => setIsAlertOpen(true)}
           borderColor="$red600" // Example: Use semantic token
           $pressed={{ bg: "rgba(220, 53, 69, 0.1)" }} // Example: Red tint on press
         >
           <ButtonText color="$red600">Clear All Workout Data</ButtonText>
         </Button>
      </VStack>

       {/* Clear Data Confirmation Alert Dialog */}
       <AlertDialog
        isOpen={isAlertOpen}
        leastDestructiveRef={cancelRef}
        onClose={() => setIsAlertOpen(false)}
      >
        <AlertDialogBackdrop />
        <AlertDialogContent>
          <AlertDialogHeader>
            <Text fontWeight="$bold">Clear Workout Data</Text>
            {/* Close Button can be added here if needed using AlertDialogCloseButton */}
          </AlertDialogHeader>
          <AlertDialogBody>
            <Text size="sm">
              Are you sure you want to clear all workout data? This action cannot be undone.
            </Text>
          </AlertDialogBody>
          <AlertDialogFooter>
             <HStack space="sm" width="100%" justifyContent="flex-end">
              <Button
                variant="outline"
                action="secondary"
                onPress={() => setIsAlertOpen(false)}
                ref={cancelRef}
              >
                <ButtonText>Cancel</ButtonText>
              </Button>
              <Button
                bg="$red600"
                action="negative"
                onPress={handleClearAllData}
              >
                <ButtonText>Clear Data</ButtonText>
              </Button>
            </HStack>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ScrollView>
  );
};

export default ProfileScreen; 