import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Box,
  Text,
  VStack,
  HStack,
  Avatar,
  AvatarFallbackText,
  AvatarImage,
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
import { ScrollView as GHScrollView } from 'react-native-gesture-handler';
import { MaterialIcons } from '@expo/vector-icons';
import { User } from '@supabase/supabase-js';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
// DataContext removed – using workout history queries instead
import { useWorkoutHistory } from '../db/queries';
import type { WorkoutPost } from '../db/queries/workoutHistory.drizzle';
import {
  getCurrentUser,
  signOutUser,
  getAvatarPublicUrl,
  uploadAvatar,
  updateAuthUserAvatarPath,
} from '../supabase/supabaseProfile';
import { useOverlay } from '../contexts/OverlayContext';
import { useUnit } from '../contexts/UnitContext';
import { formatVolumeFromKg, unitLabel } from '../utils/units';

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
  const { liveDebugEnabled, setLiveDebugEnabled, workoutDataVersion } = useOverlay();
  const { unit } = useUnit();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [stats, setStats] = useState({
    totalWorkouts: 0,
    hoursTrained: 0
  });
  const [cachedAvatarUrl, setCachedAvatarUrl] = useState<string | null>(null);
  const [avatarImageError, setAvatarImageError] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const cancelRef = React.useRef(null);
  const history = useWorkoutHistory();
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [posts, setPosts] = useState<WorkoutPost[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const current = await getCurrentUser();
        setAuthUserId(current?.id ?? null);
      } catch {}
    })();
  }, []);

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

  useEffect(() => {
    fetchUserData();
  }, []);

  const accountDisplayName = useMemo(() => {
    const meta: any = (user as any)?.user_metadata ?? {};
    const fromMeta = (
      meta?.display_name ??
      meta?.full_name ??
      meta?.name ??
      meta?.given_name ??
      ''
    )
      .toString()
      .trim();

    if (fromMeta) return fromMeta;
    if (user?.email) return user.email.split('@')[0];
    return 'User';
  }, [user]);

  const avatarPathFromAuth = useMemo(() => {
    const meta: any = (user as any)?.user_metadata ?? {};
    const raw = (meta?.avatar_id ?? meta?.avatar_path ?? '').toString().trim();
    return raw || null;
  }, [user]);

  const avatarUrl = useMemo(() => {
    if (cachedAvatarUrl) {
      return cachedAvatarUrl;
    }

    if (avatarPathFromAuth) {
      const url = getAvatarPublicUrl(avatarPathFromAuth);
      if (url) {
        // Defer state update slightly
        setTimeout(() => setCachedAvatarUrl(url), 0);
        return url;
      }
    }

    // Fallback logic (remains the same)
    const initials =
      accountDisplayName?.charAt(0)?.toUpperCase() ||
      user?.email?.charAt(0)?.toUpperCase() ||
      '?';
    const color = '6B8EF2'; // Brand blue color
    return `https://ui-avatars.com/api/?name=${initials}&background=${color}&color=fff&size=256&bold=true`;

  }, [cachedAvatarUrl, user, accountDisplayName, avatarPathFromAuth]);

  // Reset image error state whenever the avatar URL changes
  useEffect(() => {
    setAvatarImageError(false);
  }, [avatarUrl]);

  const fetchUserStats = useCallback(async () => {
    try {
  const s = await history.getWorkoutStats(user?.id ?? authUserId ?? '');
      setStats(s);
    } catch (error) {
      console.error('Error fetching stats (local DB):', error);
    }
  }, [history, user?.id, authUserId]);

  const refreshPosts = useCallback(async () => {
    try {
      const uid = user?.id ?? authUserId ?? '';
      if (!uid) return;
      const list = await history.getWorkoutPosts(uid, 25);
      setPosts(list);
    } catch (e) {
      console.warn('Failed to load workout posts', e);
    }
  }, [history, user?.id, authUserId]);

  useEffect(() => {
    if (user) {
      fetchUserStats();
      // refreshPosts referenced below; call after it's defined
    }
  }, [user, fetchUserStats]);

  // Refresh posts whenever Profile gains focus
  useFocusEffect(
    useCallback(() => {
      refreshPosts();
      fetchUserStats();
      return () => {};
    }, [refreshPosts, fetchUserStats, workoutDataVersion])
  );

  // Also refresh after user is available
  useEffect(() => {
    if (user) refreshPosts();
  }, [user, refreshPosts]);

  // Refresh when a workout completes (ActiveWorkoutModal disappears)
  useEffect(() => {
    refreshPosts();
    fetchUserStats();
  }, [workoutDataVersion, refreshPosts, fetchUserStats]);

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

      const { error } = await updateAuthUserAvatarPath(filePath);
      if (error) {
        console.warn('Failed to persist avatar metadata; image will still display for this session.');
      }

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
      console.log('[ProfileScreen] Clearing workout history');
      if (!user?.id) throw new Error('Not authenticated');
      // Use sync-aware clear so deletions propagate to remote via outbox
      if ((history as any).deleteAllWorkoutsSyncAware) {
        await (history as any).deleteAllWorkoutsSyncAware(user.id);
      } else {
        await history.deleteAllWorkouts(user.id);
      }
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

  const displayName = accountDisplayName;
  const fallbackName = accountDisplayName || user?.email || 'User';


  return (
    <Box flex={1} bg="#1E2028" pt={5}>
      <GHScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        nestedScrollEnabled
        showsVerticalScrollIndicator
        bounces
        contentInsetAdjustmentBehavior="automatic"
      >
      <VStack space="xl" alignItems="center" pt={8} pb={4}>
        <Box h={25} />
        <Pressable onPress={pickImage}>
          <Avatar size="xl" bg="$primary500">
             {/* Add key to force re-render on URL change */}
            <AvatarImage
              source={{ uri: avatarUrl }}
              alt="User Avatar"
              key={avatarUrl}
              // @ts-ignore gluestack AvatarImage should forward props to RN Image
              onError={() => setAvatarImageError(true)}
            />
            {avatarImageError && (
              <AvatarFallbackText>{fallbackName}</AvatarFallbackText>
            )}
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
      <HStack bg="#1E2028" px={4} py={4} justifyContent="space-around" alignItems="center" mx={4} borderRadius="lg" pt ={10} pb={6}>
        <VStack alignItems="center">
          <Text color="white" fontSize="$xl" fontWeight="bold">{stats.totalWorkouts}</Text>
          <Text color="gray.400" fontSize="$sm">Total Workouts</Text>
        </VStack>
        <VStack alignItems="center">
          <Text color="white" fontSize="$xl" fontWeight="bold">{stats.hoursTrained.toFixed(1)}</Text>
          <Text color="gray.400" fontSize="$sm">Hours Trained</Text>
        </VStack>
        {/* Add more stats if needed */}
      </HStack>

      {/* Workout Tabs Section - Example Grid Layout */}
      <Box px={10} mt={6}>
        <Text color="white" fontSize="$lg" fontWeight="bold" mb={3}>My Workouts</Text>
        

        {/* Workout Posts Feed */}
        <VStack space="lg" mt={8}>
          {posts.length === 0 ? (
            <Box bg="#12141A" borderRadius="$lg" p="$6" alignItems="center">
              {/* @ts-ignore */}
              <Icon as={MaterialIcons as any} name="event-busy" color="$gray400" size={56} />
              <Text color="$gray400" mt="$3" fontSize="$md" fontWeight="$semibold">No workouts logged yet</Text>
              <Text color="$gray500" fontSize="$sm" mt="$1" textAlign="center">
                Your logged workouts will appear here.
              </Text>
            </Box>
          ) : (
          posts.map((p) => {
            const dateLabel = (() => {
              const d = p.startedAt ?? p.finishedAt;
              try {
                return d ? new Date(d).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: '2-digit', year: 'numeric' }) : '';
              } catch { return ''; }
            })();
            const sessionTitle = p.sessionName || 'Workout';
            return (
              <Pressable
                key={p.sessionId}
                onPress={() => (navigation as any).navigate('WorkoutPostDetail', { post: p })}
              >
                <Box bg="#12141A" borderRadius="$lg" p="$4">
                {/* Header: avatar letter, username, date */}
                <HStack alignItems="center" justifyContent="space-between" mb="$2">
                  <HStack alignItems="center" space="sm">
                    <Box width={36} height={36} borderRadius="$full" bg="#2A2E38" alignItems="center" justifyContent="center">
                      <Text color="$white" fontWeight="$bold">
                        {(displayName?.charAt(0) || 'U').toUpperCase()}
                      </Text>
                    </Box>
                    <VStack>
                      <Text color="$white" fontWeight="$bold">{displayName}</Text>
                      <Text color="$gray400" fontSize="$xs">{dateLabel}</Text>
                    </VStack>
                  </HStack>
                </HStack>

                {/* Title + Note */}
                <VStack space="xs" mb="$3">
                  <Text color="$white" fontSize="$xl" fontWeight="$bold">{sessionTitle}</Text>
                  {!!p.note && <Text color="$gray300" fontSize="$sm">{p.note}</Text>}
                </VStack>

                {/* Duration + Volume */}
                <HStack space="xl" mb="$3">
                  <VStack>
                    <Text color="$gray400" fontSize="$xs">Time</Text>
                    <Text color="$white" fontWeight="$semibold">{p.durationMin ?? 0}min</Text>
                  </VStack>
                  <VStack>
                    <Text color="$gray400" fontSize="$xs">Volume</Text>
                    <Text color="$white" fontWeight="$semibold">{formatVolumeFromKg(p.totalVolumeKg, unit)} {unitLabel(unit)}</Text>
                  </VStack>
                </HStack>

                {/* Exercise list (compact) */}
                <VStack space="sm">
                  {p.exercises.map((ex) => (
                    <HStack key={ex.sessionExerciseId} alignItems="center" justifyContent="space-between">
                      <HStack space="sm" alignItems="center" flex={1}>
                        <Box width={32} height={32} backgroundColor="#2A2E38" borderRadius="$md" alignItems="center" justifyContent="center">
                          <Text color="$white" fontWeight="$bold" fontSize="$sm">
                            {ex.name.charAt(0).toUpperCase()}
                          </Text>
                        </Box>
                        <VStack flex={1}>
                          <Text color="$white" fontSize="$md" numberOfLines={1}>{ex.name}</Text>
                        </VStack>
                      </HStack>
                      <Text color="$gray400" fontSize="$sm">{ex.setCount} {ex.setCount === 1 ? 'set' : 'sets'}</Text>
                    </HStack>
                  ))}
                </VStack>
                </Box>
              </Pressable>
            );
          })
          )}
        </VStack>
      </Box>

  {/* Settings moved to SettingsScreen */}
      </GHScrollView>
    </Box>
  );
};

export default ProfileScreen;