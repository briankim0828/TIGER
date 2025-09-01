import React, { useMemo, useCallback } from "react";
import {
  Box,
  HStack,
  Text,
  VStack,
  Icon,
  Pressable,
} from "@gluestack-ui/themed";
import { AntDesign } from "@expo/vector-icons";
import Animated, { 
  useAnimatedStyle, 
  withTiming, 
  useSharedValue 
} from "react-native-reanimated";
import { WEEKDAYS } from "../types";
import { ProgramSplitWithExercises, ProgramExerciseLite } from "../types/ui";

// Interface for body part section data used internally
interface BodyPartSectionData {
  id: string;
  bodyPart: string;
  exercises: (ProgramExerciseLite & { splitIds: string[] })[];
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
    exercise: ProgramExerciseLite & { splitIds: string[] };
    splits: ProgramSplitWithExercises[];
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

    const heightValue = useSharedValue(0);
    const [contentHeight, setContentHeight] = React.useState(0);
    
    const animatedHeight = useAnimatedStyle(() => ({
      height: heightValue.value,
      overflow: 'hidden'
    }));

    React.useEffect(() => {
      if (isExpanded && !isPressDisabled) {
        heightValue.value = withTiming(contentHeight, { duration: 250 });
      } else {
        heightValue.value = withTiming(0, { duration: 250 });
      }
    }, [isExpanded, isPressDisabled, contentHeight]);

    return (
      <Pressable
        onPress={() => onToggle(exercise.id)}
        style={{
          backgroundColor: "#1E2028",
          padding: 6,
          borderRadius: 6,
          position: "relative",
          opacity: isPressDisabled ? 0.6 : 1,
        }}
        disabled={isPressDisabled}
      >
        <HStack justifyContent="space-between" alignItems="center">
          <HStack style={{ gap: 8, alignItems: "center", flex: 1 }}>
            {/* @ts-ignore */}
            <Icon as={AntDesign as any} name={isExpanded ? "down" : "right"} color="#A1A1AA" size="sm" />
            <Text color="white" style={{ fontSize: 16 }}>
              {exercise.name}
            </Text>
          </HStack>
          <HStack style={{ gap: 4 }}>
            {exercise.splitIds.map((splitId) => (
              <Box
                key={splitId}
                style={{
                  width: 8,
                  height: 24,
                  backgroundColor: splitColors[splitId],
                  borderRadius: 9999,
                }}
              />
            ))}
          </HStack>
        </HStack>

        <Animated.View style={[animatedHeight]}>
          <Box
            style={{
              position: 'absolute',
              width: '100%',
              opacity: isExpanded ? 1 : 0,
            }}
            onLayout={(event) => {
              const height = event.nativeEvent.layout.height;
              if (height > 0) {
                setContentHeight(height + 8); // Add padding to account for margins
              }
            }}
          >
            <Box
              style={{
                marginTop: 8,
                paddingTop: 8,
                borderTopWidth: 1,
                borderColor: "#374151",
                paddingBottom: 0,
              }}
            >
              <HStack style={{ gap: 8, flexWrap: "wrap", justifyContent: "space-between" }}>
                {WEEKDAYS.map((day) => (
                  <Text
                    key={day}
                    color={dayAssignments[day] ? "#6B8EF2" : "#A1A1AA"}
                    style={{ 
                      fontSize: 12,
                      flex: 1,
                      textAlign: "center",
                      fontWeight: dayAssignments[day] ? "bold" : "normal"
                    }}
                  >
                    {day.slice(0, 3)}
                  </Text>
                ))}
              </HStack>
            </Box>
          </Box>
        </Animated.View>
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
  exercises: (ProgramExerciseLite & { splitIds: string[] })[];
  splits: ProgramSplitWithExercises[];
    expandedExercises: string[];
    onToggle: (id: string) => void;
    isFirstItem?: boolean;
    isPressDisabled: boolean;
  }) => {
    return (
      // <Box mt={isFirstItem ? 0 : 1}> {/* Adjust margin */} 
      <Box style={{ marginTop: -20 }}>
        <Text color="#A1A1AA" style={{ fontSize: 14, marginBottom: 8 }}>
          {bodyPart}
        </Text>
        <VStack style={{ gap: 1 }}>
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
      <VStack style={{ gap: 34, width: "100%" }}>
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

const useProcessedExercises = (splits: ProgramSplitWithExercises[]): BodyPartSectionData[] => {
  return useMemo(() => {
     if (!splits || splits.length === 0) {
      return [];
    }

    // 1. Extract and deduplicate exercises, aggregating splitIds
    const exerciseMap = new Map<string, (ProgramExerciseLite & { splitIds: string[] })>();
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
    }, {} as Record<string, (ProgramExerciseLite & { splitIds: string[] })[]>);

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
  splits: ProgramSplitWithExercises[];
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
    <VStack style={{ gap: 30, width: "100%", marginTop: 16}}>
      <HStack justifyContent="space-between" alignItems="center" pointerEvents="box-none">
        <Text color="white" style={{ fontSize: 20, fontWeight: "bold" }}>
          Exercises
        </Text>
        {/* Optional: Add an Edit button here if needed in the future */}
      </HStack>

      {bodyPartSections.length === 0 ? (
        <Text 
          color="#A1A1AA" 
          style={{ 
            fontSize: 14, 
            textAlign: "center", 
            paddingVertical: 16 
          }}
        >
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