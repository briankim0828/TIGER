import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Box,
  HStack,
  Text,
  Icon,
  IconButton,
  VStack,
  Pressable,
  ScrollView,
} from "native-base";
import { AntDesign } from "@expo/vector-icons";
import { Split, Exercise, Set } from "../types";
import { ScrollView as RNScrollView } from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useData } from "../contexts/DataContext";
import { supabase } from "../utils/supabaseClient";

type WorkoutStackParamList = {
  WorkoutMain: undefined;
  SplitDetail: { split: Split };
  ExerciseSelection: { onAddExercise: (newExercises: Exercise[]) => void };
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
  const { split } = route.params;
  const splitColor = split.color || "#2A2E38";
  const [exercises, setExercises] = useState<ExerciseWithDetails[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [hasLocalChanges, setHasLocalChanges] = useState(false);
  const scrollViewRef = useRef<RNScrollView>(null);
  const { splits, updateSplits, getSplitExercises, saveSplitExercises } = useData();

  // Convert SelectionExercise to WorkoutExercise
  const convertToWorkoutExercise = (exercise: {
    id: string;
    name: string;
    bodyPart: string;
  }): ExerciseWithDetails => ({
    ...exercise,
    splitIds: [split.id],
    sets: [],
  });

  // Use exercises directly from the navigation params
  useEffect(() => {
    if (split && split.exercises) {
      console.log('SplitDetailScreen - Loading exercises from route params:', split.exercises.length);
      const exercisesWithDetails = split.exercises.map(ex => ({
        ...ex,
        splitIds: [split.id], // Ensure splitId is present
        sets: (ex as any).sets || [], // Ensure sets array exists, default to empty
      }));
      setExercises(exercisesWithDetails);
    } else {
      console.log('SplitDetailScreen - No exercises found in route params');
      setExercises([]); // Clear exercises if none are passed
    }
  }, [split]); // Depend only on the split object from route params

  // Save exercises to storage whenever they change
  useEffect(() => {
    const saveExercises = async () => {
      if (!isEditing && hasLocalChanges) {
        const updatedSplits = splits.map((splitItem: Split) =>
          splitItem.id === split.id ? { ...split, exercises } : splitItem
        );
        
        const { data: user } = await supabase.auth.getUser();
        await supabase.from("splits").upsert(
          {
            user_id: user.user?.id,
            splits: updatedSplits,
            created_at: Date.now(),
          },
          {
            onConflict: "user_id",
          }
        );
        
        updateSplits(updatedSplits);
        setHasLocalChanges(false);
      }
    };
    saveExercises();
  }, [isEditing, hasLocalChanges, split, exercises, splits, updateSplits]);

  const handleAddExercise = async(newExercises: Exercise[]) => {
    const newSelectedWorkoutExercises = newExercises.map(
      convertToWorkoutExercise
    );
    setExercises((prevExercises: any) => [
      ...prevExercises,
      ...newSelectedWorkoutExercises,
    ]);
    setHasLocalChanges(true);
  };

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
    const newExercises = [...exercises];
    newExercises[index] = {
      ...newExercises[index],
      [field]: parseInt(value) || 0,
    };
    setExercises(newExercises);
    setHasLocalChanges(true);
  };

  const addExerciseButton = (
    <Pressable
      w="100%"
      borderStyle="dashed"
      borderWidth={1}
      borderColor="#6B8EF2"
      bg="transparent"
      borderRadius="lg"
      py={2}
      _pressed={{ opacity: 0.7 }}
      onPress={() => {
        navigation.navigate("ExerciseSelection", {
          onAddExercise: handleAddExercise,
        });
      }}
    >
      <HStack space={2} justifyContent="center" alignItems="center">
        <Icon as={AntDesign} name="plus" color="#6B8EF2" size="sm" />
        <Text color="#6B8EF2" fontSize="md">
          Add Exercise
        </Text>
      </HStack>
    </Pressable>
  );

  return (
    <Box flex={1} bg="#1E2028">
      <Box flex={1}>
        <HStack justifyContent="space-between" alignItems="center" p={4}>
          <HStack space={2} alignItems="center">
            <IconButton
              icon={<Icon as={AntDesign} name="left" color="white" />}
              onPress={() => navigation.goBack()}
              variant="ghost"
            />
            <Text color="white" fontSize="xl" fontWeight="bold">
              {split.name}
            </Text>
          </HStack>
          <IconButton
            icon={
              <Icon
                as={AntDesign}
                name={isEditing ? "check" : "edit"}
                color="white"
              />
            }
            onPress={() => setIsEditing(!isEditing)}
            variant="ghost"
          />
        </HStack>

        <ScrollView
          ref={scrollViewRef}
          flex={1}
          showsVerticalScrollIndicator={false}
        >
          <VStack space={4} p={3}>
            {exercises.length > 0 ? (
              <VStack space={3}>
                {exercises.map((exercise, index) => (
                  <Box
                    key={exercise.id}
                    bg="transparent"
                    p={3}
                    borderRadius="lg"
                    borderWidth={1}
                    borderColor="gray.700"
                  >
                    <HStack justifyContent="space-between" alignItems="center">
                      <HStack space={3} alignItems="center" flex={1}>
                        <Box
                          w="3"
                          h="full"
                          bg={splitColor}
                          position="absolute"
                          left={0}
                          borderRadius="md"
                        />
                        <Text color="gray.400" fontSize="sm" ml={4}>
                          {index + 1}
                        </Text>
                        <Text color="white" fontSize="md">
                          {exercise.name}
                        </Text>
                      </HStack>
                      {isEditing && (
                        <IconButton
                          icon={
                            <Icon
                              as={AntDesign}
                              name="close"
                              color="gray.400"
                            />
                          }
                          onPress={() => handleRemoveExercise(index)}
                          variant="ghost"
                          _pressed={{ opacity: 0.7 }}
                          size="md"
                          p={0}
                        />
                      )}
                    </HStack>
                  </Box>
                ))}

                {isEditing && addExerciseButton}
              </VStack>
            ) : (
              <Box
                bg="transparent"
                borderRadius="lg"
                p={3}
                borderWidth={1}
                borderColor="gray.700"
              >
                <VStack space={5} alignItems="center">
                  <Text color="gray.400" fontSize="lg">
                    Add exercises to {split.name} day
                  </Text>
                  {isEditing && <Box w="100%">{addExerciseButton}</Box>}
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
