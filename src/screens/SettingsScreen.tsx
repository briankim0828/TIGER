import React from 'react';
import {
  Box,
  Text,
  VStack,
  HStack,
  Button,
  ButtonText,
  Icon,
  Pressable,
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogBody,
  AlertDialogFooter,
  useToast,
  Toast,
  ToastTitle,
  ToastDescription,
} from '@gluestack-ui/themed';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useOverlay } from '../contexts/OverlayContext';
import { useUnit } from '../contexts/UnitContext';
import { useWorkoutHistory } from '../db/queries';
import { signOutUser, getCurrentUser } from '../supabase/supabaseProfile';

const SettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const toast = useToast();
  const { liveDebugEnabled, setLiveDebugEnabled } = useOverlay();
  const { unit, setUnit } = useUnit();
  const history = useWorkoutHistory();
  const [isAlertOpen, setIsAlertOpen] = React.useState(false);
  const cancelRef = React.useRef(null);

  const handleLogout = async () => {
    try {
      const { error } = await signOutUser();
      if (error) throw error;
      // Auth state change in App will navigate to login
    } catch (error) {
      toast.show({
        placement: 'top',
        render: ({ id }) => (
          <Toast nativeID={id} action="error" variant="accent">
            <VStack space="xs">
              <ToastTitle>Logout Error</ToastTitle>
              <ToastDescription>Failed to log out.</ToastDescription>
            </VStack>
          </Toast>
        ),
      });
    }
  };

  const handleClearAllData = async () => {
    try {
      const current = await getCurrentUser();
      const userId = current?.id;
      if (!userId) throw new Error('Not authenticated');

      if ((history as any).deleteAllWorkoutsSyncAware) {
        await (history as any).deleteAllWorkoutsSyncAware(userId);
      } else {
        await history.deleteAllWorkouts(userId);
      }

      setIsAlertOpen(false);
      toast.show({
        placement: 'top',
        render: ({ id }) => (
          <Toast nativeID={id} action="success" variant="accent">
            <VStack space="xs">
              <ToastTitle>Workout Data Cleared</ToastTitle>
              <ToastDescription>All workout history removed</ToastDescription>
            </VStack>
          </Toast>
        ),
      });
    } catch (error) {
      toast.show({
        placement: 'top',
        render: ({ id }) => (
          <Toast nativeID={id} action="error" variant="accent">
            <VStack space="xs">
              <ToastTitle>Error</ToastTitle>
              <ToastDescription>Failed to clear workout data.</ToastDescription>
            </VStack>
          </Toast>
        ),
      });
      setIsAlertOpen(false);
    }
  };

  return (
    <SafeAreaView
      edges={['left', 'right', 'bottom']}
      style={{ flex: 1, backgroundColor: '#1E2028' }}
    >
      <Box flex={1} bg="#1E2028" p="$3">
        {/* Top bar with back arrow and title */}
        <HStack alignItems="center" mb="$4" h={28}>
          <Pressable
            accessibilityRole="button"
            onPress={() => (navigation as any).goBack()}
            hitSlop={8}
            style={({ pressed }) => ({ width: 44, height: '100%', justifyContent: 'center', alignItems: 'flex-start', opacity: pressed ? 0.6 : 1 })}
          >
            {/* @ts-ignore */}
            <Icon as={Feather as any} name="arrow-left" color="$white" />
          </Pressable>
          <Box flex={1} alignItems="center">
            <Text color="$textLight50" fontSize="$xl" fontWeight="$bold">Settings</Text>
          </Box>
          <Box style={{ width: 44 }} />
        </HStack>

        <VStack space="md">
          {/* Unit toggle */}
          <Box bg="#12141A" borderRadius="$lg" p="$3" borderWidth={1} borderColor="#2A2E38">
            <HStack alignItems="center" justifyContent="space-between">
              <Text color="$textLight50" fontSize="$md" fontWeight="$semibold">Unit</Text>
              <HStack space="sm">
                <Pressable
                  onPress={() => setUnit('kg')}
                  px="$3"
                  py="$2"
                  borderRadius="$md"
                  bg={unit === 'kg' ? '#1E2028' : 'transparent'}
                  borderWidth={1}
                  borderColor={unit === 'kg' ? '#6B8EF2' : '#2A2E38'}
                  $pressed={{ opacity: 0.8 }}
                  accessibilityRole="button"
                  accessibilityLabel="Set unit to kilograms"
                >
                  <Text color="$textLight50" fontWeight={unit === 'kg' ? '$bold' : '$normal'}>kg</Text>
                </Pressable>
                <Pressable
                  onPress={() => setUnit('lb')}
                  px="$3"
                  py="$2"
                  borderRadius="$md"
                  bg={unit === 'lb' ? '#1E2028' : 'transparent'}
                  borderWidth={1}
                  borderColor={unit === 'lb' ? '#6B8EF2' : '#2A2E38'}
                  $pressed={{ opacity: 0.8 }}
                  accessibilityRole="button"
                  accessibilityLabel="Set unit to pounds"
                >
                  <Text color="$textLight50" fontWeight={unit === 'lb' ? '$bold' : '$normal'}>lbs</Text>
                </Pressable>
              </HStack>
            </HStack>
          </Box>

          {__DEV__ && (
            <Button
              variant="outline"
              action="secondary"
              size="lg"
              onPress={() => setLiveDebugEnabled(!liveDebugEnabled)}
            >
              <ButtonText>{liveDebugEnabled ? 'Disable Live Debugging' : 'Enable Live Debugging'}</ButtonText>
            </Button>
          )}

          <Button
            variant="outline"
            action="secondary"
            size="lg"
            onPress={() => (navigation as any).navigate('DebugDatabase')}
          >
            <ButtonText>Open Debug Database</ButtonText>
          </Button>

          <Button
            variant="solid"
            action="secondary"
            size="lg"
            mt={4}
            onPress={handleLogout}
            bg="$red600"
            $pressed={{ bg: '$red700' }}
          >
            <ButtonText>Logout</ButtonText>
          </Button>

          <Button
            variant="outline"
            action="negative"
            size="lg"
            mt={2}
            onPress={() => setIsAlertOpen(true)}
            borderColor="$red600"
            $pressed={{ bg: 'rgba(220, 53, 69, 0.1)' }}
          >
            <ButtonText color="$red600">Clear All Workout Data</ButtonText>
          </Button>
        </VStack>
      </Box>

      {/* Confirm dialog for clearing data */}
      <AlertDialog
        isOpen={isAlertOpen}
        leastDestructiveRef={cancelRef}
        onClose={() => setIsAlertOpen(false)}
      >
        <AlertDialogBackdrop />
        <AlertDialogContent>
          <AlertDialogHeader>
            <Text fontWeight="$bold">Clear Workout Data</Text>
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
              <Button bg="$red600" action="negative" onPress={handleClearAllData}>
                <ButtonText>Clear Data</ButtonText>
              </Button>
            </HStack>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SafeAreaView>
  );
};

export default SettingsScreen;
