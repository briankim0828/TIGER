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
import { Split, Exercise, Set } from "../types";
import { ScrollView as RNScrollView } from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useData } from "../contexts/DataContext";
import { saveSplitsToSupabase } from "../supabase/supabaseSplits";

type WorkoutStackParamList = {
  WorkoutMain: undefined;
  SplitDetail: { split: Split; newlyAddedExercises?: Exercise[] };
  ExerciseSelection: { splitId: string };
};

type NavigationProp = NativeStackNavigationProp<WorkoutStackParamList>;
type RoutePropType = RouteProp<WorkoutStackParamList, "SplitDetail">;

// Extend the Exercise type to include sets and reps
interface ExerciseWithDetails extends Omit<Exercise, "sets"> {
  sets: Set[];
}

const SplitDetailScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RoutePropType>();
  const { split, newlyAddedExercises } = route.params;
  const splitColor = split.color || "#2A2E38";
  const [exercises, setExercises] = useState<ExerciseWithDetails[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [hasLocalChanges, setHasLocalChanges] = useState(false);
  const scrollViewRef = useRef<RNScrollView>(null);
  const { splits, updateSplits } = useData();

  // Convert SelectionExercise to WorkoutExercise
  const convertToWorkoutExercise = (
    exercise: Pick<Exercise, "id" | "name" | "bodyPart">
  ): ExerciseWithDetails => ({
    ...exercise,
    splitIds: [split.id],
    sets: [],
  });

  // Use exercises directly from the navigation params (initial load)
  useEffect(() => {
    if (split && split.exercises && !newlyAddedExercises) {
      console.log(
        "SplitDetailScreen - Initial loading exercises from route params:",
        split.exercises.length
      );
      const exercisesWithDetails = split.exercises.map((ex) => ({
        ...ex,
        splitIds: [split.id],
        sets: (ex as any).sets || [],
      }));
      setExercises(exercisesWithDetails);
    } else if (!split?.exercises && !newlyAddedExercises) {
      console.log(
        "SplitDetailScreen - No initial exercises found in route params"
      );
      setExercises([]);
    }
  }, [split]);

  // Effect to handle newly added exercises passed back via route params
  useEffect(() => {
    if (newlyAddedExercises && newlyAddedExercises.length > 0) {
      console.log(
        `SplitDetailScreen - Received ${newlyAddedExercises.length} new exercises from route params.`
      );
      const newWorkoutExercises = newlyAddedExercises.map(
        convertToWorkoutExercise
      );
      setExercises((prevExercises) => [...prevExercises, ...newWorkoutExercises]);
      setHasLocalChanges(true);

      // Clear the param to prevent re-adding on subsequent renders/focus changes
      navigation.setParams({ newlyAddedExercises: undefined });
    }
  }, [newlyAddedExercises, navigation]);

  // Save exercises to storage whenever editing finishes and changes exist
  useEffect(() => {
    const saveExercises = async () => {
      if (!isEditing && hasLocalChanges) {
        console.log("SplitDetailScreen: Detected changes, preparing to save...");
        const exercisesToSave = exercises.map(({ id, name, bodyPart, sets }) => ({ id, name, bodyPart, sets }));
        const updatedSplits = splits.map((splitItem: Split) =>
          splitItem.id === split.id
            ? { ...split, exercises: exercisesToSave }
            : splitItem
        );

        console.log(
          `SplitDetailScreen: Saving ${updatedSplits.length} splits to Supabase.`
        );
        const success = await saveSplitsToSupabase(updatedSplits);

        if (success) {
          console.log(
            "SplitDetailScreen: Splits saved successfully via supabaseSplits."
          );
          updateSplits(updatedSplits);
          setHasLocalChanges(false);
        } else {
          console.error(
            "SplitDetailScreen: Failed to save splits via supabaseSplits."
          );
        }
      }
    };

    saveExercises();
  }, [
    isEditing,
    hasLocalChanges,
    split,
    exercises,
    splits,
    updateSplits,
    saveSplitsToSupabase,
  ]);

  const handleRemoveExercise = async (index: number) => {
    const updatedExercises = exercises.filter((_, i) => i !== index);
    setExercises(updatedExercises);
    setHasLocalChanges(true);
  };

  const handleUpdateExercise = (
    index: number,
    field: "sets" | "reps",
    value: string
  ) => {
    console.warn("handleUpdateExercise called but currently commented out - review implementation needed.");
  };

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
        <Icon as={AntDesign} name="plus" color="#6B8EF2" size="sm" />
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
              <ButtonIcon as={AntDesign} name="left" color="$white" />
            </Button>
            <Text color="$white" fontSize="$xl" fontWeight="$bold">
              {split.name}
            </Text>
          </HStack>
          <Button
            variant="link"
            onPress={() => setIsEditing(!isEditing)}
          >
            <ButtonIcon
              as={AntDesign}
              name={isEditing ? "check" : "edit"}
              color="white"
            />
          </Button>
        </HStack>

        <ScrollView
          ref={scrollViewRef}
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
                        <Button
                          variant="link"
                          onPress={() => handleRemoveExercise(index)}
                          sx={{ p: 0 }}
                        >
                          <ButtonIcon
                            as={AntDesign}
                            name="close"
                            color="$gray400"
                          />
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
