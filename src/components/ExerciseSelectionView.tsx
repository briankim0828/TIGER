import React, { useState, useEffect } from "react";
import {
  Box,
  Center,
  HStack,
  VStack,
  Text,
  Pressable,
  Button,
  ButtonIcon,
  ButtonText,
  ScrollView,
  Icon,
  Divider,
} from "@gluestack-ui/themed";
import { AntDesign, MaterialIcons, Feather } from "@expo/vector-icons";
import {
  Exercise,
  BODY_PARTS,
  DEFAULT_EXERCISES_BY_BODY_PART,
  Split,
} from "../types";
import { useData } from "../contexts/DataContext";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { CommonActions } from "@react-navigation/native";
import { useWorkout } from "../contexts/WorkoutContext";

// Define the navigation param list potentially used by this screen OR the screens it navigates to
// This might need adjustment based on your full navigation structure
type WorkoutStackParamList = {
  WorkoutMain: undefined;
  SplitDetail: { split: Split; newlyAddedExercises?: Exercise[] };
  ExerciseSelectionModalScreen: undefined; // Ensure this matches App.tsx
  // Add other routes as needed
};

type NavigationProp = NativeStackNavigationProp<WorkoutStackParamList>;

// Icon mapping for body parts
const BODY_PART_ICONS: Record<string, any> = {
  Chest: <MaterialIcons name="fitness-center" size={16} />,
  Back: <MaterialIcons name="fitness-center" size={16} />,
  Legs: <MaterialIcons name="fitness-center" size={16} />,
  Arms: <MaterialIcons name="fitness-center" size={16} />,
  Shoulders: <MaterialIcons name="fitness-center" size={16} />,
  Core: <MaterialIcons name="fitness-center" size={16} />,
  Cardio: <Feather name="heart" size={16} />,
};

const ExerciseSelectionView = () => {
  const navigation = useNavigation<NavigationProp>();

  const onClose = () => {
    navigation.goBack();
  };

  const { bodyPartSections, exercises: allExercises } = useData();
  const [selectedBodyPart, setSelectedBodyPart] = useState<string | null>(null);
  const [selectedExercises, setSelectedExercises] = useState<Exercise[]>([]);
  const [exercisesByBodyPart, setExercisesByBodyPart] = useState<
    Record<string, Exercise[]>
  >({});

  const { addExercisesToCurrentSession } = useWorkout();

  // Prepare exercises by body part for the selection view
  useEffect(() => {
    const finalExercisesByBodyPart: Record<string, Exercise[]> = {};

    // 1. Initialize with the latest defaults from types/index.ts
    BODY_PARTS.forEach((bodyPart) => {
        finalExercisesByBodyPart[bodyPart] = DEFAULT_EXERCISES_BY_BODY_PART[bodyPart].map(ex => ({
            ...ex, // Start with default properties (name, bodyPart, id)
            splitIds: [], // Initialize splitIds for the Exercise type
        }));
    });

    // 2. Process exercises from DataContext (allExercises)
    // These might be custom exercises or contain updates (like splitIds) for defaults
    if (allExercises && allExercises.length > 0) {
        allExercises.forEach((exerciseFromContext) => {
            const { bodyPart, id } = exerciseFromContext;

            // Ensure body part group exists (might be a custom exercise for a standard body part)
            if (!finalExercisesByBodyPart[bodyPart]) {
                finalExercisesByBodyPart[bodyPart] = []; 
            }

            // Check if this exercise (by ID) exists in the current default list for this body part
            const defaultIndex = finalExercisesByBodyPart[bodyPart].findIndex(ex => ex.id === id);

            if (defaultIndex !== -1) {
                // It's a default exercise. Update it with data from context (like splitIds).
                // Crucially, keep the name and bodyPart from the DEFAULT list.
                finalExercisesByBodyPart[bodyPart][defaultIndex] = {
                    ...exerciseFromContext, // Get properties like splitIds from context
                    name: finalExercisesByBodyPart[bodyPart][defaultIndex].name, // Ensure default name is used
                    bodyPart: finalExercisesByBodyPart[bodyPart][defaultIndex].bodyPart, // Ensure default body part is used
                    id: finalExercisesByBodyPart[bodyPart][defaultIndex].id, // Ensure default id is used
                };
            } else {
                // It's not in the defaults, likely a user-created exercise. Add it.
                // Check if it was already added in this loop to prevent duplicates if allExercises has repeats
                if (!finalExercisesByBodyPart[bodyPart].some(ex => ex.id === id)) {
                    finalExercisesByBodyPart[bodyPart].push(exerciseFromContext);
                }
            }
        });
    }

    // Optional: Ensure exercises within each body part list are unique by ID one last time
    for (const bodyPart in finalExercisesByBodyPart) {
        const uniqueExercises: Exercise[] = [];
        const seenIds = new Set<string>();
        for (const exercise of finalExercisesByBodyPart[bodyPart]) {
            if (!seenIds.has(exercise.id)) {
                uniqueExercises.push(exercise);
                seenIds.add(exercise.id);
            }
        }
        finalExercisesByBodyPart[bodyPart] = uniqueExercises;
    }

    console.log('ExerciseSelectionView - Final combined exercises:', 
      Object.keys(finalExercisesByBodyPart).map(bp => ({
        bodyPart: bp,
        count: finalExercisesByBodyPart[bp].length,
        exercises: finalExercisesByBodyPart[bp].map(ex => `${ex.name} (ID: ${ex.id})`) // Log with ID for clarity
      }))
    );

    setExercisesByBodyPart(finalExercisesByBodyPart);
  }, [allExercises]);

  const handleBodyPartSelect = (bodyPart: string) => {
    setSelectedBodyPart(bodyPart);
  };

  const handleExerciseSelect = (exercise: Exercise) => {
    setSelectedExercises((prev) => {
      // If exercise is already selected, remove it
      if (prev.some((e) => e.id === exercise.id)) {
        return prev.filter((e) => e.id !== exercise.id);
      }
      // Otherwise add the full Exercise object
      return [...prev, exercise];
    });
  };

  const handleAddExercises = () => {
    if (selectedExercises.length > 0) {
      console.log(`ExerciseSelectionView - Adding ${selectedExercises.length} exercises via context.`);
      // Call the context function directly
      addExercisesToCurrentSession(selectedExercises);
      // Navigate back to the previous screen (ActiveWorkoutModal)
      navigation.goBack();
    }
  };

  const isExerciseSelected = (exerciseId: string) => {
    return selectedExercises.some((e) => e.id === exerciseId);
  };

  return (
    <Box backgroundColor="#232530" height="90%" borderRadius="$2xl" shadowRadius="$9">
      {/* Header */}
      <Box backgroundColor="#1A1C24" p="$4" borderTopRadius="$2xl">
        <HStack alignItems="center" space="md">
          <Icon
            as={MaterialIcons}
            name="fitness-center"
            color="#6B8EF2"
            size="sm"
          />
          <Text color="$white" fontSize="$lg" fontWeight="$bold">
            Select Exercises
          </Text>
        </HStack>
      </Box>

      {/* Content */}
      <Box flex={1} borderBottomRadius="$2xl" overflow="hidden">
        <HStack space="$0" height="$full">
          {/* Body Parts - 30% */}
          <Box width="30%" backgroundColor="#1A1C24">
            <ScrollView showsVerticalScrollIndicator={false}>
              {BODY_PARTS.map((bodyPart) => (
                <Pressable
                  key={bodyPart}
                  onPress={() => handleBodyPartSelect(bodyPart)}
                  py="$4"
                  px="$3"
                  backgroundColor={
                    selectedBodyPart === bodyPart
                      ? "rgba(107, 142, 242, 0.1)"
                      : "transparent"
                  }
                  sx={{
                    ":pressed": {
                      backgroundColor: "rgba(107, 142, 242, 0.05)"
                    }
                  }}
                >
                  <Text
                    color={selectedBodyPart === bodyPart ? "$white" : "$gray400"}
                    fontWeight={
                      selectedBodyPart === bodyPart ? "$semibold" : "$normal"
                    }
                  >
                    {bodyPart}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                onPress={() => handleBodyPartSelect('My Exercises')}
                py="$4"
                px="$3"
                backgroundColor={
                  selectedBodyPart === 'My Exercises'
                    ? "rgba(107, 142, 242, 0.1)"
                    : "transparent"
                }
                sx={{
                  ":pressed": {
                    backgroundColor: "rgba(107, 142, 242, 0.05)"
                  }
                }}
              >
                <Text
                  color={selectedBodyPart === 'My Exercises' ? "$white" : "$gray400"}
                  fontWeight={
                    selectedBodyPart === 'My Exercises' ? "$semibold" : "$normal"
                  }
                >
                  My Exercises
                </Text>
              </Pressable>

            </ScrollView>
          </Box>

          {/* Right Side VStack - 70% */}
          <VStack width="70%" height="$full" backgroundColor="#232530">
            {/* Selected Exercises Preview */}
            {selectedExercises.length > 0 && (
              <Box
                backgroundColor="#1A1C24"
                p="$3"
                borderBottomWidth="$1"
                borderColor="$gray700"
              >
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <HStack space="sm">
                    {selectedExercises.map((exercise, index) => (
                      <Pressable
                        key={exercise.id}
                        onPress={() => handleExerciseSelect(exercise)}
                        backgroundColor="rgba(107, 142, 242, 0.15)"
                        px="$3"
                        py="$1.5"
                        borderRadius="$full"
                        flexDirection="row"
                        alignItems="center"
                      >
                        <Text color="$white" fontSize="$sm" mr="$2">
                          {exercise.name}
                        </Text>
                        <Icon
                          as={AntDesign}
                          name="close"
                          color="$white"
                          size="xs"
                        />
                      </Pressable>
                    ))}
                  </HStack>
                </ScrollView>
              </Box>
            )}

            {/* Exercises List */}
            <Box flex={1}>
              <ScrollView p="$3" flex={1} showsVerticalScrollIndicator={false}>
                {selectedBodyPart && exercisesByBodyPart[selectedBodyPart] ? (
                  exercisesByBodyPart[selectedBodyPart].map((exercise) => (
                    <Pressable
                      key={exercise.id}
                      onPress={() => handleExerciseSelect(exercise)}
                      py="$3"
                      px="$4"
                      mb="$2"
                      backgroundColor={
                        isExerciseSelected(exercise.id)
                          ? "rgba(107, 142, 242, 0.15)"
                          : "transparent"
                      }
                      borderRadius="$lg"
                      sx={{
                        ":pressed": {
                          opacity: 0.7
                        }
                      }}
                    >
                      <HStack
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <Text color="$white" fontSize="$md">
                          {exercise.name}
                        </Text>
                        {isExerciseSelected(exercise.id) && (
                          <Center width="$6" height="$6" backgroundColor="#6B8EF2" borderRadius="$full">
                            <Icon
                              as={AntDesign}
                              name="check"
                              color="$white"
                              size="xs"
                            />
                          </Center>
                        )}
                      </HStack>
                    </Pressable>
                  ))
                ) : (
                  selectedBodyPart === 'My Exercises' ?
                    <HStack space="md">
                      <Text color="$white" fontSize="$sm">
                        My Exercises
                      </Text>
                    </HStack>
                    :
                    <Center flex={1} p="$4">
                      <Icon
                        as={MaterialIcons}
                        name="category"
                        color="$gray500"
                        size="xl"
                        mb="$2"
                      />
                      <Text color="$gray400" textAlign="center">
                        Select a body part to see available exercises
                      </Text>
                    </Center>
                )}
              </ScrollView>
            </Box>

            {/* Buttons */}
            <Box backgroundColor="#232530" p="$3">
              <Divider backgroundColor="$gray700" mb="$3" />
              <HStack justifyContent="space-between">
                <Button
                  variant="outline"
                  borderColor="$gray600"
                  onPress={onClose || (() => navigation.goBack())}
                  flex={1}
                  mr="$2"
                >
                  <ButtonText color="$gray400">Cancel</ButtonText>
                </Button>
                <Button
                  backgroundColor="#6B8EF2"
                  sx={{
                    ":pressed": {
                      backgroundColor: "#5A7CD0"
                    }
                  }}
                  disabled={selectedExercises.length === 0}
                  opacity={selectedExercises.length > 0 ? 1 : 0.5}
                  onPress={handleAddExercises}
                  flex={1}
                >
                  <ButtonIcon as={AntDesign} name="plus" color="$white" size="sm" />
                  <ButtonText fontSize="$sm">{`Add (${selectedExercises.length})`}</ButtonText>
                </Button>
              </HStack>
            </Box>
          </VStack>
        </HStack>
      </Box>
    </Box>
  );
};

export default ExerciseSelectionView;
