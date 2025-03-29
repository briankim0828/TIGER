import React, { useState, useRef, useEffect, useCallback, useMemo, forwardRef } from 'react';
import { Box, HStack, Text, Button, Icon, VStack, Pressable, IconButton, ScrollView, Collapse, Divider } from 'native-base';
import { AntDesign, MaterialIcons, Feather } from '@expo/vector-icons';
import CustomTextInput from '../components/CustomTextInput';
import { KeyboardAvoidingView, Platform, ScrollView as RNScrollView, Keyboard, Dimensions, 
  TouchableWithoutFeedback, View, TextInput, findNodeHandle, NativeEventEmitter, NativeModules, UIManager, FlatList } from 'react-native';
import SplitDetailScreen from './SplitDetailScreen';
import { FlashList } from '@shopify/flash-list';
import { storageService } from '../services/storage';
import Animated, { 
  useAnimatedStyle, 
  withSpring,
  withTiming,
  useSharedValue,
  withSequence,
  withDelay
} from 'react-native-reanimated';

export interface Exercise {
  id: string;
  name: string;
  bodyPart: string;
  splitIds: string[];
}

export interface Split {
  id: string;
  name: string;
  days: string[];
  color?: string;
  exercises: { id: string; name: string; bodyPart: string }[];
}

// Interface for body part section data
export interface BodyPartSectionData {
  id: string;
  bodyPart: string;
  exercises: Exercise[];
}

const COLORS = [
  '#1254a1',
  '#00C2C7',
  '#1d7322',
  '#b0b02a', 
  '#db7e2c', 
  '#D72638' 
];

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const ColorBar = ({ color }: { color?: string }) => (
  <Box w="full" h="2" bg={color || 'transparent'} borderTopRadius="lg" />
);

// Create a wrapper component for CustomTextInput
const FocusAwareInput = ({ onFocusScroll, ...props }: any) => {
  // Use a ref for the parent view instead
  const viewRef = useRef<View>(null);
  
  const handleFocus = () => {
    console.log('DEBUG - FOCUS: Input focused!');
    
    // Use a delay to ensure the keyboard is shown and layout is updated
    setTimeout(() => {
      // Measure the parent view instead of the input directly
      if (viewRef.current) {
        try {
          const handle = findNodeHandle(viewRef.current);
          if (handle) {
            UIManager.measureInWindow(handle, (x, y, width, height) => {
              console.log('DEBUG - FOCUS: View position:', { x, y, width, height });
              console.log('DEBUG - FOCUS: Screen dimensions:', {
                height: Dimensions.get('window').height,
                width: Dimensions.get('window').width
              });
              
              // Pass the position to our scroll handler
              onFocusScroll(y, height);
            });
          } else {
            console.log('DEBUG - FOCUS: Could not get node handle');
          }
        } catch (error) {
          console.log('DEBUG - FOCUS: Error measuring view:', error);
        }
      } else {
        console.log('DEBUG - FOCUS: View ref is null');
      }
    }, 150); // Slightly longer delay to ensure keyboard is shown
  };
  
  return (
    <View ref={viewRef} collapsable={false}>
      <CustomTextInput
        {...props}
        onFocus={handleFocus}
      />
    </View>
  );
};

// Memoized exercise item component
const ExerciseItem = React.memo(({ 
  exercise, 
  splits, 
  isExpanded, 
  onToggle 
}: { 
  exercise: Exercise; 
  splits: Split[];
  isExpanded: boolean;
  onToggle: (id: string) => void;
}) => {
  // Memoize the split colors lookup
  const splitColors = useMemo(() => {
    return exercise.splitIds.reduce((acc, splitId) => {
      const split = splits.find(s => s.id === splitId);
      acc[splitId] = split?.color || "#2A2E38";
      return acc;
    }, {} as Record<string, string>);
  }, [exercise.splitIds, splits]);

  // Memoize the day assignments lookup
  const dayAssignments = useMemo(() => {
    return WEEKDAYS.reduce((acc, day) => {
      acc[day] = exercise.splitIds.some(splitId => {
        const split = splits.find(s => s.id === splitId);
        return split?.days.includes(day);
      });
      return acc;
    }, {} as Record<string, boolean>);
  }, [exercise.splitIds, splits]);

  return (
    <Pressable
      onPress={() => onToggle(exercise.id)}
      bg="#1E2028"
      p={3}
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
          {exercise.splitIds.map(splitId => (
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
            {WEEKDAYS.map(day => (
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
});

// Memoize the SplitDetailScreen component
const MemoizedSplitDetailScreen = React.memo(SplitDetailScreen);

// Memoized body part section component
const BodyPartSection = React.memo(({ 
  bodyPart, 
  exercises, 
  splits, 
  expandedExercises, 
  onToggle,
  isFirstItem
}: { 
  bodyPart: string;
  exercises: Exercise[];
  splits: Split[];
  expandedExercises: string[];
  onToggle: (id: string) => void;
  isFirstItem?: boolean;
}) => {
  return (
    <Box mt={isFirstItem ? 2 : 6}>
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
});

// Create an optimized component for the exercise list
const OptimizedExerciseList = React.memo(({
  data,
  renderItem,
  extraData
}: {
  data: BodyPartSectionData[];
  renderItem: ({ item, index }: { item: BodyPartSectionData; index: number }) => React.ReactElement;
  extraData: any[];
}) => {
  // If no data, render nothing
  if (!data || data.length === 0) return null;
  
  return (
    <View style={{ 
      flex: 1,
      minHeight: 200,
      width: '100%' 
    }}>
      <FlashList
        data={data}
        renderItem={renderItem}
        estimatedItemSize={250}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        scrollEnabled={true}
        extraData={extraData}
        // Add these parameters for better rendering during scrolling
        overrideItemLayout={(layout, item) => {
          // Provide consistent item height estimation
          layout.size = 250;
        }}
        // Increase draw distance to render more items during scrolling
        drawDistance={500}
        // Improve refresh trigger sensitivity
        onRefresh={null}
        refreshing={false}
      />
    </View>
  );
});

// Get first letter of text
const getFirstLetter = (text: string) => {
  return text.charAt(0).toUpperCase();
};

// Memoized weekday item component
const WeekdayItem = React.memo(({ 
  day, 
  splits, 
  isSelected, 
  onPress,
  isEditing
}: { 
  day: string; 
  splits: Split[]; 
  isSelected: boolean; 
  onPress: () => void;
  isEditing: boolean;
}) => {
  const daySplits = splits.filter(split => split.days.includes(day));
  const color = daySplits.length > 0 ? daySplits[0].color || "#3A3E48" : "#3A3E48";
  
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
    } else if (!isSelected) { // Only hide arrows if not editing AND not selected
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
    <Pressable 
      onPress={onPress}
      flex={1}
      mx={0.5}
    >
      <VStack space={1} alignItems="center">
        <Text color={isSelected ? "#6B8EF2" : "gray.400"} fontSize="xs" fontWeight="bold">
          {day}
        </Text>
        <Box
          bg="#2A2E38"
          p={2}
          borderRadius="lg"
          w="full"
          h="16"
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
            <Text color="white" fontSize="md" fontWeight="bold" textAlign="center">
              {getFirstLetter(daySplits[0].name)}
            </Text>
          ) : (
            <Icon 
              as={AntDesign} 
              name="plus" 
              color="white" 
              size="lg"
            />
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
});

// Add this before the WorkoutScreen component:
const SplitItem = React.memo(({ 
  split, 
  isEditingSplits, 
  selectedDay, 
  onPress, 
  onNameEdit, 
  onColorSelect, 
  onDelete,
  onFocusScroll
}: { 
  split: Split;
  isEditingSplits: boolean;
  selectedDay: string | null;
  onPress: () => void;
  onNameEdit: (text: string) => void;
  onColorSelect: (color: string) => void;
  onDelete: () => void;
  onFocusScroll: (y: number, height: number) => void;
}) => {
  // Animation value for border color
  const borderColor = useSharedValue("#3A3E48");

  // Update border color when selection changes
  useEffect(() => {
    borderColor.value = withTiming(
      selectedDay !== null ? "#6B8EF2" : "#3A3E48",
      { duration: 200 }
    );
  }, [selectedDay]);

  const borderAnimatedStyle = useAnimatedStyle(() => {
    return {
      borderColor: borderColor.value,
    };
  });

  return (
    <Pressable
      onPress={onPress}
      bg="transparent"
      p={4}
      pl={6}
      borderRadius="md"
      position="relative"
    >
      <Animated.View 
        style={[{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: 12,
          borderWidth: 1,
          zIndex: 2
        }, borderAnimatedStyle]} 
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
        {isEditingSplits ? (
          <HStack flex={1} space={2} alignItems="center">
            <Box flex={1}>
              <FocusAwareInput
                value={split.name}
                onChangeText={onNameEdit}
                color="white"
                fontSize="lg"
                onFocusScroll={onFocusScroll}
                placeholder="Enter split name"
                placeholderTextColor="rgba(255, 255, 255, 0.4)"
              />
            </Box>
            <Text color="white" fontSize="sm">
              {split.exercises.length} exercises
            </Text>
            <IconButton
              icon={<Icon as={AntDesign} name="close" color="gray.400" size="md" />}
              onPress={onDelete}
              variant="ghost"
              size="sm"
            />
          </HStack>
        ) : (
          <>
            <Text color="white" fontSize="lg" fontWeight="bold">
              {split.name}
            </Text>
            <Text color="white" fontSize="sm">
              {split.exercises.length} exercises
            </Text>
          </>
        )}
      </HStack>
      {isEditingSplits && (
        <HStack space={2} mt={2} justifyContent="space-between">
          {COLORS.map((color) => (
            <Pressable
              key={color}
              onPress={() => onColorSelect(color)}
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
});

const WorkoutScreen = () => {
  const scrollViewRef = useRef<RNScrollView>(null);
  const [splits, setSplits] = useState<Split[]>([]);
  const [isEditingSplits, setIsEditingSplits] = useState(false);
  const [isEditingProgram, setIsEditingProgram] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedSplit, setSelectedSplit] = useState<Split | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedSplitDetail, setSelectedSplitDetail] = useState<Split | null>(null);
  const [expandedExercises, setExpandedExercises] = useState<string[]>([]);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const isInitialLoadRef = useRef(true);
  const isKeyboardVisibleRef = useRef(false);
  const isAnimatingRef = useRef(false);

  // Cache for processed data
  const processedDataRef = useRef<{
    exercises: Exercise[];
    exercisesByBodyPart: Record<string, Exercise[]>;
    bodyPartSections: BodyPartSectionData[];
  }>({
    exercises: [],
    exercisesByBodyPart: {},
    bodyPartSections: []
  });

  // Animation values for edit buttons
  const programEditOpacity = useSharedValue(1);
  const splitsEditOpacity = useSharedValue(1);
  const editTextOpacity = useSharedValue(1);
  const doneTextOpacity = useSharedValue(0);
  const splitsEditTextOpacity = useSharedValue(1);
  const splitsDoneTextOpacity = useSharedValue(0);

  // Initialize animation values on mount
  useEffect(() => {
    // Set initial values without animation
    programEditOpacity.value = 1;
    splitsEditOpacity.value = 1;
    editTextOpacity.value = 1;
    doneTextOpacity.value = 0;
    splitsEditTextOpacity.value = 1;
    splitsDoneTextOpacity.value = 0;
  }, []);

  // Animation effect for program editing state
  useEffect(() => {
    if (isEditingProgram) {
      // When entering program edit mode
      editTextOpacity.value = withTiming(0, { duration: 100 });
      doneTextOpacity.value = withTiming(1, { duration: 100 });
      splitsEditOpacity.value = withTiming(0, { duration: 200 });
    } else {
      // When exiting program edit mode
      editTextOpacity.value = withTiming(1, { duration: 100 });
      doneTextOpacity.value = withTiming(0, { duration: 100 });
      
      // Only show splits edit button if not in splits edit mode
      if (!isEditingSplits) {
        splitsEditOpacity.value = withTiming(1, { duration: 200 });
      }
    }
    
    // Cleanup function to reset values when component unmounts
    return () => {
      // Reset to default values without animation
      editTextOpacity.value = 1;
      doneTextOpacity.value = 0;
    };
  }, [isEditingProgram]);
  
  // Animation effect for splits editing state
  useEffect(() => {
    if (isEditingSplits) {
      // When entering splits edit mode
      splitsEditTextOpacity.value = withTiming(0, { duration: 100 });
      splitsDoneTextOpacity.value = withTiming(1, { duration: 100 });
      programEditOpacity.value = withTiming(0, { duration: 200 });
    } else {
      // When exiting splits edit mode
      splitsEditTextOpacity.value = withTiming(1, { duration: 100 });
      splitsDoneTextOpacity.value = withTiming(0, { duration: 100 });
      
      // Only show program edit button if not in program edit mode
      if (!isEditingProgram) {
        programEditOpacity.value = withTiming(1, { duration: 200 });
      }
    }
    
    // Cleanup function to reset values when component unmounts
    return () => {
      // Reset to default values without animation
      splitsEditTextOpacity.value = 1;
      splitsDoneTextOpacity.value = 0;
    };
  }, [isEditingSplits]);

  const programEditAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: programEditOpacity.value,
    };
  });

  const splitsEditAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: splitsEditOpacity.value,
    };
  });

  const editTextAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: editTextOpacity.value,
    };
  });

  const doneTextAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: doneTextOpacity.value,
    };
  });

  const splitsEditTextAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: splitsEditTextOpacity.value,
    };
  });

  const splitsDoneTextAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: splitsDoneTextOpacity.value,
    };
  });

  // Add animation value for border color
  const borderColor = useSharedValue("#3A3E48");

  // Update border color when selection changes
  useEffect(() => {
    borderColor.value = withTiming(
      selectedDay !== null ? "#6B8EF2" : "#3A3E48",
      { duration: 200 }
    );
  }, [selectedDay]);

  const borderAnimatedStyle = useAnimatedStyle(() => {
    return {
      borderColor: borderColor.value,
    };
  });

  // Optimize data processing
  const processSplitsData = useCallback((splitsData: Split[]) => {
    const exercises = splitsData.reduce((acc, split) => {
      split.exercises.forEach(exercise => {
        const existingExercise = acc.find(e => e.id === exercise.id);
        if (existingExercise) {
          if (!existingExercise.splitIds.includes(split.id)) {
            existingExercise.splitIds.push(split.id);
          }
        } else {
          acc.push({
            ...exercise,
            splitIds: [split.id]
          });
        }
      });
      return acc;
    }, [] as Exercise[]);

    // Group exercises by body part
    const exercisesByBodyPart = exercises.reduce((acc, exercise) => {
      if (!acc[exercise.bodyPart]) {
        acc[exercise.bodyPart] = [];
      }
      acc[exercise.bodyPart].push(exercise);
      return acc;
    }, {} as Record<string, Exercise[]>);

    // Pre-compute bodyPartSections for rendering
    const bodyPartSections = Object.entries(exercisesByBodyPart).map(([bodyPart, bodyPartExercises]) => ({
      id: bodyPart,
      bodyPart,
      exercises: bodyPartExercises
    }));

    return { exercises, exercisesByBodyPart, bodyPartSections };
  }, []);

  // Memoize callbacks
  const handleDaySelect = useCallback((day: string) => {
    if (!isEditingProgram) return;
    
    if (selectedDay === day) {
      setSelectedDay(null);
      setSelectedSplit(null);
      return;
    }
    setSelectedDay(day);
  }, [selectedDay, isEditingProgram]);

  const handleSplitSelect = useCallback((split: Split) => {
    if (!selectedDay) return;
    
    setSplits(prevSplits => {
      // First, remove the selected day from all splits
      const updatedSplits = prevSplits.map(s => ({
        ...s,
        days: s.days.filter(d => d !== selectedDay)
      }));
      
      // Then, add the selected day to the chosen split
      return updatedSplits.map(s => {
      if (s.id === split.id) {
          return {
            ...s,
            days: [...s.days, selectedDay]
          };
        }
        return s;
      });
    });
    
    setSelectedDay(null);
    setSelectedSplit(null);
  }, [selectedDay]);

  // Save current state as default
  const saveCurrentStateAsDefault = useCallback(async () => {
    try {
      await storageService.saveDefaultWorkoutState(splits);
      console.log('Current state saved as default');
    } catch (error) {
      console.error('Error saving default state:', error);
    }
  }, [splits]);

  // Debounced save function
  const debouncedSave = useCallback((data: Split[]) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        console.log('Saving updated splits:', data.length);
        await storageService.saveSplits(data);
      } catch (error) {
        console.error('Error saving splits:', error);
      }
    }, 500); // Reduced to 500ms for faster updates
  }, []);

  // Load splits from storage
  useEffect(() => {
    const loadSplits = async () => {
      if (!isInitialLoadRef.current) return;
      
      try {
        // First check for saved splits (most recent data)
        const loadedSplits = await storageService.getSplits();
        
        if (loadedSplits.length > 0) {
          console.log('Loaded saved splits:', loadedSplits.length);
          setSplits(loadedSplits);
          
          // Process data immediately after loading
          const processedData = processSplitsData(loadedSplits);
          processedDataRef.current = processedData;
          setExercises(processedData.exercises);
        } else {
          // Fall back to default state only if no saved data exists
          const defaultSplits = await storageService.getDefaultWorkoutState();
          if (defaultSplits.length > 0) {
            console.log('Loaded default splits:', defaultSplits.length);
            setSplits(defaultSplits);
            
            // Process data immediately after loading
            const processedData = processSplitsData(defaultSplits);
            processedDataRef.current = processedData;
            setExercises(processedData.exercises);
          }
        }
        
        isInitialLoadRef.current = false;
      } catch (error) {
        console.error('Error loading splits:', error);
      }
    };
    loadSplits();
  }, [processSplitsData]);

  // Update processed data when splits change
  useEffect(() => {
    if (!isInitialLoadRef.current) {
      const processedData = processSplitsData(splits);
      processedDataRef.current = processedData;
      setExercises(processedData.exercises);
    }
  }, [splits, processSplitsData]);

  // Save splits to storage whenever they change
  useEffect(() => {
    if (!isInitialLoadRef.current) {
      debouncedSave(splits);
    }
  }, [splits, debouncedSave]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Memoize the handleSplitPress function
  const handleSplitPress = useCallback((split: Split) => {
    if (selectedDay) {
      if (!isEditingProgram) return;
      handleSplitSelect(split);
      return;
    }
    
    if (!isEditingProgram && !isEditingSplits) {
      setSelectedSplitDetail(split);
    }
  }, [selectedDay, isEditingProgram, isEditingSplits, handleSplitSelect]);

  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        // Set flag to prevent animations during keyboard events
        isKeyboardVisibleRef.current = true;
        setKeyboardHeight(e.endCoordinates.height);
      }
    );

    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
        // Small delay to ensure any related re-renders happen before we allow animations again
        setTimeout(() => {
          isKeyboardVisibleRef.current = false;
        }, 100);
      }
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  const handleSplitNameEdit = useCallback((splitId: string, newName: string) => {
    setSplits(prevSplits => 
      prevSplits.map(split => 
      split.id === splitId ? { ...split, name: newName } : split
      )
      );
  }, []);

  const handleColorSelect = useCallback((splitId: string, color: string) => {
    setSplits(prevSplits => 
      prevSplits.map(split => 
      split.id === splitId ? { ...split, color } : split
      )
    );
  }, []);

  const handleAddSplit = useCallback(() => {
    if (splits.length >= 7) return;
    
    const newSplit: Split = {
      id: Date.now().toString(),
      name: '',
      days: [],
      exercises: [],
      color: undefined
    };
    setSplits(prevSplits => [...prevSplits, newSplit]);
  }, [splits.length]);

  const handleDeleteSplit = useCallback((splitId: string) => {
    setSplits(prevSplits => prevSplits.filter(split => split.id !== splitId));
  }, []);

  const toggleExerciseExpansion = useCallback((exerciseId: string) => {
    setExpandedExercises(prev => {
      if (prev.includes(exerciseId)) {
        return prev.filter(id => id !== exerciseId);
      } else {
        return [...prev, exerciseId];
      }
    });
  }, []);

  // Function to handle input focus for the keyboard
  const handleFocusScroll = (inputY: number, inputHeight: number) => {
    console.log('Input position:', { y: inputY, height: inputHeight });
    
    const screenHeight = Dimensions.get('window').height;
    const keyboardHeight = screenHeight * 0.4; // Approximate keyboard height
    const visibleHeight = screenHeight - keyboardHeight;
    const inputBottom = inputY + inputHeight;
    const keyboardTop = screenHeight - keyboardHeight;
    
    // Calculate how much of the input is below the keyboard
    const inputBelowKeyboard = inputBottom - keyboardTop;
    
    if (inputBelowKeyboard > 0) {
      // Add some padding (20) to ensure the input is fully visible
      const targetScrollPosition = scrollY + inputBelowKeyboard + 20;
      
      console.log('Scrolling to:', targetScrollPosition);
      
      if (scrollViewRef.current) {
        scrollViewRef.current.scrollTo({ y: targetScrollPosition, animated: true });
      }
    }
  };

  // Memoize the onClose and onUpdate handlers
  const handleSplitDetailClose = useCallback(() => {
    setSelectedSplitDetail(null);
  }, []);

  const handleSplitDetailUpdate = useCallback((updatedSplit: Split) => {
    setSplits(prevSplits => 
      prevSplits.map(split => 
        split.id === updatedSplit.id ? updatedSplit : split
      )
    );
  }, []);

  // Memoize the split detail screen props
  const splitDetailScreenProps = useMemo(() => {
    if (!selectedSplitDetail) return null;
    return {
      split: selectedSplitDetail,
      onClose: handleSplitDetailClose,
      onUpdate: handleSplitDetailUpdate
    };
  }, [selectedSplitDetail, handleSplitDetailClose, handleSplitDetailUpdate]);

  // Update the render function to create a stable set of body part sections
  const bodyPartSections = useMemo(() => {
    return Object.entries(processedDataRef.current.exercisesByBodyPart || {}).map(([bodyPart, exercises]) => ({
      id: bodyPart,
      bodyPart,
      exercises,
    }));
  }, [processedDataRef.current.exercisesByBodyPart]);

  // Render function for FlashList
  const renderBodyPartSection = useCallback(({ item, index }: { item: BodyPartSectionData; index: number }) => (
    <BodyPartSection
      bodyPart={item.bodyPart}
      exercises={item.exercises}
      splits={splits}
      expandedExercises={expandedExercises}
      onToggle={toggleExerciseExpansion}
      isFirstItem={index === 0}
    />
  ), [splits, expandedExercises, toggleExerciseExpansion]);

  // Render function for the splits.map section
  const renderSplitItem = useCallback((split: Split) => {
    return (
      <SplitItem
        key={split.id}
        split={split}
        isEditingSplits={isEditingSplits}
        selectedDay={selectedDay}
        onPress={() => handleSplitPress(split)}
        onNameEdit={(text: string) => handleSplitNameEdit(split.id, text)}
        onColorSelect={(color: string) => handleColorSelect(split.id, color)}
        onDelete={() => handleDeleteSplit(split.id)}
        onFocusScroll={handleFocusScroll}
      />
    );
  }, [isEditingSplits, selectedDay, handleSplitPress, handleSplitNameEdit, handleColorSelect, handleDeleteSplit, handleFocusScroll]);

  if (selectedSplitDetail && splitDetailScreenProps) {
    return <MemoizedSplitDetailScreen {...splitDetailScreenProps} />;
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 30 : 0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <Box flex={1} bg="#1E2028" pt={0}>
          <ScrollView 
            ref={scrollViewRef}
            flex={1} 
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ 
              paddingBottom: keyboardHeight > 0 ? keyboardHeight + 20 : 20 
            }}
            onScroll={(e) => {
              setScrollY(e.nativeEvent.contentOffset.y);
            }}
            scrollEventThrottle={16}
          >
            <VStack space={3} p={4}>
              <HStack justifyContent="space-between" alignItems="center">
        <Text color="white" fontSize="2xl" fontWeight="bold">
                  My Program
                </Text>
                <Animated.View style={programEditAnimatedStyle}>
                  <Pressable
                    onPress={() => {
                      if (isEditingProgram) {
                        // Exiting edit mode
                        setSelectedDay(null);
                        setSelectedSplit(null);
                        setIsEditingProgram(false);
                      } else {
                        // Entering edit mode, exit other mode first if active
                        if (isEditingSplits) {
                          setIsEditingSplits(false);
                        }
                        // Set this mode after clearing the other
                        setIsEditingProgram(true);
                      }
                    }}
                  >
                    <Box position="relative" w="20">
                      <Animated.Text style={[{
                        color: '#6B8EF2',
                        fontSize: 14,
                        fontWeight: 'bold',
                        position: 'absolute',
                        right: 0,
                      }, editTextAnimatedStyle]}>
                        Edit
                      </Animated.Text>
                      <Animated.Text style={[{
                        color: '#6B8EF2',
                        fontSize: 14,
                        fontWeight: 'bold',
                        position: 'absolute',
                        right: 0,
                      }, doneTextAnimatedStyle]}>
                        Done
                      </Animated.Text>
                    </Box>
                  </Pressable>
                </Animated.View>
              </HStack>

        <HStack justifyContent="space-between" mx={-2} px={1}>
                {WEEKDAYS.map((day) => (
                  <WeekdayItem
                      key={day}
                    day={day}
                    splits={splits}
                    isSelected={selectedDay === day}
                      onPress={() => handleDaySelect(day)}
                    isEditing={isEditingProgram}
                  />
                ))}
        </HStack>

              <VStack space={4}>
                <HStack justifyContent="space-between" alignItems="center">
                  <Text color="white" fontSize="xl" fontWeight="bold">
                    My Splits
                </Text>
                  <Animated.View style={splitsEditAnimatedStyle}>
                    <Pressable
                      onPress={() => {
                        if (isEditingSplits) {
                          // Just exit this mode
                          setIsEditingSplits(false);
                        } else {
                          // Entering edit mode, exit other mode first if active
                          if (isEditingProgram) {
                            setSelectedDay(null);
                            setSelectedSplit(null);
                            setIsEditingProgram(false);
                          }
                          // Set this mode after clearing the other
                          setIsEditingSplits(true);
                        }
                      }}
                    >
                      <Box position="relative" w="20">
                        <Animated.Text style={[{
                          color: '#6B8EF2',
                          fontSize: 14,
                          fontWeight: 'bold',
                          position: 'absolute',
                          right: 0,
                        }, splitsEditTextAnimatedStyle]}>
                          Edit
                        </Animated.Text>
                        <Animated.Text style={[{
                          color: '#6B8EF2',
                          fontSize: 14,
                          fontWeight: 'bold',
                          position: 'absolute',
                          right: 0,
                        }, splitsDoneTextAnimatedStyle]}>
                          Done
                        </Animated.Text>
                      </Box>
                    </Pressable>
                  </Animated.View>
              </HStack>

                <VStack space={3}>
                  {splits.length === 0 ? (
                    <Text color="gray.400" fontSize="sm" textAlign="center">
                      Tell us about your workout split!
                    </Text>
                  ) : (
                    splits.map((split) => (
                      <SplitItem
                        key={split.id}
                        split={split}
                        isEditingSplits={isEditingSplits}
                        selectedDay={selectedDay}
                        onPress={() => handleSplitPress(split)}
                        onNameEdit={(text: string) => handleSplitNameEdit(split.id, text)}
                        onColorSelect={(color: string) => handleColorSelect(split.id, color)}
                        onDelete={() => handleDeleteSplit(split.id)}
                        onFocusScroll={handleFocusScroll}
                      />
                    ))
                  )}
                  {isEditingSplits && (
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
                  <HStack justifyContent="space-between" alignItems="center">
                  <Text color="white" fontSize="xl" fontWeight="bold">
                    My Exercises
                  </Text>
                </HStack>

                  {exercises.length === 0 ? (
                    <Text color="gray.400" fontSize="sm" textAlign="center">
                      No Exercises added yet.
                  </Text>
                ) : (
                    <OptimizedExerciseList
                      data={bodyPartSections.length > 0 ? bodyPartSections : []}
                      renderItem={renderBodyPartSection}
                      extraData={[splits, expandedExercises]}
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