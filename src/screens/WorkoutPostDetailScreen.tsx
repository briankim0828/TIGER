import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, VStack, HStack, Pressable, Spinner, Icon, AlertDialog, AlertDialogBackdrop, AlertDialogContent, AlertDialogHeader, AlertDialogBody, AlertDialogFooter, Button, ButtonText, useToast, Toast, ToastTitle, ToastDescription } from '@gluestack-ui/themed';
import { ScrollView as GHScrollView } from 'react-native-gesture-handler';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useWorkout } from '../contexts/WorkoutContext';
import { useUnit } from '../contexts/UnitContext';
import { formatVolumeFromKg, formatWeightFromKg, unitLabel } from '../utils/units';
import type { WorkoutPost } from '../db/queries/workoutHistory.drizzle';
import type { SessionExerciseJoin, WorkoutSetRow } from '../db/queries/workouts.drizzle';

type WorkoutPostDetailParams = {
  WorkoutPostDetail: { post: WorkoutPost };
};

type Snapshot = {
  exercises: SessionExerciseJoin[];
  setsByExercise: Record<string, WorkoutSetRow[]>;
};

const WorkoutPostDetailScreen: React.FC = () => {
  const navigation = useNavigation();
  const toast = useToast();
  const { unit } = useUnit();
  const route = useRoute<RouteProp<WorkoutPostDetailParams, 'WorkoutPostDetail'>>();
  const { post } = route.params;
  const { getSessionSnapshot, deleteWorkout } = useWorkout();

  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<Snapshot>({ exercises: [], setsByExercise: {} });
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const cancelRef = React.useRef(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await getSessionSnapshot(post.sessionId);
        if (mounted) setSnapshot(data);
      } catch {
        if (mounted) setSnapshot({ exercises: [], setsByExercise: {} });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [getSessionSnapshot, post.sessionId]);

  const dateLabel = useMemo(() => {
    const d = post.startedAt ?? post.finishedAt;
    if (!d) return '';
    try {
      return new Date(d).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: '2-digit', year: 'numeric' });
    } catch {
      return '';
    }
  }, [post.startedAt, post.finishedAt]);

  return (
    <Box flex={1} bg="#1E2028">
      <HStack alignItems="center" justifyContent="space-between" px="$4" py="$3">
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          {/* @ts-ignore */}
          <Icon as={MaterialIcons as any} name="arrow-back" color="$white" size="lg" />
        </Pressable>
        <Text color="$white" fontSize="$lg" fontWeight="$bold">Workout Detail</Text>
        <Box width={24} />
      </HStack>

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
        <VStack space="lg" px="$2" pt="$2" pb="$6">
          <Box bg="#transparent" borderRadius="$lg" p="$2">
            <VStack space="xs" mb="$3">
              <Text color="$white" fontSize="$2xl" fontWeight="$bold">{post.sessionName || 'Workout'}</Text>
              {!!dateLabel && <Text color="$gray400" fontSize="$sm">{dateLabel}</Text>}
              {!!post.note && <Text color="$gray300" fontSize="$sm">{post.note}</Text>}
            </VStack>

            <HStack space="xl" justifyContent="center" alignItems="center">
              <VStack alignItems="center">
                <Text color="$gray400" fontSize="$xs">
                  Time
                </Text>
                <Text color="$white" fontWeight="$semibold">
                  {post.durationMin ?? 0}min
                </Text>
              </VStack>

              <VStack alignItems="center">
                <Text color="$gray400" fontSize="$xs">
                  Volume
                </Text>
                <Text color="$white" fontWeight="$semibold">
                  {formatVolumeFromKg(post.totalVolumeKg, unit)} {unitLabel(unit)}
                </Text>
              </VStack>

              <VStack alignItems="center">
                <Text color="$gray400" fontSize="$xs">
                  Sets
                </Text>
                <Text color="$white" fontWeight="$semibold">
                  {(() => {
                    const n = Object.values(snapshot.setsByExercise).reduce(
                      (acc, sets) => acc + sets.length,
                      0
                    );
                    return `${n}`;
                  })()}
                </Text>
              </VStack>
            </HStack>
          </Box>

          {loading ? (
            <Box alignItems="center" py="$6">
              <Spinner size="large" color="#6B8EF2" />
            </Box>
          ) : snapshot.exercises.length === 0 ? (
            <Box bg="#12141A" borderRadius="$lg" p="$6" alignItems="center">
              {/* @ts-ignore */}
              <Icon as={MaterialIcons as any} name="event-busy" color="$gray400" size={56} />
              <Text color="$gray400" mt="$3" fontSize="$md" fontWeight="$semibold">No exercises logged</Text>
              <Text color="$gray500" fontSize="$sm" mt="$1" textAlign="center">
                This workout has no recorded sets.
              </Text>
            </Box>
          ) : (
            <VStack space="lg">
              {snapshot.exercises.map((ex) => {
                const sets = snapshot.setsByExercise[ex.sessionExerciseId] ?? [];
                const showWeight = sets.some((s) => s.weightKg !== null && s.weightKg !== undefined);
                return (
                  <Box key={ex.sessionExerciseId} bg="#12141A" borderRadius="$lg" p="$4">
                    <HStack alignItems="center" space="sm" mb="$3">
                      <Box width={36} height={36} borderRadius="$md" bg="#2A2E38" alignItems="center" justifyContent="center">
                        <Text color="$white" fontWeight="$bold" fontSize="$sm">
                          {ex.exercise.name.charAt(0).toUpperCase()}
                        </Text>
                      </Box>
                      <Text color="$white" fontSize="$lg" fontWeight="$bold">{ex.exercise.name}</Text>
                    </HStack>

                    <HStack justifyContent="space-between" mb="$2">
                      <Text color="$gray400" fontSize="$xs">SET</Text>
                      <Text color="$gray400" fontSize="$xs">{showWeight ? 'WEIGHT & REPS' : 'REPS'}</Text>
                    </HStack>

                    <VStack space="sm">
                      {sets.length === 0 ? (
                        <Text color="$gray500" fontSize="$sm">No sets logged</Text>
                      ) : (
                        sets.map((s) => {
                          const setNum = (typeof s.setOrder === 'number' ? s.setOrder : parseInt(String(s.setOrder), 10)) + 1;
                          const reps = s.reps ?? null;
                          const weight = s.weightKg ?? null;
                          const weightText = showWeight ? (weight === null || weight === undefined ? '--' : formatWeightFromKg(weight, unit, 1)) : '';
                          const right = showWeight
                            ? `${weightText} ${unitLabel(unit)} x ${reps ?? '--'}`
                            : `${reps ?? '--'}`;
                          return (
                            <HStack key={s.id} justifyContent="space-between" alignItems="center">
                              <Text color="$white" fontSize="$md" fontWeight="$semibold">{setNum}</Text>
                              <Text color="$white" fontSize="$md">{right}</Text>
                            </HStack>
                          );
                        })
                      )}
                    </VStack>
                  </Box>
                );
              })}
            </VStack>
          )}

          <Pressable
            onPress={() => setIsDeleteOpen(true)}
            alignSelf="center"
            mt="$4"
            mb="$2"
            accessibilityRole="button"
          >
            <Text color="$red500" fontSize="$md" fontWeight="$bold">Delete workout</Text>
          </Pressable>
        </VStack>
      </GHScrollView>

      <AlertDialog leastDestructiveRef={cancelRef} isOpen={isDeleteOpen} onClose={() => setIsDeleteOpen(false)}>
        <AlertDialogBackdrop />
        <AlertDialogContent bg="#12141A">
          <AlertDialogHeader>
            <Text color="$white" fontSize="$lg" fontWeight="$bold">Delete workout?</Text>
          </AlertDialogHeader>
          <AlertDialogBody>
            <Text color="$gray300" fontSize="$sm">
              This will remove the workout, its exercises, and all sets from this device and sync the deletion to your account.
            </Text>
          </AlertDialogBody>
          <AlertDialogFooter>
            <Button variant="outline" onPress={() => setIsDeleteOpen(false)} ref={cancelRef} mr="$3">
              <ButtonText color="$gray300">Cancel</ButtonText>
            </Button>
            <Button
              bg="$red600"
              isDisabled={isDeleting}
              onPress={async () => {
                try {
                  setIsDeleting(true);
                  await deleteWorkout(post.sessionId);
                  setIsDeleteOpen(false);
                  toast.show({
                    placement: 'top',
                    render: ({ id }) => (
                      <Toast nativeID={id} action="success" variant="accent">
                        <VStack space="xs">
                          <ToastTitle>Workout Deleted</ToastTitle>
                          <ToastDescription>The workout has been removed.</ToastDescription>
                        </VStack>
                      </Toast>
                    ),
                  });
                  navigation.goBack();
                } catch {
                  toast.show({
                    placement: 'top',
                    render: ({ id }) => (
                      <Toast nativeID={id} action="error" variant="accent">
                        <VStack space="xs">
                          <ToastTitle>Delete Failed</ToastTitle>
                          <ToastDescription>Could not delete the workout.</ToastDescription>
                        </VStack>
                      </Toast>
                    ),
                  });
                } finally {
                  setIsDeleting(false);
                }
              }}
            >
              <ButtonText color="$white">Delete</ButtonText>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Box>
  );
};

export default WorkoutPostDetailScreen;
