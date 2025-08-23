import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Box,
  HStack,
  Text,
  Icon,
  Button,
  ButtonIcon,
  VStack,
  Pressable,
  ScrollView,
} from "@gluestack-ui/themed";
import { AntDesign } from "@expo/vector-icons";
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
  const [isEditing, setIsEditing] = useState(false);
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
    <Box flex={1} backgroundColor="#1E2028">
      <Box flex={1}>
        <HStack justifyContent="space-between" alignItems="center" p="$4">
          <HStack space="md" alignItems="center">
            <Button
              variant="link"
              onPress={() => navigation.goBack()}
            >
              {/* @ts-ignore ButtonIcon typing for vector icons */}
              <ButtonIcon as={AntDesign as any} name="left" color="$white" />
            </Button>
            <Text color="$white" fontSize="$xl" fontWeight="$bold">
              {split.name}
            </Text>
          </HStack>
          <Button variant="link" onPress={() => setIsEditing(!isEditing)}>
            {/* Replace ButtonIcon with Icon to avoid typing friction */}
            {/* @ts-ignore */}
            <Icon as={AntDesign as any} name={isEditing ? "check" : "edit"} color="white" />
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
                  <Box
        key={exercise.id}
                    backgroundColor="transparent"
                    p="$3"
                    borderRadius="$lg"
                    borderWidth="$1"
                    borderColor="rgba(255, 255, 255, 0.5)"
                  >
                    <HStack justifyContent="space-between" alignItems="center">
                      <HStack space="md" alignItems="center" flex={1}>
                        <Box
                          width="$3"
                          height="$full"
                          backgroundColor={splitColor}
                          position="absolute"
                          left="$0"
                          borderRadius="$md"
                        />
                        <Text color="rgba(255, 255, 255, 0.5)" fontSize="$sm" ml="$4">
                          {index + 1}
                        </Text>
                        <Text color="$white" fontSize="$md">
          {exercise.name}
                        </Text>
                      </HStack>
                      {isEditing && (
                        <Button variant="link" onPress={() => handleRemoveExercise(index)} sx={{ p: 0 }}>
                          {/* @ts-ignore */}
                          <Icon as={AntDesign as any} name="close" color="$gray400" />
                        </Button>
                      )}
                    </HStack>
                  </Box>
                ))}

                {isEditing && addExerciseButton}
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
                  {isEditing && <Box width="$full">{addExerciseButton}</Box>}
                </VStack>
              </Box>
            )}
          </VStack>
        </ScrollView>
      </Box>
    </Box>
  );
};

export default SplitDetailScreen;
