import React, { useMemo, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Box, Button, ButtonText, Text, VStack } from '@gluestack-ui/themed';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const BottomSheetDebugScreen: React.FC = () => {
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['25%', '60%'], []);

  React.useEffect(() => {
    console.log('[BottomSheetDebug] mounted, ref ready:', Boolean(sheetRef.current));
    const timeout = setTimeout(() => {
      const currentIndex = sheetRef.current?.animatedIndex?.value;
      console.log('[BottomSheetDebug] expanding sheet, current index:', currentIndex);
      sheetRef.current?.expand();
    }, 80);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaView style={styles.safeArea}>
        <Box flex={1} bg="#1E2028" justifyContent="center" alignItems="center">
          <VStack space="lg" alignItems="center">
            <Text color="$white" fontSize="$xl" fontWeight="$bold">
              Bottom Sheet Debug
            </Text>
            <Text color="$gray300" textAlign="center">
              This screen mounts a single @gorhom/bottom-sheet instance with static content.
              If the sheet does not appear, the issue is likely with the native dependency setup.
            </Text>
            <Button
              onPress={() => {
                const idx = sheetRef.current?.animatedIndex?.value ?? -1;
                console.log('[BottomSheetDebug] toggle pressed, current index:', idx);
                if (idx >= 0) sheetRef.current?.close();
                else sheetRef.current?.expand();
              }}
              variant="outline"
              action="secondary"
            >
              <ButtonText>Toggle Sheet</ButtonText>
            </Button>
          </VStack>
        </Box>
      </SafeAreaView>
      <BottomSheet
        ref={sheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        onChange={(index) => console.log('[BottomSheetDebug] onChange', index)}
        handleIndicatorStyle={{ backgroundColor: '#fff' }}
        backgroundStyle={{ backgroundColor: '#2A2E38' }}
        backdropComponent={(props) => (
          <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.4} />
        )}
      >
        <BottomSheetView style={styles.sheetContent}>
          <Text color="$white" fontSize="$lg" fontWeight="$semibold">
            If you can see this content, the bottom sheet rendered correctly.
          </Text>
        </BottomSheetView>
      </BottomSheet>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  sheetContent: {
    flex: 1,
    padding: 24,
    backgroundColor: '#2A2E38',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default BottomSheetDebugScreen;
