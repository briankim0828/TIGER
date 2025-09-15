import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { StyleSheet } from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { Box, Pressable, Text } from '@gluestack-ui/themed';
import LiveWorkoutDebug from '../screens/LiveWorkoutDebug';
import { useOverlay } from '../contexts/OverlayContext';

const DevFloatingDebug: React.FC = () => {
  const { liveDebugEnabled } = useOverlay();
  const [open, setOpen] = useState(false);
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['33%'], []);

  useEffect(() => {
    if (!__DEV__ || !liveDebugEnabled) return; // gate side effects when disabled
    const t = setTimeout(() => {
      if (open) sheetRef.current?.expand();
      else sheetRef.current?.close();
    }, 80);
    return () => clearTimeout(t);
  }, [open, liveDebugEnabled]);

  const toggle = useCallback(() => setOpen((v) => !v), []);

  if (!__DEV__ || !liveDebugEnabled) return null; // gate rendering but after hooks

  return (
    <Box style={styles.container} pointerEvents="box-none">
      <Pressable
        onPress={toggle}
        position="absolute"
        right={16}
        bottom={96}
        bg="#6B8EF2"
        px="$4"
        py="$3"
        borderRadius="$full"
        shadowRadius="$9"
        $pressed={{ opacity: 0.8 }}
      >
        <Text color="white" fontWeight="$bold">LIVE</Text>
      </Pressable>

      <BottomSheet
        ref={sheetRef}
        enablePanDownToClose={true}
        index={-1}
        snapPoints={snapPoints}
        handleIndicatorStyle={{ backgroundColor: 'white', width: 36, height: 3 }}
        backgroundStyle={{ backgroundColor: '#2A2E38' }}
        onChange={(idx) => { if (idx === -1) setOpen(false); }}
      >
        <BottomSheetView style={{ flex: 1, backgroundColor: '#2A2E38' }}>
          <LiveWorkoutDebug />
        </BottomSheetView>
      </BottomSheet>
    </Box>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 1000,
  },
});

export default DevFloatingDebug;
