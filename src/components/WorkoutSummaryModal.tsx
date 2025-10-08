import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, VStack, HStack, Pressable, Icon } from '@gluestack-ui/themed';
import { Modal, StyleSheet } from 'react-native';
import { AntDesign } from '@expo/vector-icons';
import type { WorkoutSummaryPayload } from '../contexts/OverlayContext';
import { useWorkoutHistory } from '../db/queries';
import { supabase } from '../utils/supabaseClient';

interface WorkoutSummaryModalProps extends WorkoutSummaryPayload {
  onClose: () => void;
}

const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

const WorkoutSummaryModal: React.FC<WorkoutSummaryModalProps> = ({
  sessionName,
  note,
  durationMin,
  totalVolumeKg,
  startedAtMs,
  startedAtISO,
  exercises,
  onClose,
}) => {
  const history = useWorkoutHistory();
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [totalCompleted, setTotalCompleted] = useState<number>(1);

  // Resolve current user ID (fallback to 'local-user')
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (isMounted) setAuthUserId(user?.id ?? null);
      } catch {
        if (isMounted) setAuthUserId(null);
      }
    })();
    return () => { isMounted = false; };
  }, []);

  // Fetch up-to-date total completed workouts for the user
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const uid = authUserId ?? 'local-user';
        const stats = await history.getWorkoutStats(uid);
        if (isMounted && typeof stats?.totalWorkouts === 'number') {
          setTotalCompleted(Math.max(1, stats.totalWorkouts));
        }
      } catch {
        // keep default 1 on failure
      }
    })();
    return () => { isMounted = false; };
  }, [authUserId, history]);
  const dateLabel = useMemo(() => {
    const d = startedAtMs ? new Date(startedAtMs) : (startedAtISO ? new Date(startedAtISO) : null);
    if (!d) return '';
    try {
      return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: '2-digit', year: 'numeric' });
    } catch { return ''; }
  }, [startedAtMs, startedAtISO]);

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Box flex={1} bg="rgba(0,0,0,0.6)" justifyContent="center" alignItems="center" px="$4">
        <Box bg="#12141A" borderRadius="$xl" p="$4" width="$full">
          {/* Close button */}
          <Pressable onPress={onClose} position="absolute" right={10} top={10} hitSlop={8}>
            {/* @ts-ignore */}
            <Icon as={AntDesign as any} name="close" color="$gray400" size="md" />
          </Pressable>

          {/* Celebration */}
          <VStack space="xs" alignItems="center" mt="$2" mb="$3">
            <Text fontSize="$3xl">🎉</Text>
            <Text color="$textLight50" fontSize="$lg" fontWeight="$bold" textAlign="center">
              {`Congratulations!`}
            </Text>
            <Text color="$textLight50" fontSize="$lg" fontWeight="$bold" textAlign="center">
              {`You've finished your ${ordinal(totalCompleted)} workout!`}
            </Text>
          </VStack>

          {/* Post preview (matches ProfileScreen card) */}
          <Box bg="#12141A" borderRadius="$lg" p="$4" borderWidth={1} borderColor="#1E2028">
            {/* Header: avatar letter, username placeholder, date */}
            <HStack alignItems="center" justifyContent="space-between" mb="$2">
              <HStack alignItems="center" space="sm">
                <Box width={36} height={36} borderRadius="$full" bg="#2A2E38" alignItems="center" justifyContent="center">
                  <Text color="$white" fontWeight="$bold">U</Text>
                </Box>
                <VStack>
                  <Text color="$white" fontWeight="$bold">You</Text>
                  <Text color="$gray400" fontSize="$xs">{dateLabel}</Text>
                </VStack>
              </HStack>
            </HStack>
            {/* Title + note */}
            <VStack space="xs" mb="$3">
              <Text color="$white" fontSize="$xl" fontWeight="$bold">{sessionName || 'Workout'}</Text>
              {!!note && <Text color="$gray300" fontSize="$sm">{note}</Text>}
            </VStack>
            {/* Duration + Volume */}
            <HStack space="xl" mb="$3">
              <VStack>
                <Text color="$gray400" fontSize="$xs">Time</Text>
                <Text color="$white" fontWeight="$semibold">{durationMin ?? 0}min</Text>
              </VStack>
              <VStack>
                <Text color="$gray400" fontSize="$xs">Volume</Text>
                <Text color="$white" fontWeight="$semibold">{(totalVolumeKg ?? 0).toLocaleString()} kg</Text>
              </VStack>
            </HStack>
            {/* Exercises */}
            <VStack space="sm">
              {exercises.map((ex, i) => (
                <HStack key={`${ex.name}-${i}`} alignItems="center" justifyContent="space-between">
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
        </Box>
      </Box>
    </Modal>
  );
};

export default WorkoutSummaryModal;
