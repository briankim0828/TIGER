import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  Box,
  HStack,
  Text,
  Icon,
  VStack,
  Pressable,
  IconButton,
  ScrollView,
  Collapse,
} from "native-base";
import { AntDesign, Entypo } from "@expo/vector-icons";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView as RNScrollView,
  Keyboard,
  Dimensions,
  TouchableWithoutFeedback,
  View,
  TextInput,
} from "react-native";
import { dataService } from "../services/data";
import Animated, {
  useAnimatedStyle,
  withTiming,
  useSharedValue,
  withSequence,
  withDelay,
} from "react-native-reanimated";
import { Exercise, Split, WEEKDAYS, WeekDay } from "../types";
import { useData } from "../contexts/DataContext";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { WorkoutStackParamList } from "./WorkoutMain";
import { parseFontSize } from "../../helper/fontsize";
import { newUuid } from "../utils/ids";
import { getUserSplitsFromSupabase, saveSplitsToSupabase } from "../supabase/supabaseSplits";

type NavigationProp = NativeStackNavigationProp<WorkoutStackParamList>;

// Interface for body part section data
export interface BodyPartSectionData {
  id: string;
  bodyPart: string;
  exercises: Exercise[];
}

// Define the EditMode type here
type EditMode = "none" | "program" | "splits";

const COLORS = [
  "#1254a1",
  "#00C2C7",
  "#1d7322",
  "#b0b02a",
  "#db7e2c",
  "#D72638",
];

// Helper function to get abbreviated day names
const getAbbreviatedDay = (day: WeekDay): string => {
  return day.slice(0, 3);
};

// const ColorBar = ({ color }: { color?: string }) => (
//   <Box w="full" h="2" bg={color || 'transparent'} borderTopRadius="lg" />
// );

// Memoized exercise item component
const ExerciseItem = React.memo(
  ({
    exercise,
    splits,
    isExpanded,
    onToggle,
  }: {
    exercise: Exercise;
    splits: Split[];
    isExpanded: boolean;
    onToggle: (id: string) => void;
  }) => {
    // Memoize the split colors lookup
    const splitColors = useMemo(() => {
      return exercise.splitIds.reduce((acc, splitId) => {
        const split = splits.find((s) => s.id === splitId);
        acc[splitId] = split?.color || "#2A2E38";
        return acc;
      }, {} as Record<string, string>);
    }, [exercise.splitIds, splits]);

    // Memoize the day assignments lookup
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
        bg="#1E2028"
        p={1.5}
        borderRadius="md"
        position="relative"
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

        <Collapse isOpen={isExpanded} duration={250}>
          <Box mt={2} pt={2} borderTopWidth={1} borderColor="gray.700">
            <HStack space={2} flexWrap="wrap" justifyContent="space-between">
              {WEEKDAYS.map((day) => (
                <Text
                  key={day}
                  color={dayAssignments[day] ? "#6B8EF2" : "gray.400"}
                  fontSize="sm"
                  flex={1}
                  textAlign="center"
                  fontWeight={dayAssignments[day] ? "bold" : "normal"}
                >
                  {day}
                </Text>
              ))}
            </HStack>
          </Box>
        </Collapse>
      </Pressable>
    );
  }
);

// Memoized body part section component
const BodyPartSection = React.memo(
  ({
    bodyPart,
    exercises,
    splits,
    expandedExercises,
    onToggle,
    isFirstItem,
  }: {
    bodyPart: string;
    exercises: Exercise[];
    splits: Split[];
    expandedExercises: string[];
    onToggle: (id: string) => void;
    isFirstItem?: boolean;
  }) => {
    return (
      <Box mt={isFirstItem ? 2 : 1} >
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
            />
          ))}
        </VStack>
      </Box>
    );
  }
);

// Create an optimized component for the exercise list
const OptimizedExerciseList = React.memo(
  ({
    data,
    renderItem,
    extraData,
    editMode,
  }: {
    data: BodyPartSectionData[];
    renderItem: ({ item, index }: { item: BodyPartSectionData; index: number }) => React.ReactElement;
    extraData: any[];
    editMode: string;
  }) => {
    // Log the data prop received by the component
    // useEffect(() => {
    //     console.log("OptimizedExerciseList: Received data prop:", JSON.stringify(data?.map(sec => ({ bodyPart: sec.bodyPart, count: sec.exercises.length })), null, 2));
    // }, [data]);

    // If no data, render nothing
    if (!data || data.length === 0) {
      // console.log("OptimizedExerciseList: Rendering null because data is empty.");
      return null;
    }

    // console.log(`OptimizedExerciseList: Rendering VStack with ${data.length} sections.`);
    return (
      <VStack space={2} width="100%">
        {data.map((item, index) => (
          <React.Fragment key={item.id}>
            {renderItem({ item, index })}
          </React.Fragment>
        ))}
      </VStack>
    );
  }
);

// Get first letter of text
const getFirstLetter = (text: string) => {
  return text.charAt(0).toUpperCase();
};

// Memoized weekday item component
const WeekdayItem = React.memo(
  ({
    day,
    splits = [],
    isSelected,
    onPress,
    isEditing,
  }: {
    day: WeekDay;
    splits: Split[];
    isSelected: boolean;
    onPress: () => void;
    isEditing: boolean;
  }) => {
    const daySplits = splits?.length > 0 ? splits.filter((split) => split.days.includes(day)) : [];
    const color =
      daySplits.length > 0 ? daySplits[0].color || "#3A3E48" : "#3A3E48";

    // Get the day's position in the week (0 for Monday, 6 for Sunday)
    const dayIndex = WEEKDAYS.indexOf(day);

    // Animation values for the arrow
    const arrowOpacity = useSharedValue(0);
    const arrowTranslateY = useSharedValue(-20); // Start from below

    // Animate arrow when editing state changes
    useEffect(() => {
      if (isEditing) {
        // When appearing, cascade from Monday (index 0) to Sunday (index 6)
        const delay = dayIndex * 50; // 50ms delay between each day
        arrowOpacity.value = withSequence(
          withDelay(delay + 100, withTiming(1, { duration: 200 }))
        );
        arrowTranslateY.value = withSequence(
          withDelay(delay + 100, withTiming(0, { duration: 200 }))
        );
      } else if (!isSelected) {
        // Only hide arrows if not editing AND not selected
        // When disappearing, cascade from Sunday (index 6) to Monday (index 0)
        const delay = (6 - dayIndex) * 50; // Reverse delay for disappearing
        arrowOpacity.value = withSequence(
          withDelay(delay, withTiming(0, { duration: 150 }))
        );
        arrowTranslateY.value = withSequence(
          withDelay(delay, withTiming(-20, { duration: 150 }))
        );
      }
    }, [isEditing, dayIndex, isSelected]);

    const arrowAnimatedStyle = useAnimatedStyle(() => {
      return {
        opacity: arrowOpacity.value,
        transform: [{ translateY: arrowTranslateY.value }],
      };
    });

    return (
      <Pressable onPress={onPress} flex={1} mx={0.5}>
        <VStack space={1} alignItems="center">
          <Text
            color={isSelected ? "#6B8EF2" : "gray.400"}
            fontSize="xs"
            fontWeight="bold"
          >
            {getAbbreviatedDay(day)}
          </Text>
          <Box
            bg="#2A2E38"
            p={2}
            borderRadius="lg"
            w="full"
            h="60px"
            justifyContent="center"
            alignItems="center"
            position="relative"
            overflow="hidden"
          >
            <Box
              position="absolute"
              top={0}
              left={0}
              right={0}
              bottom={0}
              borderRadius="lg"
              borderWidth={isSelected ? 2 : 0}
              borderColor="#6B8EF2"
              zIndex={2}
            />
            <Box
              position="absolute"
              top={0}
              left={0}
              right={0}
              h="2"
              bg={color}
              borderTopRadius="lg"
              zIndex={1}
            />
            {daySplits.length > 0 ? (
              <Text
                color="white"
                fontSize="md"
                fontWeight="bold"
                textAlign="center"
              >
                {getFirstLetter(daySplits[0].name)}
              </Text>
            ) : (
              <Icon as={AntDesign} name="plus" color="white" size="lg" />
            )}
          </Box>
          <Animated.View style={arrowAnimatedStyle}>
            <Icon
              as={AntDesign}
              name="up"
              color={isSelected ? "#6B8EF2" : "gray.400"}
              size="xs"
            />
          </Animated.View>
        </VStack>
      </Pressable>
    );
  }
);

// Add this before the WorkoutScreen component:
const SplitItem = React.memo(
  ({
    split,
    isEditingSplits,
    selectedDay,
    onPress,
    onNameEdit,
    onColorSelect,
    onDelete,
    onFocusScroll,
    editMode,
    editingSplitId,
  }: {
    split: Split;
    isEditingSplits: boolean;
    selectedDay: string | null;
    onPress: () => void;
    onNameEdit: (text: string) => void;
    onColorSelect: (color: string) => void;
    onDelete: () => void;
    onFocusScroll: (y: number, height: number) => void;
    editMode: "none" | "program" | "splits";
    editingSplitId: string | null;
  }) => {
    const isThisSplitEditing = isEditingSplits && split.id === editingSplitId;

    // Animation values
    const borderColor = useSharedValue("#3A3E48");
    const pressBorderColor = useSharedValue("#3A3E48");
    const arrowOpacity = useSharedValue(1);
    const arrowRotation = useSharedValue(0);
    const menuOpacity = useSharedValue(0);
    const menuTranslateX = useSharedValue(20);
    const menuWidth = useSharedValue(0);
    const contentShiftX = useSharedValue(0);
    const [inputValue, setInputValue] = useState(split.name);

    // Update value when split name changes (for example when switching between splits)
    useEffect(() => {
      setInputValue(split.name);
    }, [split.name]);

    // Update border color when selection changes
    useEffect(() => {
      borderColor.value = withTiming(
        selectedDay !== null && !isThisSplitEditing ? "#6B8EF2" : "#3A3E48",
        { duration: 200 }
      );
    }, [selectedDay, isThisSplitEditing]);

    // Update arrow, menu, width, and content shift based on editMode and isThisSplitEditing
    useEffect(() => {
      const isSplitsModeActive = editMode === "splits";
      const showMenu = isSplitsModeActive && !isThisSplitEditing;
      const showArrow = editMode !== "program" && !isThisSplitEditing;

      const targetMenuWidth = showMenu ? 25 : 0;
      const gapReduction = 18; // Reduce gap by this amount
      const targetContentShift = showMenu ? -targetMenuWidth + gapReduction : 0;

      // Menu Animation
      menuOpacity.value = withTiming(showMenu ? 1 : 0, { duration: 200 });
      menuTranslateX.value = withTiming(showMenu ? 0 : 20, { duration: 200 });
      menuWidth.value = withTiming(targetMenuWidth, { duration: 200 });

      // Arrow Animation
      arrowOpacity.value = withTiming(showArrow ? 1 : 0, { duration: 200 });
      arrowRotation.value = withTiming(isSplitsModeActive ? 90 : 0, { duration: 200 });

      // Content Shift Animation (uses adjusted value)
      contentShiftX.value = withTiming(targetContentShift, { duration: 200 });

    }, [editMode, isThisSplitEditing]);

    const borderAnimatedStyle = useAnimatedStyle(() => {
      return {
        borderColor: isThisSplitEditing ? "white" : borderColor.value,
      };
    });

    const pressBorderAnimatedStyle = useAnimatedStyle(() => {
      return {
        borderColor: pressBorderColor.value,
      };
    });

    // Arrow style
    const arrowAnimatedStyle = useAnimatedStyle(() => {
      return {
        opacity: arrowOpacity.value,
        transform: [
          { rotateZ: `${arrowRotation.value}deg` }
        ],
      };
    });

    // Menu style (includes width)
    const menuAnimatedStyle = useAnimatedStyle(() => {
      return {
        width: menuWidth.value, // Apply animated width
        opacity: menuOpacity.value,
        transform: [
          { translateX: menuTranslateX.value }
        ],
      };
    });

    // Content shift style
    const contentShiftAnimatedStyle = useAnimatedStyle(() => {
      return {
        transform: [
          { translateX: contentShiftX.value }
        ],
      };
    });

    const handlePressIn = () => {
      if (!isEditingSplits) {
        pressBorderColor.value = withTiming("#6B8EF2", { duration: 150 });
      }
    };

    const handlePressOut = () => {
      if (!isEditingSplits) {
        pressBorderColor.value = withTiming("#3A3E48", { duration: 150 });
      }
    };

    // Handle text change locally and propagate up via onNameEdit
    const handleTextChange = (text: string) => {
      setInputValue(text);
      onNameEdit(text);
    };

    const calculatedFontSize = useMemo(() => parseFontSize("lg"), []);

    return (
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        bg="#2A2E38"
        p={3}
        pl={6}
        borderRadius={12}
        position="relative"
      >
        <Animated.View
          style={[
            {
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              borderRadius: 12,
              borderWidth: 0,
              zIndex: 2,
            },
            borderAnimatedStyle,
          ]}
          pointerEvents="none"
        />
        <Animated.View
          style={[
            {
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              borderRadius: 12,
              borderWidth: 1,
              zIndex: 3,
            },
            pressBorderAnimatedStyle,
          ]}
          pointerEvents="none"
        />
        <Box
          position="absolute"
          top={0}
          left={0}
          bottom={0}
          w="3"
          bg={split.color || "#3A3E48"}
          borderTopLeftRadius={12}
          borderBottomLeftRadius={12}
          zIndex={1}
          pointerEvents="none"
        />
        <HStack justifyContent="space-between" alignItems="center">
          {isThisSplitEditing ? (
            <HStack flex={1} space={2} alignItems="center">
              <Box flex={1}>
                <TextInput
                  value={inputValue}
                  onChangeText={handleTextChange}
                  placeholder="Enter split name"
                  placeholderTextColor="rgba(255, 255, 255, 0.4)"
                  style={{ color: "white", fontSize: calculatedFontSize }}
                  autoFocus={true}
                  onFocus={(event: any) => {
                    // Check if event.nativeEvent.target exists and is a number
                    // RN doesn't always provide layout info directly in onFocus event
                    // A common pattern is to measure the input layout using its ref
                    // For simplicity, let's skip the complex scroll logic onFocus for now
                    // if (typeof event.nativeEvent.target === 'number') { 
                    //   // Need to measure layout here, onFocus doesn't give coordinates
                    // }
                  }}
                />
              </Box>
              <Text color="white" fontSize="sm">
                {split.exercises.length} exercises
              </Text>
              <IconButton
                icon={<Icon as={AntDesign} name="close" color="red.500" size="md" />}
                onPress={onDelete}
                variant="ghost"
                size="sm"
              />
            </HStack>
          ) : (
            <>
              <Text color="white" fontSize="lg" fontWeight="bold" flex={1} numberOfLines={1} ellipsizeMode="tail">
                {split.name}
              </Text>
              <HStack alignItems="center" space={0}>
                <Animated.View style={contentShiftAnimatedStyle}>
                  <HStack space={3} alignItems="center">
                    <Text color="white" fontSize="sm">
                      {split.exercises.length} exercises
                    </Text>
                    <Animated.View style={arrowAnimatedStyle}>
                      <Icon
                        as={AntDesign}
                        name="right"
                        color="gray.400"
                        size="sm"
                      />
                    </Animated.View>
                  </HStack>
                </Animated.View>
                <Animated.View style={[menuAnimatedStyle, { justifyContent: 'center', alignItems: 'center' }]} >
                  <Icon
                    as={Entypo}
                    name="menu"
                    color="gray.400"
                    size="md"
                  />
                </Animated.View>
              </HStack>
            </>
          )}
        </HStack>
        {isThisSplitEditing && (
          <HStack space={2} mt={2} justifyContent="space-between">
            {COLORS.map((color) => (
              <Pressable
                key={color}
                onPress={() => {
                  if (editMode !== "splits") return;
                  onColorSelect(color);
                }}
                flex={1}
              >
                <Box
                  bg={color}
                  h="6"
                  borderRadius="md"
                  borderWidth={split.color === color ? 2 : 0}
                  borderColor="white"
                />
              </Pressable>
            ))}
          </HStack>
        )}
      </Pressable>
    );
  }
);

const WorkoutScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const scrollViewRef = useRef<RNScrollView>(null);
  const { splits, updateSplits } = useData();

  // --- State Variables --- 
  const [editMode, setEditMode] = useState<EditMode>("none");
  const [editingSplitId, setEditingSplitId] = useState<string | null>(null);
  const [editedSplits, setEditedSplits] = useState<Split[] | null>(null);
  const editedSplitsRef = useRef<Split[] | null>(null);
  const [selectedDay, setSelectedDay] = useState<WeekDay | null>(null);
  const [selectedSplit, setSelectedSplit] = useState<Split | null>(null);
  const [isFirstMount, setIsFirstMount] = useState(true);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const [expandedExercises, setExpandedExercises] = useState<string[]>([]);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const isInitialLoadRef = useRef(true);
  const processedDataRef = useRef<{
    exercises: Exercise[];
    exercisesByBodyPart: Record<string, Exercise[]>;
    bodyPartSections: BodyPartSectionData[];
  }>({
    exercises: [],
    exercisesByBodyPart: {},
    bodyPartSections: [],
  });
  const [exercises, setExercises] = useState<Exercise[]>([]);

  // Modified getUserSplits to use the imported function
  const getUserSplits = useCallback(async () => {
    console.log("WorkoutScreen: Fetching user splits...");
    const fetchedSplits = await getUserSplitsFromSupabase();
    if (fetchedSplits) {
      console.log(`WorkoutScreen: Received ${fetchedSplits.length} splits from Supabase.`);
      // Update local context state with fetched data
      updateSplits(fetchedSplits);
    } else {
      console.error("WorkoutScreen: Failed to fetch splits from Supabase or none found.");
      // Optionally handle error or empty state, e.g., updateSplits([])
    }
  }, [updateSplits]); // Dependency is on updateSplits from context

  useEffect(() => {
    if (isFirstMount) {
      getUserSplits();
      setIsFirstMount(false);
    }
  }, [isFirstMount, getUserSplits]);

  const setEditModeWithDebug = (newMode: EditMode) => {
    if (newMode === "splits" && editMode !== "splits") {
      const initialSplits = JSON.parse(JSON.stringify(splits || []));
      setEditedSplits(initialSplits);
      editedSplitsRef.current = initialSplits;
      console.log("WorkoutScreen: Entering splits edit mode.");
    } else if (newMode !== "splits" && editMode === "splits") {
      setEditedSplits(null);
      editedSplitsRef.current = null;
      setEditingSplitId(null);
      console.log("WorkoutScreen: Exiting splits edit mode.");
    }
    if (newMode === "program" && editMode === "splits") {
       setEditingSplitId(null);
    }
    setEditMode(newMode);
  };

  // Toggle program edit mode - Ensure selectedDay/Split are reset
  const toggleProgramEditMode = async () => {
    console.log("toggleProgramEditMode called. Current mode:", editMode);
    if (editMode === "program") {
      setSelectedDay(null); // Ensure reset
      setSelectedSplit(null); // Ensure reset
      console.log("WorkoutScreen: Saving splits via toggleProgramEditMode...");
      const success = await saveSplitsToSupabase(splits); // Save the context splits
      if (success) {
         console.log("WorkoutScreen: Splits saved successfully via toggleProgramEditMode.");
      } else {
         console.error("WorkoutScreen: Failed to save splits via toggleProgramEditMode.");
      }
      setEditModeWithDebug("none");
    } else if (editMode === "none") {
      setEditModeWithDebug("program");
    }
  };

  // --- Single Definitions for Edit Handlers --- 

  const handleSplitNameEdit = useCallback(
    (id: string, newName: string) => {
      console.log(`WorkoutScreen: handleSplitNameEdit for ID: ${id}, Name: ${newName}`);
      let newState: Split[] | null = null;
      setEditedSplits(prev => {
        newState = prev?.map(split => 
        split.id === id ? { ...split, name: newName } : split
          ) ?? null;
        editedSplitsRef.current = newState; // Update ref
        console.log("Ref updated in handleSplitNameEdit"); 
        return newState; // Update state
      });
    },
    [] 
  );

  const handleColorSelect = useCallback(
    async (id: string, color: string) => {
      console.log(`WorkoutScreen: handleColorSelect for ID: ${id}, Color: ${color}`);
      let newState: Split[] | null = null;
      setEditedSplits(prev => {
        newState = prev?.map(split =>
            split.id === id ? { ...split, color } : split
          ) ?? null;
        editedSplitsRef.current = newState; // Update ref
        console.log("Ref updated in handleColorSelect");
        return newState; // Update state
      });
    },
    []
  );

  const handleAddSplit = useCallback(async () => {
    console.log("WorkoutScreen: handleAddSplit");
    const newSplit: Split = {
      id: newUuid(),
      name: `Split ${(editedSplitsRef.current?.length ?? splits.length) + 1}`,
      color: "#FF5733",
      days: [],
      exercises: [],
    };
    let newState: Split[] | null = null;
    setEditedSplits(prev => {
        newState = [...(prev ?? []), newSplit];
        editedSplitsRef.current = newState; // Update ref
        console.log("Ref updated in handleAddSplit");
        return newState; // Update state
      }
    );
  }, [splits]); // Keep splits dep for length fallback

  const handleDeleteSplit = useCallback(
    async (id: string) => {
      console.log(`WorkoutScreen: handleDeleteSplit for ID: ${id}`);
      let newState: Split[] | null = null;
      setEditedSplits(prev => {
          newState = prev?.filter(split => split.id !== id) ?? null;
          editedSplitsRef.current = newState; // Update ref
          console.log("Ref updated in handleDeleteSplit");
          return newState; // Update state
        }
      );
    },
    []
  );

  // --- Toggle and Save Logic --- 
  const toggleSplitsEditMode = useCallback(async () => {
    const currentEditedSplits = editedSplitsRef.current;
    if (editMode === "splits") {
      if (currentEditedSplits) {
        console.log("WorkoutScreen: Saving edited splits...");
        const success = await saveSplitsToSupabase(currentEditedSplits);
        if (success) {
          updateSplits(currentEditedSplits); 
        } else {
          console.error("WorkoutScreen: Failed to save splits.");
        }
      }
      setEditModeWithDebug("none");
    } else {
      setEditModeWithDebug("splits");
    }
  }, [editMode, updateSplits, setEditModeWithDebug]);

  // handleSplitDetailUpdate - Dependencies look okay now
  const handleSplitDetailUpdate = useCallback(
    async (updatedSplit: Split) => {
      console.log("Updating split details:", {
        updatedSplit,
        currentSplits: splits,
      });

      // Only update local state, Supabase will be updated when user presses "Done"
      const updatedSplits = splits.map((split: Split) =>
        split.id === updatedSplit.id ? updatedSplit : split
      );
      updateSplits(updatedSplits);
    },
    [splits, updateSplits]
  );

  const toggleExerciseExpansion = useCallback(
    (exerciseId: string) => {
      // Only allow exercise expansion when not in edit mode
      if (editMode !== "none") {
        return;
      }

      setExpandedExercises((prev) => {
        if (prev.includes(exerciseId)) {
          return prev.filter((id) => id !== exerciseId);
        } else {
          return [...prev, exerciseId];
        }
      });
    },
    [editMode]
  );

  // Function to handle input focus for the keyboard
  const handleFocusScroll = (inputY: number, inputHeight: number) => {
    // Only respond to input focus in splits edit mode
    if (editMode !== "splits") {
      return;
    }

    const screenHeight = Dimensions.get("window").height;
    const keyboardHeight = screenHeight * 0.4; // Approximate keyboard height
    const visibleHeight = screenHeight - keyboardHeight;
    const inputBottom = inputY + inputHeight;
    const keyboardTop = screenHeight - keyboardHeight;

    // Calculate how much of the input is below the keyboard
    const inputBelowKeyboard = inputBottom - keyboardTop;

    if (inputBelowKeyboard > 0) {
      // Add some padding (20) to ensure the input is fully visible
      const targetScrollPosition = scrollY + inputBelowKeyboard + 20;

      if (scrollViewRef.current) {
        scrollViewRef.current.scrollTo({
          y: targetScrollPosition,
          animated: true,
        });
      }
    }
  };

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

  // Optimize data processing
  const processSplitsData = useCallback((splitsData: Split[]) => {
    // console.log("WorkoutScreen: processSplitsData received:", JSON.stringify(splitsData?.map(s => ({ id: s.id, name: s.name, exercisesCount: s.exercises?.length ?? 0 })), null, 2));

    // 1. Extract exercises from all splits
    const exercises = splitsData.reduce((acc, split) => {
      // Ensure split.exercises exists and is an array before iterating
      if (split.exercises && Array.isArray(split.exercises)) {
          split.exercises.forEach((exercise) => {
            // Basic validation of exercise structure
            if (exercise && exercise.id && exercise.name && exercise.bodyPart) {
                const existingExercise = acc.find((e) => e.id === exercise.id);
                if (existingExercise) {
                    if (!existingExercise.splitIds.includes(split.id)) {
                        existingExercise.splitIds.push(split.id);
                    }
                } else {
                    acc.push({
                        ...exercise,
                        splitIds: [split.id],
                        // Ensure sets is initialized if needed by Exercise type
                        sets: (exercise as any).sets || undefined
                    });
                }
            } else {
                 console.warn("WorkoutScreen: processSplitsData found invalid exercise structure in split:", split.id, exercise);
            }
        });
      } else {
         console.warn("WorkoutScreen: processSplitsData found split with missing or invalid exercises array:", split.id);
      }
      return acc;
    }, [] as Exercise[]);
    // console.log("WorkoutScreen: processSplitsData generated exercises array:", JSON.stringify(exercises.map(e => ({id: e.id, name: e.name, bodyPart: e.bodyPart, splitIds: e.splitIds})), null, 2));

    // 2. Group exercises by body part
    const exercisesByBodyPart = exercises.reduce((acc, exercise) => {
      if (!acc[exercise.bodyPart]) {
        acc[exercise.bodyPart] = [];
      }
      acc[exercise.bodyPart].push(exercise);
      return acc;
    }, {} as Record<string, Exercise[]>);
    // console.log("WorkoutScreen: processSplitsData grouped exercises by body part:", JSON.stringify(Object.keys(exercisesByBodyPart).map(bp => ({ bodyPart: bp, count: exercisesByBodyPart[bp].length })), null, 2));

    // 3. Create ordered sections
    const bodyPartSections = BODY_PART_ORDER.reduce((acc, bodyPart) => {
      if (exercisesByBodyPart[bodyPart]) {
        acc.push({
          id: bodyPart,
          bodyPart,
          exercises: exercisesByBodyPart[bodyPart],
        });
      }
      return acc;
    }, [] as BodyPartSectionData[]);
    // console.log("WorkoutScreen: processSplitsData created bodyPartSections:", JSON.stringify(bodyPartSections.map(sec => ({ bodyPart: sec.bodyPart, count: sec.exercises.length })), null, 2));

    return { exercises, exercisesByBodyPart, bodyPartSections };
  }, []); // BODY_PART_ORDER is constant, no need to add as dep

  // Update processed data when splits change
  useEffect(() => {
    if (splits && splits.length > 0) {
      const processedData = processSplitsData(splits);
      processedDataRef.current = processedData;
      setExercises(processedData.exercises);
    } else {
      processedDataRef.current = { exercises: [], exercisesByBodyPart: {}, bodyPartSections: [] };
      setExercises([]);
    }
  }, [splits, processSplitsData]); // Keep dependencies

  // --- Ensure these callbacks exist --- 

  const handleDaySelect = useCallback(
    (day: WeekDay) => {
      if (editMode !== "program") return;
      if (selectedDay === day) {
        setSelectedDay(null);
        setSelectedSplit(null);
        return;
      }
      setSelectedDay(day);
    },
    [selectedDay, editMode, setSelectedDay, setSelectedSplit] // Added missing state setters
  );

  const handleSplitSelect = useCallback(
    async (split: Split) => {
      if (!selectedDay || editMode !== "program") return;
      const updatedSplits = splits.map((s) => {
        const daysWithoutSelected = s.days.filter((d) => d !== selectedDay);
        if (s.id === split.id) {
          return { ...s, days: [...daysWithoutSelected, selectedDay] };
        }
        return { ...s, days: daysWithoutSelected };
      });
      console.log("Updated splits after assignment:", updatedSplits);
      updateSplits(updatedSplits);
      setSelectedDay(null);
      setSelectedSplit(null);
    },
    [selectedDay, editMode, splits, updateSplits, setSelectedDay, setSelectedSplit] // Added missing deps
  );

  const handleSplitPress = useCallback(
    (split: Split) => {
      if (selectedDay && editMode === "program") {
        handleSplitSelect(split);
        return;
      }
      if (editMode === "splits") {
        setEditingSplitId(prevId => prevId === split.id ? null : split.id);
        return;
      }
      if (editMode === "none") {
        navigation.navigate("SplitDetail", { split });
      }
    },
    [selectedDay, editMode, handleSplitSelect, navigation, setEditingSplitId]
  );

  // --- End Callbacks --- 

  // Memoized calculation for body part sections
  const bodyPartSections = useMemo(() => {
    return processedDataRef.current?.bodyPartSections || [];
  }, [exercises]); // Depends on exercises state which is updated after processing

  // Log the final bodyPartSections state passed to the list
  // useEffect(() => {
  //     console.log("WorkoutScreen: Final bodyPartSections state variable updated:", JSON.stringify(bodyPartSections.map(sec => ({ bodyPart: sec.bodyPart, count: sec.exercises.length })), null, 2));
  // }, [bodyPartSections]);

  // Render function for body parts
  const renderBodyPartSection = useCallback(
    ({ item, index }: { item: BodyPartSectionData; index: number }) => (
      <BodyPartSection
        bodyPart={item.bodyPart}
        exercises={item.exercises}
        splits={splits}
        expandedExercises={expandedExercises}
        onToggle={toggleExerciseExpansion}
        isFirstItem={index === 0}
      />
    ),
    [splits, expandedExercises, toggleExerciseExpansion] // Dependencies
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === "ios" ? 30 : 0}
    >
      <TouchableWithoutFeedback
        onPress={() => {
          Keyboard.dismiss();
        }}
      >
        <Box flex={1} bg="#1E2028" pt={0}>
          <ScrollView
            ref={scrollViewRef}
            flex={1}
            automaticallyAdjustKeyboardInsets={true}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={true}
            contentContainerStyle={{
              paddingBottom: keyboardHeight > 0 ? keyboardHeight + 20 : 20,
            }}
            onScroll={(e) => {
              setScrollY(e.nativeEvent.contentOffset.y);
            }}
            scrollEventThrottle={16}
          >
            <VStack space={3} p={4}>
              <HStack
                justifyContent="space-between"
                alignItems="center"
                width="full"
              >
                <Text color="white" fontSize="2xl" fontWeight="bold">
                  My Program
                </Text>
                {editMode !== "splits" && (
                  <Pressable onPress={toggleProgramEditMode}>
                    <Box w="20">
                      <Text
                        color="#6B8EF2"
                        fontSize="14"
                        fontWeight="bold"
                        textAlign="right"
                      >
                        {editMode === "program" ? "Done" : "Edit"}
                      </Text>
                    </Box>
                  </Pressable>
                )}
              </HStack>

              <HStack justifyContent="space-between" mx={-2} px={1}>
                {WEEKDAYS.map((day) => (
                  <WeekdayItem
                    key={day}
                    day={day}
                    splits={splits}
                    isSelected={selectedDay === day}
                    onPress={() => handleDaySelect(day)}
                    isEditing={editMode === "program"}
                  />
                ))}
              </HStack>

              <VStack space={4}>
                <HStack
                  justifyContent="space-between"
                  alignItems="center"
                  width="full"
                  pb={2}
                >
                  <Text color="white" fontSize="xl" fontWeight="bold">
                    My Splits
                  </Text>
                  {editMode !== "program" && (
                    <Pressable onPress={toggleSplitsEditMode}>
                      <Box w="20">
                        <Text
                          color="#6B8EF2"
                          fontSize="14"
                          fontWeight="bold"
                          textAlign="right"
                        >
                          {editMode === "splits" ? "Done" : "Edit"}
                        </Text>
                      </Box>
                    </Pressable>
                  )}
                </HStack>

                <VStack space={2}>
                  {(splits.length === 0 && editMode !== 'splits') ? (
                    <Text color="gray.400" fontSize="sm" textAlign="center">
                      Tell us about your workout split!
                    </Text>
                  ) : (
                    (editMode === 'splits' ? editedSplits : splits)?.map((split) => (
                      <SplitItem
                        key={split.id}
                        split={split}
                        isEditingSplits={editMode === "splits"}
                        editingSplitId={editingSplitId}
                        selectedDay={selectedDay}
                        onPress={() => handleSplitPress(split)}
                        onNameEdit={(text: string) => handleSplitNameEdit(split.id, text)}
                        onColorSelect={(color: string) => handleColorSelect(split.id, color)}
                        onDelete={() => handleDeleteSplit(split.id)}
                        onFocusScroll={handleFocusScroll}
                        editMode={editMode}
                      />
                    ))
                  )}
                  {editMode === "splits" && (
                    <Pressable
                      onPress={handleAddSplit}
                      bg="#1E2028"
                      p={2}
                      borderRadius="md"
                      borderWidth={1}
                      borderColor={splits.length >= 7 ? "gray.600" : "#6B8EF2"}
                      borderStyle="dashed"
                      opacity={splits.length >= 7 ? 0.5 : 1}
                      disabled={splits.length >= 7}
                    >
                      <HStack justifyContent="center" alignItems="center" space={2}>
                        <Icon as={AntDesign} name="plus" color={splits.length >= 7 ? "gray.400" : "#6B8EF2"} size="sm" />
                        <Text color={splits.length >= 7 ? "gray.400" : "#6B8EF2"} fontSize="sm" fontWeight="bold">
                          {splits.length >= 7 ? "Maximum splits reached" : "Add Split"}
                        </Text>
                      </HStack>
                    </Pressable>
                  )}
                </VStack>

                <VStack space={4}>
                  <HStack justifyContent="space-between" alignItems="center" pt={4}>
                    <Text color="white" fontSize="xl" fontWeight="bold">
                      My Exercises
                    </Text>
                  </HStack>

                  {(exercises.length === 0 && bodyPartSections.length === 0) ? (
                    <Text color="gray.400" fontSize="sm" textAlign="center">
                      No Exercises added yet.
                    </Text>
                  ) : (
                    <OptimizedExerciseList
                      data={bodyPartSections}
                      renderItem={renderBodyPartSection}
                      extraData={[splits, expandedExercises]}
                      editMode={editMode}
                    />
                  )}
                </VStack>
              </VStack>
            </VStack>
          </ScrollView>
        </Box>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

export default WorkoutScreen;
