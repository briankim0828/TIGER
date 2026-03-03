import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { Box, HStack, Text, Pressable } from '@gluestack-ui/themed';

interface Props {
  visible: boolean;
  sessionName: string;
  startedAtMs?: number | null;
  onPress: () => void; // reopen full modal
}

const ActiveWorkoutBanner: React.FC<Props> = ({ visible, sessionName, startedAtMs, onPress }) => {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => [80], []); // fixed height mini sheet

  useEffect(() => {
    const t = setTimeout(() => {
      if (visible) bottomSheetRef.current?.expand();
      else bottomSheetRef.current?.close();
    }, 50);
    return () => clearTimeout(t);
  }, [visible]);

  // Keep a lightweight tick to re-render; compute elapsed from startedAtMs so it never resets visually.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (visible && startedAtMs) {
      timer = setInterval(() => setTick((t) => t + 1), 1000);
    }
    return () => { if (timer) clearInterval(timer); };
  }, [visible, startedAtMs]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const elapsed = startedAtMs ? Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000)) : 0;
  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      enablePanDownToClose={false}
      snapPoints={snapPoints}
      topInset={0}
      bottomInset={0}
      handleIndicatorStyle={{ backgroundColor: 'white', width: 36, height: 3 }}
      backgroundStyle={{ backgroundColor: '#2A2E38' }}
    >
      <BottomSheetView style={styles.view}>
        <Pressable onPress={onPress} px="$4" py="$4" width="100%">
          <HStack alignItems="center" justifyContent="space-between" position="relative">
            <Box width={72} alignItems="flex-start" justifyContent="center">
              <Text color="$primary400" fontWeight="$semibold" fontSize="$sm">
                {formatTimer(elapsed)}
              </Text>
            </Box>

            <Box position="absolute" left={0} right={0} alignItems="center" pointerEvents="none">
              <Text color="$textLight50" fontWeight="$bold" fontSize="$md" numberOfLines={1} textAlign="center" maxWidth="65%">
                {sessionName || 'Workout'}
              </Text>
            </Box>

            <Box width={72} alignItems="flex-end" justifyContent="center">
              <Text color="$textLight400" fontSize="$xs">Resume</Text>
            </Box>
          </HStack>
        </Pressable>
      </BottomSheetView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  view: {
    width: '100%',
    backgroundColor: '#2A2E38',
  },
});

export default ActiveWorkoutBanner;
