import React, { useState, useEffect } from "react";
import {
  Box,
  Center,
  HStack,
  VStack,
  Text,
  Pressable,
  Button,
  ScrollView,
  Icon,
  Divider,
  IconButton,
} from "native-base";
import { AntDesign, MaterialIcons, Feather } from "@expo/vector-icons";
import {
  Exercise,
  BODY_PARTS,
  DEFAULT_EXERCISES_BY_BODY_PART,
  Split,
} from "../types";
import { useData } from "../contexts/DataContext";
import { useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

type WorkoutStackParamList = {
  WorkoutMain: undefined;
  SplitDetail: { split: Split };
  ExerciseSelection: undefined;
};

type NavigationProp = NativeStackNavigationProp<WorkoutStackParamList>;

interface ExerciseSelectionViewProps {
  onClose?: () => void;
  onAddExercise?: (exercises: Exercise[]) => void;
}

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
  const router: any = useRoute();

  const onClose = () => {
    navigation.goBack();
  };

  const { bodyPartSections, exercises: allExercises } = useData();
  const [selectedBodyPart, setSelectedBodyPart] = useState<string | null>(null);
  const [selectedExercises, setSelectedExercises] = useState<Exercise[]>([]);
  const [exercisesByBodyPart, setExercisesByBodyPart] = useState<
    Record<string, Exercise[]>
  >({});

  // Prepare exercises by body part for the selection view
  useEffect(() => {
    // Group exercises by body part
    const groupedExercises: Record<string, Exercise[]> = {};

    // First initialize with all default exercises
    BODY_PARTS.forEach((bodyPart) => {
      const defaultExercises = DEFAULT_EXERCISES_BY_BODY_PART[bodyPart].map(
        (ex) => ({
          ...ex,
          splitIds: [],
        })
      );
      groupedExercises[bodyPart] = [...defaultExercises];
    });

    // Then, add or update exercises from the data store
    if (allExercises.length > 0) {
      allExercises.forEach((exercise) => {
        if (!groupedExercises[exercise.bodyPart]) {
          groupedExercises[exercise.bodyPart] = [];
        }
        
        // Check if this exercise already exists in the group
        const existingIndex = groupedExercises[exercise.bodyPart].findIndex(
          ex => ex.id === exercise.id
        );
        
        if (existingIndex >= 0) {
          // Update existing exercise
          groupedExercises[exercise.bodyPart][existingIndex] = exercise;
        } else {
          // Add new exercise
          groupedExercises[exercise.bodyPart].push(exercise);
        }
      });
    }

    // Log the exercises to debug
    console.log('ExerciseSelectionView - Initialized exercises:', 
      Object.keys(groupedExercises).map(bodyPart => ({
        bodyPart,
        count: groupedExercises[bodyPart].length,
        exercises: groupedExercises[bodyPart].map(ex => ex.name)
      }))
    );

    setExercisesByBodyPart(groupedExercises);
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
      // Otherwise add it to the end of the array
      return [...prev, exercise];
    });
  };

  const handleAddExercises = () => {
    if (selectedExercises.length > 0) {
      router?.params?.onAddExercise?.(selectedExercises);
      navigation.goBack();
      // Reset selections
      setSelectedBodyPart(null);
      setSelectedExercises([]);
    }
  };

  const isExerciseSelected = (exerciseId: string) => {
    return selectedExercises.some((e) => e.id === exerciseId);
  };

  return (
    <Box bg="#232530" height="90%" borderRadius="2xl" shadow={9}>
      {/* Header */}
      <Box bg="#1A1C24" p={4} borderTopRadius="2xl">
        <HStack alignItems="center" space={2}>
          <Icon
            as={MaterialIcons}
            name="fitness-center"
            color="#6B8EF2"
            size="sm"
          />
          <Text color="white" fontSize="lg" fontWeight="bold">
            Select Exercises
          </Text>
        </HStack>
      </Box>

      {/* Content */}
      <Box flex={1} borderBottomRadius="2xl" overflow="hidden">
        <HStack space={0} h="full">
          {/* Body Parts - 30% */}
          <Box w="30%" bg="#1A1C24">
            <ScrollView showsVerticalScrollIndicator={false}>
              {BODY_PARTS.map((bodyPart) => (
                <Pressable
                  key={bodyPart}
                  onPress={() => handleBodyPartSelect(bodyPart)}
                  py={4}
                  px={3}
                  bg={
                    selectedBodyPart === bodyPart
                      ? "rgba(107, 142, 242, 0.1)"
                      : "transparent"
                  }
                  _pressed={{ bg: "rgba(107, 142, 242, 0.05)" }}
                >
                  <Text
                    color={selectedBodyPart === bodyPart ? "white" : "gray.400"}
                    fontWeight={
                      selectedBodyPart === bodyPart ? "semibold" : "normal"
                    }
                  >
                    {bodyPart}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                onPress={() => handleBodyPartSelect('My Exercises')}
                py={4}
                px={3}
                bg={
                  selectedBodyPart === 'My Exercises'
                    ? "rgba(107, 142, 242, 0.1)"
                    : "transparent"
                }
                _pressed={{ bg: "rgba(107, 142, 242, 0.05)" }}
              >
                <Text
                  color={selectedBodyPart === 'My Exercises' ? "white" : "gray.400"}
                  fontWeight={
                    selectedBodyPart === 'My Exercises' ? "semibold" : "normal"
                  }
                >
                  My Exercises
                </Text>
              </Pressable>

            </ScrollView>
          </Box>

          {/* Right Side VStack - 70% */}
          <VStack w="70%" h="full" bg="#232530">
            {/* Selected Exercises Preview */}
            {selectedExercises.length > 0 && (
              <Box
                bg="#1A1C24"
                p={3}
                borderBottomWidth={1}
                borderColor="gray.700"
              >
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>

                  <HStack space={2}>
                    {selectedExercises.map((exercise, index) => (
                      <Pressable
                        key={exercise.id}
                        onPress={() => handleExerciseSelect(exercise)}
                        bg="rgba(107, 142, 242, 0.15)"
                        px={3}
                        py={1.5}
                        borderRadius="full"
                        flexDirection="row"
                        alignItems="center"
                      >
                        <Text color="white" fontSize="sm" mr={2}>
                          {exercise.name}
                        </Text>
                        <Icon
                          as={AntDesign}
                          name="close"
                          color="white"
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
              <ScrollView p={3} flex={1} showsVerticalScrollIndicator={false}>
                {selectedBodyPart && exercisesByBodyPart[selectedBodyPart] ? (
                  exercisesByBodyPart[selectedBodyPart].map((exercise) => (
                    <Pressable
                      key={exercise.id}
                      onPress={() => handleExerciseSelect(exercise)}
                      py={3}
                      px={4}
                      mb={2}
                      bg={
                        isExerciseSelected(exercise.id)
                          ? "rgba(107, 142, 242, 0.15)"
                          : "transparent"
                      }
                      borderRadius="lg"
                      _pressed={{ opacity: 0.7 }}
                    >
                      <HStack
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <Text color="white" fontSize="md">
                          {exercise.name}
                        </Text>
                        {isExerciseSelected(exercise.id) && (
                          <Center w={6} h={6} bg="#6B8EF2" borderRadius="full">
                            <Icon
                              as={AntDesign}
                              name="check"
                              color="white"
                              size="xs"
                            />
                          </Center>
                        )}
                      </HStack>
                    </Pressable>
                  ))
                ) : (
                  selectedBodyPart === 'My Exercises' ?
                    <HStack space={2}>
                      <Text color="white" fontSize="sm">
                        My Exercises
                      </Text>
                    </HStack>
                    :
                    <Center flex={1} p={4}>
                      <Icon
                        as={MaterialIcons}
                        name="category"
                        color="gray.500"
                        size="xl"
                        mb={2}
                      />
                      <Text color="gray.400" textAlign="center">
                        Select a body part to see available exercises
                      </Text>
                    </Center>
                )}
              </ScrollView>
            </Box>

            {/* Buttons */}
            <Box bg="#232530" p={3}>
              <Divider bg="gray.700" mb={3} />
              <HStack justifyContent="space-between">
                <Button
                  variant="outline"
                  borderColor="gray.600"
                  _text={{ color: "gray.400" }}
                  onPress={onClose || (() => navigation.goBack())}
                  flex={1}
                  mr={2}
                >
                  Cancel
                </Button>
                <Button
                  bg="#6B8EF2"
                  _pressed={{ bg: "#5A7CD0" }}
                  isDisabled={selectedExercises.length === 0}
                  opacity={selectedExercises.length > 0 ? 1 : 0.5}
                  onPress={handleAddExercises}
                  flex={1}
                  leftIcon={
                    <Icon as={AntDesign} name="plus" color="white" size="sm" />
                  }
                  _text={{ fontSize: "sm" }}
                >
                  {`Add (${selectedExercises.length})`}
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
