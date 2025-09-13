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
import { BODY_PARTS } from "../types/base";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { CommonActions } from "@react-navigation/native";
import { useDatabase } from "../db/queries";
import { useRoute, RouteProp } from "@react-navigation/native";
import { ProgramSplit } from "../types/ui";
import { registerSelectionCallback, consumeSelectionCallback, ExerciseLite } from "../navigation/selectionRegistry";
import type { ExerciseRow } from "../db/queries/simple";

// Define the navigation param list potentially used by this screen OR the screens it navigates to
// This might need adjustment based on your full navigation structure
type WorkoutStackParamList = {
  WorkoutMain: undefined;
  SplitDetail: { split: ProgramSplit; newlyAddedExercises?: any[] };
  ExerciseSelection: { splitId: string };
  // Generic modal screen can be called in two modes:
  // - Program Builder: { splitId }
  // - Generic selection: { requestId, allowMultiple?: boolean }
  ExerciseSelectionModalScreen:
    | { splitId: string }
    | { requestId: string; allowMultiple?: boolean };
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
  const route = useRoute<RouteProp<WorkoutStackParamList, 'ExerciseSelectionModalScreen'>>();
  // Narrow params
  const splitId = (route.params as any)?.splitId as string | undefined;
  const requestId = (route.params as any)?.requestId as string | undefined;
  const allowMultiple = ((route.params as any)?.allowMultiple as boolean | undefined) ?? true;
  const db = useDatabase();

  const onClose = () => {
    navigation.goBack();
  };

  const [selectedBodyPart, setSelectedBodyPart] = useState<string | null>(null);
  const [selectedExercises, setSelectedExercises] = useState<ExerciseLite[]>([]);
  const [exercisesByBodyPart, setExercisesByBodyPart] = useState<Record<string, { id: string; name: string }[]>>({});

  // Prepare exercises by body part for the selection view
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Load from DB catalog
        const all: ExerciseRow[] = await db.getAllExercises();
        const map: Record<string, { id: string; name: string }[]> = {};
        // Initialize buckets for enum body parts exactly
        BODY_PARTS.forEach((bp) => { map[bp] = []; });

        // Normalize arbitrary body_part strings to our enum labels
        const normalizeBodyPart = (val?: string | null): string => {
          if (!val) return 'Core';
          const v = String(val).trim().toLowerCase();
          if (v.startsWith('chest')) return 'Chest';
          if (v.startsWith('back')) return 'Back';
          if (v === 'leg' || v.startsWith('legs')) return 'Legs';
          if (v.startsWith('arm') || v.includes('bicep') || v.includes('tricep')) return 'Arms';
          if (v.startsWith('shoulder')) return 'Shoulders';
          if (v.startsWith('core') || v.includes('abs')) return 'Core';
          if (v.startsWith('cardio') || v.includes('run') || v.includes('treadmill') || v.includes('bike')) return 'Cardio';
          return 'Core';
        };

        for (const ex of all) {
          const bp = normalizeBodyPart(ex.bodyPart);
          map[bp].push({ id: ex.id, name: ex.name });
        }
        if (!cancelled) {
          setExercisesByBodyPart(map);
          // Default to first tab with items, else first enum
          const firstWithItems = BODY_PARTS.find((bp) => map[bp]?.length > 0) ?? BODY_PARTS[0];
          setSelectedBodyPart(firstWithItems);
        }
      } catch (e) {
        console.error('ExerciseSelectionView: failed to load exercises', e);
      }
    })();
    return () => { cancelled = true; };
  }, [db]);

  const handleBodyPartSelect = (bodyPart: string) => {
    setSelectedBodyPart(bodyPart);
  };

  const handleExerciseSelect = (exercise: ExerciseLite) => {
    setSelectedExercises((prev) => {
      const exists = prev.some((e) => e.id === exercise.id);
      if (exists) return prev.filter((e) => e.id !== exercise.id);
      if (!allowMultiple) return [exercise];
      return [...prev, exercise];
    });
  };

  const handleAddExercises = async () => {
    if (selectedExercises.length === 0) {
      navigation.goBack();
      return;
    }
    // Mode 1: Program Builder (split editing)
    if (splitId) {
      try {
        await db.addExercisesToSplit(splitId, selectedExercises.map(e => e.id), { avoidDuplicates: true });
        navigation.goBack();
      } catch (err) {
        console.error('ExerciseSelectionView: failed to add exercises to split', err);
      }
      return;
    }
    // Mode 2: Generic selection via requestId
    if (requestId) {
      try {
        const cb = consumeSelectionCallback(requestId);
        if (cb) await cb(selectedExercises);
      } catch (e) {
        console.error('ExerciseSelectionView: selection callback failed', e);
      } finally {
        navigation.goBack();
      }
    } else {
      // No route params matched; just close
      navigation.goBack();
    }
  };

  const isExerciseSelected = (exerciseId: string) => {
    return selectedExercises.some((e) => e.id === exerciseId);
  };

  return (
    <Box backgroundColor="#232530" height="90%" borderRadius="$2xl" shadowRadius="$9">
      {/* Header */}
      <Box backgroundColor="#1A1C24" p="$4" borderRadius="$2xl" borderBottomLeftRadius={0} borderBottomRightRadius={0}>
        <HStack alignItems="center" space="md">
          {/* @ts-ignore Icon typing for vector icons */}
          <Icon as={MaterialIcons as any} name="fitness-center" color="#6B8EF2" size="sm" />
          <Text color="$white" fontSize="$lg" fontWeight="$bold">
            Select Exercises
          </Text>
        </HStack>
      </Box>

      {/* Content */}
  <Box flex={1} borderRadius="$2xl" borderTopLeftRadius={0} borderTopRightRadius={0} overflow="hidden">
  <HStack height="$full">
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
                        {/* @ts-ignore Icon typing for vector icons */}
                        <Icon as={AntDesign as any} name="close" color="$white" size="xs" />
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
                             {/* @ts-ignore Icon typing for vector icons */}
                             <Icon as={AntDesign as any} name="check" color="$white" size="xs" />
                           </Center>
                         )}
                      </HStack>
                    </Pressable>
                  ))
                ) : (
                  <Center flex={1} p="$4">
                    {/* @ts-ignore Icon typing for vector icons */}
                    <Icon as={MaterialIcons as any} name="category" color="$gray500" size="xl" mb="$2" />
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
                  {/* @ts-ignore ButtonIcon typing for vector icons */}
                  <ButtonIcon as={AntDesign as any} name="plus" color="$white" size="sm" />
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
