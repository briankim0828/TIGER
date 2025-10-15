import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { StyleSheet } from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { Box, HStack, Text, VStack, Pressable } from '@gluestack-ui/themed';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWorkout } from '../contexts/WorkoutContext';
import { getBottomNavHeight, onBottomNavHeightChange } from '../navigation/layoutMetrics';

interface Props {
  visible: boolean;
  splitName: string;
  startedAtMs?: number | null;
  onPress: () => void; // reopen full modal
}

const NAVBAR_HEIGHT_FALLBACK = 64;

const ActiveWorkoutBanner: React.FC<Props> = ({ visible, splitName, startedAtMs, onPress }) => {
  const insets = useSafeAreaInsets();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => [80], []); // fixed height mini sheet
  const [navHeight, setNavHeight] = useState<number>(() => getBottomNavHeight() || NAVBAR_HEIGHT_FALLBACK);
  useEffect(() => {
    const off = onBottomNavHeightChange((h) => setNavHeight(h || NAVBAR_HEIGHT_FALLBACK));
    return off;
  }, []);

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
  // Offset exactly by measured bottom navbar height so the banner hugs right above it
  containerStyle={{ marginBottom: Math.max(0, navHeight - StyleSheet.hairlineWidth) }}
      handleIndicatorStyle={{ backgroundColor: 'white', width: 36, height: 3 }}
      backgroundStyle={{ backgroundColor: '#2A2E38' }}
    >
      <BottomSheetView style={styles.view}>
        <Pressable onPress={onPress} px="$4" py="$2" width="100%">
          <HStack alignItems="center" justifyContent="space-between">
            <VStack alignItems="flex-start">
              <Text color="$textLight50" fontWeight="$bold" fontSize="$md" numberOfLines={1}>
                {splitName || 'Active Workout'}
              </Text>
              <Text color="$primary400" fontWeight="$semibold" fontSize="$sm">
                {formatTimer(elapsed)}
              </Text>
            </VStack>
            <Text color="$textLight400" fontSize="$xs">Tap to resume</Text>
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
