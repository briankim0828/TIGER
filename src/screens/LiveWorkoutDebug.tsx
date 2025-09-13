import React, { useEffect, useMemo } from 'react';
import { Box, HStack, VStack, Text, Button, ButtonText } from '@gluestack-ui/themed';
import { supabase } from '../utils/supabaseClient';
import { useLiveActiveSession, useLiveSessionSnapshot } from '../db/live/workouts';

const LiveWorkoutDebug: React.FC = () => {
  const [userId, setUserId] = React.useState<string | null>(null);
  React.useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUserId(user?.id ?? null);
      } catch {}
    })();
  }, []);

  const { session, loading: loadingSession, isLive } = useLiveActiveSession(userId ?? '');
  const sessionId = session?.id ?? null;
  const { snapshot, loading: loadingSnap } = useLiveSessionSnapshot(sessionId);

  const exCount = snapshot.exercises.length;
  const setsCount = useMemo(
    () => Object.values(snapshot.setsByExercise).reduce((acc, arr) => acc + (arr?.length ?? 0), 0),
    [snapshot.setsByExercise]
  );

  useEffect(() => {
    if (!sessionId) return;
    console.log('[LiveWorkoutDebug] session', sessionId, session?.startedAt);
  }, [sessionId, session?.startedAt]);

  useEffect(() => {
    if (!sessionId) return;
    console.log('[LiveWorkoutDebug] exercises:', exCount, 'sets:', setsCount);
  }, [sessionId, exCount, setsCount]);

  return (
    <Box flex={1} bg="#1E2028" p="$4">
      <VStack space="md">
        <Text color="white" fontSize="$xl" fontWeight="$bold">Live Workout Debug</Text>
        <Text color="$textLight400" fontSize="$sm">isLive ready: {String(isLive)}</Text>
        {loadingSession ? (
          <Text color="$textLight500">Loading active session…</Text>
        ) : session ? (
          <VStack space="xs" bg="#2A2E38" p="$3" borderRadius="$md">
            <Text color="white">Session ID: {session.id}</Text>
            <Text color="$textLight400">Started: {session.startedAt || 'n/a'}</Text>
          </VStack>
        ) : (
          <Text color="$textLight600">No active session.</Text>
        )}

        {session && (
          <VStack space="xs" bg="#2A2E38" p="$3" borderRadius="$md">
            {loadingSnap ? (
              <Text color="$textLight500">Loading snapshot…</Text>
            ) : (
              <>
                <HStack justifyContent="space-between">
                  <Text color="white">Exercises</Text>
                  <Text color="$textLight400">{exCount}</Text>
                </HStack>
                <HStack justifyContent="space-between">
                  <Text color="white">Total Sets</Text>
                  <Text color="$textLight400">{setsCount}</Text>
                </HStack>
                <Text color="$textLight500" fontSize="$xs">Open console to see live log when counts change.</Text>
              </>
            )}
          </VStack>
        )}
      </VStack>
    </Box>
  );
};

export default LiveWorkoutDebug;
