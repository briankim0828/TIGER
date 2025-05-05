import React, { useMemo, useCallback } from "react";
import {
  Box,
  HStack,
  Text,
  VStack,
  Icon,
  Pressable,
  Collapse,
} from "native-base";
import { AntDesign } from "@expo/vector-icons";
import { Exercise, Split, WEEKDAYS } from "../types";

// Interface for body part section data used internally
interface BodyPartSectionData {
  id: string;
  bodyPart: string;
  exercises: Exercise[];
}

// Define the desired order of body parts
const BODY_PART_ORDER: string[] = [
  'Chest',
  'Back',
  'Legs',
  'Shoulders',
  'Arms',
  'Core',
  'Cardio',
];

// --- Sub-Components ---

const ExerciseItem = React.memo(
  ({
    exercise,
    splits,
    isExpanded,
    onToggle,
    isPressDisabled,
  }: {
    exercise: Exercise;
    splits: Split[];
    isExpanded: boolean;
    onToggle: (id: string) => void;
    isPressDisabled: boolean;
  }) => {
    const splitColors = useMemo(() => {
      return exercise.splitIds.reduce((acc, splitId) => {
        const split = splits.find((s) => s.id === splitId);
        acc[splitId] = split?.color || "#2A2E38";
        return acc;
      }, {} as Record<string, string>);
    }, [exercise.splitIds, splits]);

    const dayAssignments = useMemo(() => {
      return WEEKDAYS.reduce((acc, day) => {
        acc[day] = exercise.splitIds.some((splitId) => {
          const split = splits.find((s) => s.id === splitId);
          return split?.days.includes(day);
        });
        return acc;
      }, {} as Record<string, boolean>);
    }, [exercise.splitIds, splits]);

    return (
      <Pressable
        onPress={() => onToggle(exercise.id)}
        bg="#1E2028" // Match theme background
        p={1.5}
        borderRadius="md"
        position="relative"
        disabled={isPressDisabled} // Disable press based on edit mode
        opacity={isPressDisabled ? 0.6 : 1} // Dim when disabled
      >
        <HStack justifyContent="space-between" alignItems="center">
          <HStack space={2} alignItems="center" flex={1}>
            <Icon
              as={AntDesign}
              name={isExpanded ? "down" : "right"}
              color="gray.400"
              size="sm"
            />
            <Text color="white" fontSize="md">
              {exercise.name}
            </Text>
          </HStack>
          <HStack space={1}>
            {exercise.splitIds.map((splitId) => (
              <Box
                key={splitId}
                w="2"
                h="6"
                bg={splitColors[splitId]}
                borderRadius="full"
              />
            ))}
          </HStack>
        </HStack>

        <Collapse isOpen={isExpanded && !isPressDisabled} duration={250}>
          <Box mt={2} pt={2} borderTopWidth={1} borderColor="gray.700">
            <HStack space={2} flexWrap="wrap" justifyContent="space-between">
              {WEEKDAYS.map((day) => (
                <Text
                  key={day}
                  color={dayAssignments[day] ? "#6B8EF2" : "gray.400"}
                  fontSize="xs" // Smaller font size for days
                  flex={1}
                  textAlign="center"
                  fontWeight={dayAssignments[day] ? "bold" : "normal"}
                >
                  {day.slice(0, 3)} {/* Abbreviate day */} 
                </Text>
              ))}
            </HStack>
          </Box>
        </Collapse>
      </Pressable>
    );
  }
);

const BodyPartSection = React.memo(
  ({
    bodyPart,
    exercises,
    splits,
    expandedExercises,
    onToggle,
    isFirstItem,
    isPressDisabled,
  }: {
    bodyPart: string;
    exercises: Exercise[];
    splits: Split[];
    expandedExercises: string[];
    onToggle: (id: string) => void;
    isFirstItem?: boolean;
    isPressDisabled: boolean;
  }) => {
    return (
      // <Box mt={isFirstItem ? 0 : 1}> {/* Adjust margin */} 
      <Box mt={-5}> {/* Adjust margin */} 
        <Text color="gray.400" fontSize="sm" mb={2}>
          {bodyPart}
        </Text>
        <VStack space={2}>
          {exercises.map((exercise) => (
            <ExerciseItem
              key={exercise.id}
              exercise={exercise}
              splits={splits}
              isExpanded={expandedExercises.includes(exercise.id)}
              onToggle={onToggle}
              isPressDisabled={isPressDisabled}
            />
          ))}
        </VStack>
      </Box>
    );
  }
);

// Optimized list component (simplified, only iterates data)
const OptimizedExerciseList = React.memo(
  ({
    data,
    renderItem,
  }: {
    data: BodyPartSectionData[];
    renderItem: ({ item, index }: { item: BodyPartSectionData; index: number }) => React.ReactElement;
  }) => {
    if (!data || data.length === 0) {
      return null;
    }
    return (
      <VStack space={7} width="100%">
        {data.map((item, index) => (
          <React.Fragment key={item.id}>
            {renderItem({ item, index })}
          </React.Fragment>
        ))}
      </VStack>
    );
  }
);

// --- Data Processing Hook ---

const useProcessedExercises = (splits: Split[]): BodyPartSectionData[] => {
  return useMemo(() => {
     if (!splits || splits.length === 0) {
      return [];
    }

    // 1. Extract and deduplicate exercises, aggregating splitIds
    const exerciseMap = new Map<string, Exercise & { splitIds: string[] }>();
    splits.forEach((split) => {
      if (split.exercises && Array.isArray(split.exercises)) {
        split.exercises.forEach((exercise) => {
          if (exercise && exercise.id && exercise.name && exercise.bodyPart) {
            const existing = exerciseMap.get(exercise.id);
            if (existing) {
              if (!existing.splitIds.includes(split.id)) {
                existing.splitIds.push(split.id);
              }
            } else {
              exerciseMap.set(exercise.id, {
                ...exercise,
                splitIds: [split.id],
                // Ensure sets is initialized if needed by Exercise type (might not be needed here)
                // sets: (exercise as any).sets || undefined 
              });
            }
          } else {
            console.warn("MyExercises: Found invalid exercise structure in split:", split.id, exercise);
          }
        });
      } else {
         console.warn("MyExercises: Found split with missing or invalid exercises array:", split.id);
      }
    });
    const exercises = Array.from(exerciseMap.values());

    // 2. Group exercises by body part
    const exercisesByBodyPart = exercises.reduce((acc, exercise) => {
      const bodyPart = exercise.bodyPart || 'Uncategorized'; // Handle potential missing bodyPart
      if (!acc[bodyPart]) {
        acc[bodyPart] = [];
      }
      acc[bodyPart].push(exercise);
      return acc;
    }, {} as Record<string, (Exercise & { splitIds: string[] })[]>);

    // 3. Create ordered sections based on BODY_PART_ORDER
    const bodyPartSections = BODY_PART_ORDER.reduce((acc, bodyPart) => {
      if (exercisesByBodyPart[bodyPart]) {
        acc.push({
          id: bodyPart,
          bodyPart,
          // Sort exercises alphabetically within each section
          exercises: exercisesByBodyPart[bodyPart].sort((a, b) => a.name.localeCompare(b.name)),
        });
      }
      return acc;
    }, [] as BodyPartSectionData[]);

    // Add any remaining uncategorized exercises at the end
    if (exercisesByBodyPart['Uncategorized']) {
         bodyPartSections.push({
            id: 'Uncategorized',
            bodyPart: 'Uncategorized',
            exercises: exercisesByBodyPart['Uncategorized'].sort((a, b) => a.name.localeCompare(b.name)),
         });
    }

    return bodyPartSections;

  }, [splits]);
};

// --- Main Component ---

interface MyExercisesProps {
  splits: Split[];
  editMode: "none" | "program" | "splits";
  expandedExercises: string[];
  onToggleExerciseExpansion: (exerciseId: string) => void;
}

const MyExercises: React.FC<MyExercisesProps> = ({
  splits,
  editMode,
  expandedExercises,
  onToggleExerciseExpansion,
}) => {

  const bodyPartSections = useProcessedExercises(splits);
  const isPressDisabled = useMemo(() => editMode !== 'none', [editMode]);

  // Render function for body parts - useCallback ensures stability
  const renderBodyPartSection = useCallback(
    ({ item, index }: { item: BodyPartSectionData; index: number }) => (
      <BodyPartSection
        bodyPart={item.bodyPart}
        exercises={item.exercises}
        splits={splits} // Pass original splits down for color/day info
        expandedExercises={expandedExercises}
        onToggle={onToggleExerciseExpansion}
        isFirstItem={index === 0}
        isPressDisabled={isPressDisabled}
      />
    ),
    [splits, expandedExercises, onToggleExerciseExpansion, isPressDisabled] // Dependencies
  );

  return (
    <VStack space={4} width="100%" mt={2}> {/* Add margin top */}
      <HStack justifyContent="space-between" alignItems="center">
        <Text color="white" fontSize="xl" fontWeight="bold">
          My Exercises
        </Text>
        {/* Optional: Add an Edit button here if needed in the future */}
      </HStack>

      {bodyPartSections.length === 0 ? (
        <Text color="gray.400" fontSize="sm" textAlign="center" py={4}>
          No exercises added yet. Add exercises within a split.
        </Text>
      ) : (
        <OptimizedExerciseList
          data={bodyPartSections}
          renderItem={renderBodyPartSection}
        />
      )}
    </VStack>
  );
};

export default MyExercises; 