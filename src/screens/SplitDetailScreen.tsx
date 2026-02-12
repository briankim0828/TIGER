import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Box,
  HStack,
  Text,
  Icon,
  Button,
  VStack,
  Pressable,
} from "@gluestack-ui/themed";
import { Feather, Entypo } from "@expo/vector-icons";
import BottomSheet, { BottomSheetBackdrop, BottomSheetFlatList, BottomSheetView } from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
// Legacy types are ignored; we use DB as the source of truth
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StyleSheet } from "react-native";
import { useNavigation, useRoute, RouteProp, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useDatabase } from "../db/queries";
import { ProgramSplit } from "../types/ui";
import type { SplitExerciseJoin } from "../db/queries/simple";
import { registerSelectionCallback } from "../navigation/selectionRegistry";

type WorkoutStackParamList = {
  WorkoutMain: undefined;
  SplitDetail: { split: ProgramSplit; newlyAddedExercises?: any[] };
  ExerciseSelection: { splitId: string } | { requestId: string; allowMultiple?: boolean; disableIds?: string[] };
};

type NavigationProp = NativeStackNavigationProp<WorkoutStackParamList>;
type RoutePropType = RouteProp<WorkoutStackParamList, "SplitDetail">;

type ExerciseRow = { id: string; name: string; bodyPart: string | null };

const SplitDetailScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RoutePropType>();
  const { split, newlyAddedExercises } = route.params;
  const splitColor = split.color || "#2A2E38";
  const [exercises, setExercises] = useState<ExerciseRow[]>([]);
  const [actionSheet, setActionSheet] = useState<{ visible: boolean; rowId?: string; index?: number }>(() => ({ visible: false }));
  // Action menu bottom sheet
  const actionMenuRef = useRef<BottomSheet>(null);
  const actionMenuSnapPoints = useMemo(() => ["28%"], []);
  const [optionsSheetRefMap] = useState(() => new Map<string, string>());
  const bottomSheetRef = useRef<BottomSheet>(null);
  const insets = useSafeAreaInsets();
  const snapPoints = useMemo(() => ["100%"], []);
  // Edit state removed; Add Exercise is always visible now
  // No need for ref to themed ScrollView (type mismatch)
  const db = useDatabase();

  useEffect(() => {
    // Bottom sheet ref mounted
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      bottomSheetRef.current?.expand();
    }, 50);
    return () => clearTimeout(timeout);
  }, []);

  // Pretty-print helper for body part labels (matches SessionPreviewModal)
  const titleCase = useCallback((s: string | null | undefined) => {
    if (!s) return "";
    return s
      .split(/[_\s-]+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }, []);

  const loadSplitExercises = useCallback(async () => {
    try {
      const rows: SplitExerciseJoin[] = await db.getSplitExercises(split.id);
      const list = rows.map((r) => ({ id: r.exercise.id, name: r.exercise.name, bodyPart: r.exercise.bodyPart ?? null }));
      // Maintain a map from exerciseId to split_exercise row id for precise ops
      optionsSheetRefMap.clear();
      for (const r of rows) {
        optionsSheetRefMap.set(r.exercise.id, r.splitExerciseId);
      }
      setExercises(list);
    } catch (e) {
      console.error('SplitDetailScreen: failed to load split exercises', e);
    }
  }, [db, split.id, optionsSheetRefMap]);

  // Initial and focus-based load
  useEffect(() => {
    loadSplitExercises();
  }, [loadSplitExercises]);
  useFocusEffect(
    useCallback(() => {
      loadSplitExercises();
    }, [loadSplitExercises])
  );

  // Open/close the action menu sheet as visibility changes
  useEffect(() => {
    if (actionSheet.visible) {
      actionMenuRef.current?.expand();
    }
  }, [actionSheet.visible]);

  // Effect to handle newly added exercises passed back via route params
  useEffect(() => {
    // We now persist directly in selection view; no need to handle params
    if (newlyAddedExercises && newlyAddedExercises.length > 0) {
      navigation.setParams({ newlyAddedExercises: undefined });
      loadSplitExercises();
    }
  }, [newlyAddedExercises, navigation, loadSplitExercises]);

  // Removed Supabase/DataContext persistence: DB is now the source of truth

  const handleDeleteExercise = async (index: number) => {
    const exercise = exercises[index];
    if (!exercise) return;
    try {
      const rowId = optionsSheetRefMap.get(exercise.id);
      if (rowId && (db as any).deleteSplitExercise) {
        await (db as any).deleteSplitExercise(rowId, split.id);
      } else {
        await db.removeExerciseFromSplit(split.id, exercise.id);
      }
      await loadSplitExercises();
    } catch (e) {
      console.error('SplitDetailScreen: failed to delete exercise', e);
    }
  };

  const handleReplaceExercise = async (index: number) => {
    const exercise = exercises[index];
    if (!exercise) return;
    const requestId = `replace:${split.id}:${exercise.id}:${Date.now()}`;
    registerSelectionCallback(requestId, async (items) => {
      const chosen = items[0];
      if (!chosen) return;
      try {
        const rowId = optionsSheetRefMap.get(exercise.id);
        if (rowId && (db as any).replaceSplitExercise) {
          await (db as any).replaceSplitExercise(rowId, chosen.id);
        } else {
          // Fallback: delete old, then add new at end
          await db.removeExerciseFromSplit(split.id, exercise.id);
          await db.addExercisesToSplit(split.id, [chosen.id], { avoidDuplicates: true });
        }
        await loadSplitExercises();
      } catch (e) {
        console.error('SplitDetailScreen: failed to replace exercise', e);
      }
    });
    // Navigate to generic selection modal in single-select mode
    navigation.navigate(
      // @ts-ignore navigate with union params
      'ExerciseSelection',
      { requestId, allowMultiple: false, disableIds: exercises.map(e => e.id) }
    );
  };

  // Placeholder for potential future per-exercise metadata
  const handleUpdateExercise = () => {};

  const addExerciseButton = (
    <Pressable
      width="$full"
      borderStyle="dashed"
      borderWidth="$1"
      borderColor="#6B8EF2"
      backgroundColor="transparent"
      borderRadius="$lg"
      py="$2"
      sx={{
        ":pressed": {
          opacity: 0.7
        }
      }}
      onPress={() => {
        navigation.navigate("ExerciseSelection", { splitId: split.id });
      }}
    >
      <HStack space="sm" justifyContent="center" alignItems="center">
  {/* @ts-ignore gluestack Icon typing doesn't include `name` but runtime is fine */}
  <Icon as={Feather as any} name="plus" color="#6B8EF2" size="sm" />
        <Text color="#6B8EF2" fontSize="$md">
          Add Exercise
        </Text>
      </HStack>
    </Pressable>
  );

  const renderExerciseItem = useCallback(
    ({ item, index }: { item: ExerciseRow; index: number }) => (
      <Box backgroundColor="transparent" p="$2">
        <HStack alignItems="center" justifyContent="space-between">
          <HStack space="md" alignItems="center" flex={1}>
            {/* Avatar with first letter */}
            <Box
              width={48}
              height={48}
              backgroundColor={splitColor}
              borderRadius="$md"
              alignItems="center"
              justifyContent="center"
            >
              <Text color="$white" fontWeight="$bold" fontSize="$lg">
                {item.name.charAt(0).toUpperCase()}
              </Text>
            </Box>
            <VStack flex={1}>
              <Text color="$white" fontSize="$md" numberOfLines={1}>
                {item.name}
              </Text>
              <Text color="$gray400" fontSize="$sm">{titleCase(item.bodyPart)}</Text>
            </VStack>
          </HStack>
          {/* Trailing menu */}
          <Button
            variant="link"
            onPress={() => setActionSheet({ visible: true, index, rowId: optionsSheetRefMap.get(item.id) })}
          >
            {/* @ts-ignore */}
            <Icon as={Entypo as any} name="dots-three-horizontal" color="$white" />
          </Button>
        </HStack>
      </Box>
    ),
    [optionsSheetRefMap, splitColor, titleCase]
  );

  const renderListFooter = useCallback(() => (
    <Box>
      {exercises.length > 0 ? <Box mt="$2">{addExerciseButton}</Box> : null}
      <Box h={45} />
    </Box>
  ), [addExerciseButton, exercises.length]);

  const renderListEmpty = useCallback(() => (
    <Box
      backgroundColor="transparent"
      borderRadius="$lg"
      p="$3"
      borderWidth="$0"
      borderColor="$gray700"
    >
      <VStack space="xl" alignItems="center">
        <Text color="$gray400" fontSize="$lg">
          Add exercises to {split.name} day
        </Text>
        <Box width="$full">{addExerciseButton}</Box>
      </VStack>
    </Box>
  ), [addExerciseButton, split.name]);

  const handleSheetChanges = useCallback((index: number) => {
    if (index === -1) {
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate("WorkoutMain");
      }
    }
  }, [navigation]);

  return (
    <GestureHandlerRootView style={styles.rootContainer}>
      <Box flex={1} backgroundColor="transparent">
  <BottomSheet
        ref={bottomSheetRef}
        index={0}
        snapPoints={snapPoints}
        topInset={insets.top}
        enableDynamicSizing={false}
        enablePanDownToClose
        onChange={handleSheetChanges}
        onClose={() => handleSheetChanges(-1)}
        backdropComponent={(props) => (
          <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.5} pressBehavior="close" />
        )}
        handleIndicatorStyle={{ backgroundColor: '#666' }}
        backgroundStyle={{ backgroundColor: '#1E2028' }}
      >
        {/* Centered title header with back button on the left */}
        <Box p="$4" position="relative" alignItems="center" justifyContent="center">
          <Text color="$white" fontSize="$xl" fontWeight="$bold" numberOfLines={1}>
            {split.name}
          </Text>
        </Box>

        {/* Summary row with total count and Reorder button (no-op) */}
        <HStack alignItems="center" justifyContent="space-between" px="$4" pb="$2">
          <Text color="$gray400" fontSize="$sm">
            Total of {exercises.length}
          </Text>
          <Button
            variant="outline"
            size="xs"
            borderColor="#6B8EF2"
            onPress={() => { /* no-op for now */ }}
            px="$2"
          >
            <HStack alignItems="center" space="xs">
              {/* @ts-ignore gluestack Icon typing doesn't include `name`, but runtime supports vector icons */}
              <Icon as={Feather as any} name="repeat" color="#6B8EF2" size="xs" />
              <Text color="#6B8EF2" fontSize="$xs">Reorder</Text>
            </HStack>
          </Button>
        </HStack>

        <BottomSheetFlatList
          data={exercises}
          renderItem={renderExerciseItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderListEmpty}
          ListFooterComponent={renderListFooter}
          ItemSeparatorComponent={() => <Box height="$3" />}
        />
      </BottomSheet>
      {/* Per-exercise action bottom sheet as sibling to avoid nested-sheet jitter */}
      <BottomSheet
        ref={actionMenuRef}
        index={-1}
        snapPoints={actionMenuSnapPoints}
        enablePanDownToClose
        onClose={() => setActionSheet({ visible: false })}
        backdropComponent={(props) => (
          <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.5} pressBehavior="close" />
        )}
        handleIndicatorStyle={{ backgroundColor: '#666' }}
        backgroundStyle={{ backgroundColor: '#1E2028' }}
      >
        <BottomSheetView style={styles.sheetContent}>
          <Box p="$4">
          <VStack space="md">
            <Pressable onPress={async () => {
              const idx = actionSheet.index ?? -1;
              actionMenuRef.current?.close();
              await handleDeleteExercise(idx);
            }} accessibilityRole="button">
              <HStack alignItems="center" justifyContent="space-between" py="$3">
                <HStack space="md" alignItems="center">
                  {/* @ts-ignore */}
                  <Icon as={Feather as any} name="trash-2" color="$red500" />
                  <Text color="$red500" fontSize="$md">Delete</Text>
                </HStack>
              </HStack>
            </Pressable>
            <Pressable onPress={() => {
              const idx = actionSheet.index ?? -1;
              actionMenuRef.current?.close();
              handleReplaceExercise(idx);
            }} accessibilityRole="button">
              <HStack alignItems="center" justifyContent="space-between" py="$3">
                <HStack space="md" alignItems="center">
                  {/* @ts-ignore */}
                  <Icon as={Feather as any} name="repeat" color="$white" />
                  <Text color="$white" fontSize="$md">Replace</Text>
                </HStack>
              </HStack>
            </Pressable>
          </VStack>
          </Box>
        </BottomSheetView>
      </BottomSheet>
      </Box>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
  },
  sheetContent: {
    width: '100%',
  },
  listContent: {
    padding: 12,
  },
});

export default SplitDetailScreen;
