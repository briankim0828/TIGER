import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { View, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { Box, Text, HStack, VStack, Pressable, useToast, Toast, ToastTitle, ToastDescription, Divider, Textarea, TextareaInput } from '@gluestack-ui/themed';
import { Ionicons } from '@expo/vector-icons';
import { useWorkout } from '../contexts/WorkoutContext';

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
}) => {
  const toast = useToast();
  const { endWorkout, deleteWorkout, setSessionNote } = useWorkout();
  const [note, setNote] = useState<string>('');

  // Reset note when switching to a different session
  useEffect(() => {
    setNote('');
  }, [sessionId]);

  const metrics = useMemo(() => {
    const sets = currentExercises.flatMap((e) => e.sets || []);
    const setCount = sets.length;
    const volumeLbs = sets.reduce((sum, s) => sum + (Number(s.weightKg || 0) * Number(s.reps || 0)), 0);
    return { setCount, volumeLbs };
  }, [currentExercises]);

  const durationText = useMemo(() => {
    if (!sessionStartedAtMs) return '—';
    if (isBackdated) return '—';
    // Prefer the snapshot captured at the moment Finish was pressed
    const secs = Math.max(0, Math.floor((elapsedSecAtFinish ?? 0)) || Math.floor((Date.now() - sessionStartedAtMs) / 1000));
    const mins = Math.max(0, Math.round(secs / 60));
    return `${mins}min`;
  }, [sessionStartedAtMs, elapsedSecAtFinish, isBackdated]);

  const dateText = useMemo(() => {
    if (!sessionStartedAtMs) return '';
    try {
      const d = new Date(sessionStartedAtMs);
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
  }, [sessionStartedAtMs]);

  const volumeText = useMemo(() => {
    const n = metrics.volumeLbs || 0;
    // Show one decimal like the screenshot
    return `${n.toLocaleString(undefined, { maximumFractionDigits: 1, minimumFractionDigits: 1 })} lbs`;
  }, [metrics.volumeLbs]);

  const handleSave = useCallback(async () => {
    try {
      // compute persisted stats at the moment of Save to avoid stale values
      const setCount = metrics.setCount;
      // convert lbs -> kg (nearest integer)
      const totalVolumeKg = Math.round(((metrics.volumeLbs ?? 0) / 2.20462));
      // duration text computed in minutes; use the same source in minutes (rounded)
      let durationMin: number | undefined = undefined;
      if (sessionStartedAtMs && !isBackdated) {
        const secs = Math.max(0, Math.floor((elapsedSecAtFinish ?? 0)) || Math.floor((Date.now() - sessionStartedAtMs) / 1000));
        durationMin = Math.max(0, Math.round(secs / 60));
      }
      // If parent provided a custom handler, use it
      if (typeof onSaveOverride === 'function') {
        // Ensure note is persisted even when custom save flow is used
        if (note?.trim()) {
          await setSessionNote(sessionId, note.trim());
        }
        // Optionally, if custom save flow also expects stats, we can pre-write them locally
        await endWorkout(sessionId, {
          status: 'completed',
          ...(typeof durationMin === 'number' ? { durationMin } : {}),
          totalVolumeKg,
          totalSets: setCount,
          note: note?.trim() ? note.trim() : undefined,
        });
        await onSaveOverride();
      } else {
        let finishedAtOverride: string | undefined;
        if (isBackdated && sessionStartedAtMs) {
          const dt = new Date(sessionStartedAtMs);
          const localNoon = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 12, 0, 0);
          finishedAtOverride = localNoon.toISOString();
        }
        await endWorkout(sessionId, {
          status: 'completed',
          finishedAtOverride,
          note: note?.trim() ? note.trim() : undefined,
          totalVolumeKg,
          totalSets: setCount,
          ...(typeof durationMin === 'number' ? { durationMin } : {}),
        });
      }
      onCloseSheet();
      toast.show({
        placement: 'top',
        render: ({ id }) => (
          <Toast nativeID={id} action="success" variant="accent">
            <VStack space="xs">
              <ToastTitle>Workout Saved</ToastTitle>
              <ToastDescription>Your workout session has been saved successfully.</ToastDescription>
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
              <ToastTitle>Save Error</ToastTitle>
              <ToastDescription>Please try again.</ToastDescription>
            </VStack>
          </Toast>
        ),
      });
    }
  }, [endWorkout, isBackdated, sessionStartedAtMs, sessionId, onCloseSheet, toast, onSaveOverride, note, setSessionNote]);

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
      <Box bg="#2A2E38" px="$3" py="$3" width="100%" borderBottomWidth={1} borderColor="#3A3F4B">
        <HStack alignItems="center" justifyContent="space-between">
          <Pressable onPress={onBack} aria-label="Back">
            <HStack alignItems="center" space="xs">
              <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
              <Text color="$textLight50">Back</Text>
            </HStack>
          </Pressable>
          <Text color="$textLight50" fontWeight="$bold" fontSize="$md">Save Workout</Text>
          <Pressable onPress={handleSave} bg="#22c55e" px="$3" py="$1" borderRadius="$md">
            <Text color="$textLight50" fontWeight="$bold">Save</Text>
          </Pressable>
        </HStack>
      </Box>

      

      {/* Content */}
      <Box flex={1} px="$3" py="$4">
        <VStack space="xl">

          {/* Split/Workout name */}
          <Text color="$textLight50" fontSize="$xl" fontWeight="$semibold" numberOfLines={2}>
            {splitTitle || 'Workout'}
          </Text>

          {/* Metrics row */}
          <HStack justifyContent="space-between" space="sm">
            <VStack>
              <Text color="$textLight400" fontSize="$sm">Duration</Text>
              <Pressable>
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
            <Text color="#3B82F6" fontWeight="$semibold" fontSize="$md">{dateText}</Text>
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
      {/* Close outer container Box */}
      </Box>
    </TouchableWithoutFeedback>
  );
};

export default SaveSessionScreen;
