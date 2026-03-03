import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { View, Keyboard, TouchableWithoutFeedback, Modal, Platform, ScrollView } from 'react-native';
import { Box, Text, HStack, VStack, Pressable, useToast, Toast, ToastTitle, ToastDescription, Divider, Textarea, TextareaInput } from '@gluestack-ui/themed';
import { TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useOverlay } from '../contexts/OverlayContext';
import { useWorkout } from '../contexts/WorkoutContext';
import { useUnit } from '../contexts/UnitContext';
import { lbToKg, unitLabel } from '../utils/units';

type RenderSet = { id: string; weightKg: number; reps: number; isCompleted: boolean };
type RenderExercise = { id: string; name: string; sets: RenderSet[] };

interface SaveSessionScreenProps {
  sessionId: string;
  splitTitle: string;
  sessionStartedAtMs: number | null;
  isBackdated: boolean;
  currentExercises: RenderExercise[];
  onBack: () => void; // navigate back to active screen
  onCloseSheet: () => void; // close the bottom sheet after action
  onSaveOverride?: () => Promise<void>; // optional custom save handler
  elapsedSecAtFinish?: number | null; // snapshot of elapsed seconds captured when user pressed Finish
  onSessionNameChange?: (name: string) => void; // bubble up session name edits
}

const SaveSessionScreen: React.FC<SaveSessionScreenProps> = ({
  sessionId,
  splitTitle,
  sessionStartedAtMs,
  isBackdated,
  currentExercises,
  onBack,
  onCloseSheet,
  onSaveOverride,
  elapsedSecAtFinish,
  onSessionNameChange,
}) => {
  const toast = useToast();
  const { endWorkout, deleteWorkout, setSessionNote, updateSet, deleteSet } = useWorkout();
  const { showWorkoutSummary } = useOverlay();
  const { unit } = useUnit();
  const [note, setNote] = useState<string>('');
  const [sessionName, setSessionName] = useState<string>(splitTitle || '');
  const [isSessionNameDirty, setIsSessionNameDirty] = useState<boolean>(false);
  // Backdated editables
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showDurationPicker, setShowDurationPicker] = useState(false);
  const [customStart, setCustomStart] = useState<Date | null>(null);
  const [customDurationMin, setCustomDurationMin] = useState<number>(60);
  const [showIncompleteConfirm, setShowIncompleteConfirm] = useState(false);
  const [isResolvingIncompleteSets, setIsResolvingIncompleteSets] = useState(false);

  // Reset when switching to a different session and sync name upward once
  useEffect(() => {
    setNote('');
    const initial = splitTitle || '';
    setSessionName(initial);
    setIsSessionNameDirty(false);
    if (onSessionNameChange) onSessionNameChange(initial);
    // Reset customDurationMin when session changes
    setCustomDurationMin(60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Keep local name in sync with upstream title updates (which may arrive async)
  // unless the user already started typing a custom name on this screen.
  useEffect(() => {
    if (isSessionNameDirty) return;
    const next = splitTitle || '';
    setSessionName(next);
    if (onSessionNameChange) onSessionNameChange(next);
  }, [splitTitle, isSessionNameDirty, onSessionNameChange]);

  // Initialize customStart whenever sessionStartedAtMs becomes available
  useEffect(() => {
    if (sessionStartedAtMs) {
      setCustomStart(new Date(sessionStartedAtMs));
    } else {
      setCustomStart(null);
    }
  }, [sessionStartedAtMs]);

  const metrics = useMemo(() => {
    const sets = currentExercises.flatMap((e) => e.sets || []);
    const setCount = sets.length;
    // Storage convention: weights are stored in pounds.
    // Keep session volume metric in kilograms for backward compatibility.
    const volumeKg = sets.reduce((sum, s) => {
      const kg = lbToKg(Number(s.weightKg || 0));
      const reps = Number(s.reps || 0);
      return sum + (kg * reps);
    }, 0);
    return { setCount, volumeKg };
  }, [currentExercises]);

  const incompleteSets = useMemo(() => {
    return currentExercises
      .flatMap((exercise) =>
        (exercise.sets || []).map((set) => ({
          exerciseId: exercise.id,
          set,
        }))
      )
      .filter((row) => !row.set.isCompleted);
  }, [currentExercises]);

  const canMarkIncompleteAsComplete = useMemo(() => {
    if (incompleteSets.length === 0) return true;
    return incompleteSets.every(({ set }) => {
      const weight = Number(set.weightKg ?? 0);
      const reps = Number(set.reps ?? 0);
      return Number.isFinite(weight) && Number.isFinite(reps) && weight > 0 && reps > 0;
    });
  }, [incompleteSets]);

  const buildProjectedExercises = useCallback((mode: 'normal' | 'deleteIncomplete') => {
    if (mode === 'normal') return currentExercises;
    return currentExercises.map((exercise) => ({
      ...exercise,
      sets: (exercise.sets || []).filter((set) => set.isCompleted),
    }));
  }, [currentExercises]);

  const computeMetricsFromExercises = useCallback((exercises: RenderExercise[]) => {
    const sets = exercises.flatMap((e) => e.sets || []);
    const setCount = sets.length;
    const volumeKg = sets.reduce((sum, s) => {
      const kg = lbToKg(Number(s.weightKg || 0));
      const reps = Number(s.reps || 0);
      return sum + (kg * reps);
    }, 0);
    return { setCount, volumeKg };
  }, []);

  const durationText = useMemo(() => {
    if (!sessionStartedAtMs) return '—';
    if (isBackdated) return `${customDurationMin}min`;
    // Prefer the snapshot captured at the moment Finish was pressed
    const secs = Math.max(0, Math.floor((elapsedSecAtFinish ?? 0)) || Math.floor((Date.now() - sessionStartedAtMs) / 1000));
    const mins = Math.max(0, Math.round(secs / 60));
    return `${mins}min`;
  }, [sessionStartedAtMs, elapsedSecAtFinish, isBackdated, customDurationMin]);

  const dateText = useMemo(() => {
    if (!sessionStartedAtMs) return '';
    try {
      const d = isBackdated && customStart ? customStart : new Date(sessionStartedAtMs);
      // Example: 1 Oct 2025, 10:47 PM
      return d.toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  }, [sessionStartedAtMs, isBackdated, customStart]);

  const volumeText = useMemo(() => {
    const volumeKg = metrics.volumeKg || 0;
    const display = unit === 'lb' ? (volumeKg * 2.2046226218) : volumeKg;
    // Show one decimal like the screenshot
    return `${display.toLocaleString(undefined, { maximumFractionDigits: 1, minimumFractionDigits: 1 })} ${unitLabel(unit)}`;
  }, [metrics.volumeKg, unit]);

  const finalizeSave = useCallback(async (mode: 'normal' | 'deleteIncomplete') => {
    try {
      const projectedExercises = buildProjectedExercises(mode);
      const projectedMetrics = computeMetricsFromExercises(projectedExercises);
      const setCount = projectedMetrics.setCount;
      const totalVolumeKg = Math.round((projectedMetrics.volumeKg ?? 0));
      // Compute overrides and duration consistently for both save paths
      let durationMin: number | undefined = undefined;
      let startedAtOverride: string | undefined;
      let finishedAtOverride: string | undefined;
      if (isBackdated) {
        // For backdated saves, rely on the user's selected time and duration.
        const base = customStart ? new Date(customStart) : (sessionStartedAtMs ? new Date(sessionStartedAtMs) : new Date());
        startedAtOverride = base.toISOString();
        durationMin = customDurationMin;
        const end = new Date(base.getTime() + (customDurationMin * 60000));
        finishedAtOverride = end.toISOString();
      } else if (sessionStartedAtMs) {
        const secs = Math.max(0, Math.floor((elapsedSecAtFinish ?? 0)) || Math.floor((Date.now() - sessionStartedAtMs) / 1000));
        durationMin = Math.max(0, Math.round(secs / 60));
      }
      const nameToSave = (sessionName ?? '').trim();
      if (typeof onSaveOverride === 'function') {
        if (note?.trim()) {
          await setSessionNote(sessionId, note.trim());
        }
        await endWorkout(sessionId, {
          status: 'completed',
          ...(startedAtOverride ? { startedAtOverride } : {}),
          ...(finishedAtOverride ? { finishedAtOverride } : {}),
          ...(typeof durationMin === 'number' ? { durationMin } : {}),
          totalVolumeKg,
          totalSets: setCount,
          note: note?.trim() ? note.trim() : undefined,
          ...(nameToSave ? { sessionName: nameToSave } : {}),
        });
        await onSaveOverride();
      } else {
        await endWorkout(sessionId, {
          status: 'completed',
          ...(startedAtOverride ? { startedAtOverride } : {}),
          ...(finishedAtOverride ? { finishedAtOverride } : {}),
          note: note?.trim() ? note.trim() : undefined,
          totalVolumeKg,
          totalSets: setCount,
          ...(typeof durationMin === 'number' ? { durationMin } : {}),
          ...(nameToSave ? { sessionName: nameToSave } : {}),
        });
      }
      // Show workout summary overlay before closing
      try {
        const summaryExercises = projectedExercises.map(e => ({ name: e.name, setCount: e.sets?.length ?? 0 }));
        showWorkoutSummary({
          sessionName: nameToSave || splitTitle || 'Workout',
          note: note?.trim() || null,
          durationMin: typeof durationMin === 'number' ? durationMin : null,
          totalVolumeKg,
          startedAtMs: isBackdated ? (customStart ? customStart.getTime() : sessionStartedAtMs) : sessionStartedAtMs,
          startedAtISO: (isBackdated ? (customStart ? customStart.toISOString() : (sessionStartedAtMs ? new Date(sessionStartedAtMs).toISOString() : null)) : (sessionStartedAtMs ? new Date(sessionStartedAtMs).toISOString() : null)) as any,
          exercises: summaryExercises,
        });
      } catch {}
      onCloseSheet();
      // toast.show({
      //   placement: 'top',
      //   render: ({ id }) => (
      //     <Toast nativeID={id} action="success" variant="accent">
      //       <VStack space="xs">
      //         <ToastTitle>Workout Saved</ToastTitle>
      //         <ToastDescription>Your workout session has been saved successfully.</ToastDescription>
      //       </VStack>
      //     </Toast>
      //   ),
      // });
    } catch (e) {
      toast.show({
        placement: 'top',
        render: ({ id }) => (
          <Toast nativeID={id} action="error" variant="accent">
            <VStack space="xs">
              <ToastTitle>Save Error</ToastTitle>
              <ToastDescription>Please try again.</ToastDescription>
            </VStack>
          </Toast>
        ),
      });
    }
  }, [buildProjectedExercises, computeMetricsFromExercises, sessionStartedAtMs, isBackdated, customStart, customDurationMin, elapsedSecAtFinish, sessionName, onSaveOverride, note, setSessionNote, endWorkout, sessionId, onCloseSheet, toast, showWorkoutSummary, splitTitle]);

  const handleSave = useCallback(async () => {
    if (incompleteSets.length > 0) {
      setShowIncompleteConfirm(true);
      return;
    }
    await finalizeSave('normal');
  }, [incompleteSets.length, finalizeSave]);

  const handleDeleteIncompleteAndSave = useCallback(async () => {
    setIsResolvingIncompleteSets(true);
    try {
      for (const row of incompleteSets) {
        await deleteSet(row.set.id);
      }
      setShowIncompleteConfirm(false);
      await finalizeSave('deleteIncomplete');
    } catch (e) {
      toast.show({
        placement: 'top',
        render: ({ id }) => (
          <Toast nativeID={id} action="error" variant="accent">
            <VStack space="xs">
              <ToastTitle>Unable to delete incomplete sets</ToastTitle>
              <ToastDescription>Please try again.</ToastDescription>
            </VStack>
          </Toast>
        ),
      });
    } finally {
      setIsResolvingIncompleteSets(false);
    }
  }, [incompleteSets, deleteSet, finalizeSave, toast]);

  const handleMarkCompleteAndSave = useCallback(async () => {
    if (!canMarkIncompleteAsComplete) return;
    setIsResolvingIncompleteSets(true);
    try {
      for (const row of incompleteSets) {
        await updateSet(row.set.id, { isCompleted: true } as any);
      }
      setShowIncompleteConfirm(false);
      await finalizeSave('normal');
    } catch (e) {
      toast.show({
        placement: 'top',
        render: ({ id }) => (
          <Toast nativeID={id} action="error" variant="accent">
            <VStack space="xs">
              <ToastTitle>Unable to complete remaining sets</ToastTitle>
              <ToastDescription>Please try again.</ToastDescription>
            </VStack>
          </Toast>
        ),
      });
    } finally {
      setIsResolvingIncompleteSets(false);
    }
  }, [canMarkIncompleteAsComplete, incompleteSets, updateSet, finalizeSave, toast]);

  const handleDiscard = useCallback(async () => {
    try {
      await deleteWorkout(sessionId);
      onCloseSheet();
      toast.show({
        placement: 'top',
        render: ({ id }) => (
          <Toast nativeID={id} action="info" variant="accent">
            <VStack space="xs">
              <ToastTitle>Workout Discarded</ToastTitle>
            </VStack>
          </Toast>
        ),
      });
    } catch (e) {
      toast.show({
        placement: 'top',
        render: ({ id }) => (
          <Toast nativeID={id} action="error" variant="accent">
            <VStack space="xs">
              <ToastTitle>Discard Failed</ToastTitle>
              <ToastDescription>Please try again.</ToastDescription>
            </VStack>
          </Toast>
        ),
      });
    }
  }, [deleteWorkout, sessionId, onCloseSheet, toast]);

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <Box flex={1} width="100%" backgroundColor="#2A2E38">
      {/* Top bar */}
      <Box bg="#2A2E38" px="$3" py="$3" width="100%" borderBottomWidth={0} borderColor="#3A3F4B">
        <HStack alignItems="center" justifyContent="space-between">
          <Pressable onPress={onBack} aria-label="Back">
            <HStack alignItems="center" space="xxs">
              <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
              <Text color="$textLight50">Back</Text>
            </HStack>
          </Pressable>
          <Text color="$textLight50" fontWeight="$bold" fontSize="$md">Save Workout</Text>
          <Pressable onPress={handleSave} bg="#22c55e" px="$3" py="$2" borderRadius="$md">
            <Text color="$textLight50" fontWeight="$bold" fontSize="$sm">Save</Text>
          </Pressable>
        </HStack>
      </Box>

      

      {/* Content */}
      <Box flex={1} px="$3" py="$4">
        <VStack space="xl">

          {/* Split/Workout name (editable) - no box/inset, keep original layout */}
          <TextInput
            value={sessionName}
            onChangeText={(t) => {
              setSessionName(t);
              setIsSessionNameDirty(true);
              if (onSessionNameChange) onSessionNameChange(t);
            }}
            placeholder={splitTitle || 'Workout'}
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={2}
            underlineColorAndroid="transparent"
            accessibilityLabel="Session name"
            style={{
              color: '#ffffff',
              fontSize: 20, // approximates $xl
              fontWeight: '600', // semibold
              padding: 0,
              margin: 0,
              backgroundColor: 'transparent',
            }}
          />

          {/* Metrics row */}
          <HStack justifyContent="space-between" space="sm">
            <VStack>
              <Text color="$textLight400" fontSize="$sm">Duration</Text>
              <Pressable onPress={() => { if (isBackdated) setShowDurationPicker(true); }}>
                <Text color="#3B82F6" fontWeight="$semibold" fontSize="$md">{durationText}</Text>
              </Pressable>
            </VStack>
            <VStack>
              <Text color="$textLight400" fontSize="$sm">Volume</Text>
              <Text color="$textLight50" fontWeight="$semibold" fontSize="$md">{volumeText}</Text>
            </VStack>
            <VStack>
              <Text color="$textLight400" fontSize="$sm">Sets</Text>
              <Text color="$textLight50" fontWeight="$semibold" fontSize="$md">{metrics.setCount}</Text>
            </VStack>
          </HStack>

          <Divider bg="#3A3F4B" />

          {/* Date */}
          <VStack>
            <Text color="$textLight400" fontSize="$sm">When</Text>
            <Pressable onPress={() => { if (isBackdated) setShowTimePicker(true); }}>
              <Text color="#3B82F6" fontWeight="$semibold" fontSize="$md">{dateText}</Text>
            </Pressable>
          </VStack>

          <Divider bg="#3A3F4B" />

          {/* Description */}
          <VStack space="sm">
            <Text color="$textLight400" fontSize="$sm">Note</Text>
            <Textarea
              bg="transparent"
              borderColor="#3A3F4B"
              borderWidth={0}
              borderRadius="$md"
              minHeight={110}
              p="$0"
              px="$0"
              py="$0"
              style={{ padding: 0 }}
              $focus={{ borderColor: '#3B82F6' }}
            >
              <TextareaInput
                placeholder="How did your workout go? Leave some notes here..."
                color="$textLight50"
                value={note}
                onChangeText={setNote}
                multiline
                textAlignVertical="top"
                numberOfLines={5}
                p="$0"
                px="$0"
                py="$0"
                style={{ padding: 0 }}
              />
            </Textarea>
          </VStack>
        </VStack>

        {/* Discard button */}
        <Box flexGrow={1} />
        <Pressable onPress={handleDiscard} alignItems="center" py="$2" pb="$8">
          <Text color="$red400" fontWeight="$bold">Discard Workout</Text>
        </Pressable>
      </Box>
      {/* Duration Picker Modal (10..360 minutes) */}
      <Modal transparent visible={showDurationPicker} animationType="fade" onRequestClose={() => setShowDurationPicker(false)}>
        <Box flex={1} bg="rgba(0,0,0,0.6)" justifyContent="center" alignItems="center" px="$4">
          <Box bg="#12141A" borderRadius="$xl" p="$4" width="$5/6">
            <Text color="$textLight50" fontWeight="$bold" fontSize="$md" mb="$2" textAlign="center">Select Duration</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              <VStack>
                {Array.from({ length: 36 }, (_, i) => (i + 1) * 10).map((m) => (
                  <Pressable key={m} onPress={() => setCustomDurationMin(m)} py="$2" alignItems="center">
                    <Text alignItems="center" color={customDurationMin === m ? '#3B82F6' : '$textLight50'} fontWeight={customDurationMin === m ? '$bold' : '$normal'}>
                      {m} minutes
                    </Text>
                  </Pressable>
                ))}
              </VStack>
            </ScrollView>
            <HStack justifyContent="center" mt="$3" space="md">
              <Pressable onPress={() => setShowDurationPicker(false)} alignContent="center">
                <Text color="#3B82F6" fontWeight="$bold" textAlign="center">Done</Text>
              </Pressable>
            </HStack>
          </Box>
        </Box>
      </Modal>

      {/* Time Picker for backdated start time (custom list, one time per row) */}
      <Modal transparent visible={showTimePicker} animationType="fade" onRequestClose={() => setShowTimePicker(false)}>
        <Box flex={1} bg="rgba(0,0,0,0.6)" justifyContent="center" alignItems="center" px="$4">
          <Box bg="#12141A" borderRadius="$xl" p="$4" width="$full">
            <Text color="$textLight50" fontWeight="$bold" fontSize="$md" mb="$2" textAlign="center">Select Time</Text>
            <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ alignItems: 'center' }}>
              <VStack w="$full" alignItems="center">
                {(() => {
                  const times: Array<{ h: number; m: number; date: Date; label: string }> = [];
                  const baseDate = customStart ? new Date(customStart) : (sessionStartedAtMs ? new Date(sessionStartedAtMs) : new Date());
                  // Ensure we only change time, keep date fixed
                  for (let h = 0; h < 24; h += 1) {
                    for (const min of [0, 15, 30, 45]) {
                      const d = new Date(baseDate);
                      d.setHours(h, min, 0, 0);
                      const label = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
                      times.push({ h, m: min, date: d, label });
                    }
                  }
                  return times.map((t) => {
                    const isSelected = !!customStart && customStart.getHours() === t.h && customStart.getMinutes() === t.m;
                    return (
                      <Pressable key={`${t.h}-${t.m}`} onPress={() => setCustomStart(t.date)} py="$2" w="$full" alignItems="center">
                        <Text color={isSelected ? '#3B82F6' : '$textLight50'} fontWeight={isSelected ? '$bold' : '$normal'} fontSize="$md" textAlign="center">
                          {t.label}
                        </Text>
                      </Pressable>
                    );
                  });
                })()}
              </VStack>
            </ScrollView>
            <HStack justifyContent="center" mt="$3" space="md">
              <Pressable onPress={() => setShowTimePicker(false)}>
                <Text color="#3B82F6" fontWeight="$bold">Done</Text>
              </Pressable>
            </HStack>
          </Box>
        </Box>
      </Modal>

      <Modal
        transparent
        visible={showIncompleteConfirm}
        animationType="fade"
        onRequestClose={() => {
          if (!isResolvingIncompleteSets) setShowIncompleteConfirm(false);
        }}
      >
        <Box flex={1} bg="rgba(0,0,0,0.6)" justifyContent="center" alignItems="center" px="$5">
          <Box bg="#171b25" borderRadius="$xl" p="$4" width="$full" >
            <VStack space="sm">
              <Text color="$textLight50" fontWeight="$bold" fontSize="$md">Incomplete Sets Found</Text>
              <Text color="$textLight300" fontSize="$sm">
                {incompleteSets.length} set{incompleteSets.length === 1 ? '' : 's'} are not completed. Choose how to save this workout.
              </Text>
            </VStack>

            <VStack space="sm" mt="$4">
              <Pressable
                onPress={handleDeleteIncompleteAndSave}
                disabled={isResolvingIncompleteSets}
                bg="#ef4444"
                borderRadius="$md"
                py="$2"
                alignItems="center"
                style={{ opacity: isResolvingIncompleteSets ? 0.7 : 1 }}
              >
                <Text color="$textLight50" fontWeight="$bold">Delete incomplete sets</Text>
              </Pressable>

              <Pressable
                onPress={handleMarkCompleteAndSave}
                disabled={isResolvingIncompleteSets || !canMarkIncompleteAsComplete}
                bg={canMarkIncompleteAsComplete ? '#22c55e' : '#22c55ebd'}
                borderRadius="$md"
                py="$2"
                alignItems="center"
                style={{ opacity: isResolvingIncompleteSets ? 0.7 : canMarkIncompleteAsComplete ? 1 : 0.7 }}
              >
                <Text color="$textLight50" fontWeight="$bold">
                  {canMarkIncompleteAsComplete ? 'Mark sets as complete' : 'Set values missing'}
                </Text>
              </Pressable>
            </VStack>

            <Pressable
              onPress={() => setShowIncompleteConfirm(false)}
              disabled={isResolvingIncompleteSets}
              alignItems="center"
              mt="$4"
              py="$1"
              style={{ opacity: isResolvingIncompleteSets ? 0.6 : 1 }}
            >
              <Text color="#3B82F6" fontWeight="$semibold">Cancel</Text>
            </Pressable>
          </Box>
        </Box>
      </Modal>
      {/* Close outer container Box */}
      </Box>
    </TouchableWithoutFeedback>
  );
};

export default SaveSessionScreen;
