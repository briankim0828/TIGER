import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Box,
  HStack,
  Text,
  Icon,
  Button,
  VStack,
  Pressable,
  ScrollView,
} from "@gluestack-ui/themed";
import { AntDesign } from "@expo/vector-icons";
import BottomSheet, { BottomSheetBackdrop } from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
// Legacy types are ignored; we use DB as the source of truth
import { ScrollView as RNScrollView } from "react-native";
import { useNavigation, useRoute, RouteProp, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useDatabase } from "../db/queries";
import { ProgramSplit } from "../types/ui";
import type { SplitExerciseJoin } from "../db/queries/simple";

type WorkoutStackParamList = {
  WorkoutMain: undefined;
  SplitDetail: { split: ProgramSplit; newlyAddedExercises?: any[] };
  ExerciseSelection: { splitId: string };
};

type NavigationProp = NativeStackNavigationProp<WorkoutStackParamList>;
type RoutePropType = RouteProp<WorkoutStackParamList, "SplitDetail">;

type ExerciseRow = { id: string; name: string };

const SplitDetailScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RoutePropType>();
  const { split, newlyAddedExercises } = route.params;
  const splitColor = split.color || "#2A2E38";
  const [exercises, setExercises] = useState<ExerciseRow[]>([]);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ["100%"], []);
  const insets = useSafeAreaInsets();
  // Edit state removed; Add Exercise is always visible now
  // No need for ref to themed ScrollView (type mismatch)
  const db = useDatabase();

  const loadSplitExercises = useCallback(async () => {
    try {
      const rows: SplitExerciseJoin[] = await db.getSplitExercises(split.id);
      const list = rows.map((r) => ({ id: r.exercise.id, name: r.exercise.name }));
      setExercises(list);
    } catch (e) {
      console.error('SplitDetailScreen: failed to load split exercises', e);
    }
  }, [db, split.id]);

  // Initial and focus-based load
  useEffect(() => {
    loadSplitExercises();
  }, [loadSplitExercises]);
  useFocusEffect(
    useCallback(() => {
      loadSplitExercises();
    }, [loadSplitExercises])
  );

  // Effect to handle newly added exercises passed back via route params
  useEffect(() => {
    // We now persist directly in selection view; no need to handle params
    if (newlyAddedExercises && newlyAddedExercises.length > 0) {
      navigation.setParams({ newlyAddedExercises: undefined });
      loadSplitExercises();
    }
  }, [newlyAddedExercises, navigation, loadSplitExercises]);

  // Removed Supabase/DataContext persistence: DB is now the source of truth

  const handleRemoveExercise = async (index: number) => {
    const exercise = exercises[index];
    if (!exercise) return;
    try {
      await db.removeExerciseFromSplit(split.id, exercise.id);
      await loadSplitExercises();
    } catch (e) {
      console.error('SplitDetailScreen: failed to remove exercise', e);
    }
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
  <Icon as={AntDesign as any} name="plus" color="#6B8EF2" size="sm" />
        <Text color="#6B8EF2" fontSize="$md">
          Add Exercise
        </Text>
      </HStack>
    </Pressable>
  );

  return (
    <Box flex={1} backgroundColor="transparent">
      <BottomSheet
        ref={bottomSheetRef}
        index={0}
        snapPoints={snapPoints}
        topInset={insets.top}
        enablePanDownToClose
        onClose={() => navigation.goBack()}
        backdropComponent={(props) => (
          <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.5} pressBehavior="close" />
        )}
        handleIndicatorStyle={{ backgroundColor: '#666' }}
        backgroundStyle={{ backgroundColor: '#1E2028' }}
      >
        <Box flex={1}>
          {/* Centered title header with back button on the left */}
          <Box p="$4" position="relative" alignItems="center" justifyContent="center">
            <Button
              variant="link"
              onPress={() => {
                // Close sheet then navigate back
                bottomSheetRef.current?.close();
              }}
              position="absolute"
              left="$2"
            >
              {/* @ts-ignore */}
              <Icon as={AntDesign as any} name="left" color="$white" />
            </Button>
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
                <Icon as={AntDesign as any} name="swap" color="#6B8EF2" size="xs" />
                <Text color="#6B8EF2" fontSize="$xs">Reorder</Text>
              </HStack>
            </Button>
          </HStack>

          <ScrollView
            flex={1}
            showsVerticalScrollIndicator={false}
          >
            <VStack space="lg" p="$3">
              {exercises.length > 0 ? (
                <VStack space="md">
                  {exercises.map((exercise, index) => (
                    <Box key={exercise.id} backgroundColor="transparent" p="$2">
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
                              {exercise.name.charAt(0).toUpperCase()}
                            </Text>
                          </Box>
                          <VStack flex={1}>
                            <Text color="$white" fontSize="$md" numberOfLines={1}>
                              {exercise.name}
                            </Text>
                            <Text color="$gray400" fontSize="$xs">
                              {/* Placeholder for sets/rep summary */}
                            </Text>
                          </VStack>
                        </HStack>
                        {/* Trailing menu (no-op) */}
                        <Button variant="link" onPress={() => handleRemoveExercise(index)}>
                          {/* @ts-ignore */}
                          <Icon as={AntDesign as any} name="close" color="$red500" />
                        </Button>
                      </HStack>
                    </Box>
                  ))}

                  {/* Always show Add Exercise button */}
                  <Box mt="$2">{addExerciseButton}</Box>
                </VStack>
              ) : (
                <Box
                  backgroundColor="transparent"
                  borderRadius="$lg"
                  p="$3"
                  borderWidth="$1"
                  borderColor="$gray700"
                >
                  <VStack space="xl" alignItems="center">
                    <Text color="$gray400" fontSize="$lg">
                      Add exercises to {split.name} day
                    </Text>
                    <Box width="$full">{addExerciseButton}</Box>
                  </VStack>
                </Box>
              )}
            </VStack>
          </ScrollView>
        </Box>
      </BottomSheet>
    </Box>
  );
};

export default SplitDetailScreen;
