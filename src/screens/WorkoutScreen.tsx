import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Box, HStack, Text, Icon, VStack, Pressable, IconButton, ScrollView, Collapse } from 'native-base';
import { AntDesign,  } from '@expo/vector-icons';
import { KeyboardAvoidingView, Platform, ScrollView as RNScrollView, Keyboard, Dimensions, 
  TouchableWithoutFeedback, View, TextInput } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { dataService } from '../services/data';
import Animated, { 
  useAnimatedStyle, 
  withTiming,
  useSharedValue,
  withSequence,
  withDelay
} from 'react-native-reanimated';
import { Exercise, Split, WEEKDAYS, WeekDay } from '../types';
import { useData } from '../contexts/DataContext';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { WorkoutStackParamList } from './WorkoutMain';
import { parseFontSize } from '../../helper/fontsize';

type NavigationProp = NativeStackNavigationProp<WorkoutStackParamList>;

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

// Helper function to get abbreviated day names
const getAbbreviatedDay = (day: WeekDay): string => {
  return day.slice(0, 3);
};

// const ColorBar = ({ color }: { color?: string }) => (
//   <Box w="full" h="2" bg={color || 'transparent'} borderTopRadius="lg" />
// );

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
  extraData,
  editMode
}: {
  data: BodyPartSectionData[];
  renderItem: ({ item, index }: { item: BodyPartSectionData; index: number }) => React.ReactElement;
  extraData: any[];
  editMode: string;
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
        extraData={[...extraData, editMode]}
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
  day: WeekDay; 
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
          {getAbbreviatedDay(day)}
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
  onFocusScroll,
  editMode
}: { 
  split: Split;
  isEditingSplits: boolean;
  selectedDay: string | null;
  onPress: () => void;
  onNameEdit: (text: string) => void;
  onColorSelect: (color: string) => void;
  onDelete: () => void;
  onFocusScroll: (y: number, height: number) => void;
  editMode: 'none' | 'program' | 'splits';
}) => {
  // Animation value for border color
  const borderColor = useSharedValue("#3A3E48");
  const pressBorderColor = useSharedValue("#3A3E48");
  const arrowOpacity = useSharedValue(1);
  const [value, setValue] = useState(split.name);

  // Update border color when selection changes
  useEffect(() => {
    borderColor.value = withTiming(
      selectedDay !== null ? "#6B8EF2" : "#3A3E48",
      { duration: 200 }
    );
  }, [selectedDay]);

  // Update arrow opacity when edit mode changes
  useEffect(() => {
    if (editMode === 'program') {
      arrowOpacity.value = withTiming(0, { duration: 200 });
    } else {
      arrowOpacity.value = withTiming(1, { duration: 200 });
    }
  }, [editMode]);

  const borderAnimatedStyle = useAnimatedStyle(() => {
    // const borderColorValue = selectedDay !== null ? "#6B8EF2" : "#3A3E48";
    return {
      borderColor: borderColor.value,
    };
  });

  const pressBorderAnimatedStyle = useAnimatedStyle(() => {
    return {
      borderColor: pressBorderColor.value,
    };
  });

  const arrowAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: arrowOpacity.value,
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

  const handleNameEdit = (text: string) => {
    setValue(text);
    onNameEdit(text);
  }
  
  const calculatedFontSize = useMemo(() => {
    return parseFontSize('lg');
  }
  , []);
  
  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
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
          borderWidth: 2,
          zIndex: 2
        }, borderAnimatedStyle]} 
        pointerEvents="none" 
      />
      <Animated.View 
        style={[{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: 12,
          borderWidth: 1,
          zIndex: 3
        }, pressBorderAnimatedStyle]} 
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
              <TextInput
                value={value}
                onChangeText={handleNameEdit}
                placeholder="Enter split name"
                placeholderTextColor="rgba(255, 255, 255, 0.4)"
                style={{color: 'white', fontSize: calculatedFontSize}}
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
            <HStack space={2} alignItems="center">
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
          </>
        )}
      </HStack>
      {isEditingSplits && (
        <HStack space={2} mt={2} justifyContent="space-between">
          {COLORS.map((color) => (
            <Pressable
              key={color}
              onPress={() => {
                // Only proceed if we're in the correct edit mode (splits)
                if (editMode !== 'splits') {
                  return;
                }
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
});

const WorkoutScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const scrollViewRef = useRef<RNScrollView>(null);
  const { splits, updateSplits } = useData();
  
  // Define an enum for edit mode states
  type EditMode = 'none' | 'program' | 'splits';
  const [editMode, setEditMode] = useState<EditMode>('none');
  
  // Debug hook to trace editMode changes
  const setEditModeWithDebug = (newMode: EditMode) => {
    setEditMode(newMode);
  };
  
  // Derive individual edit states from the unified edit mode
  const isEditingProgram = editMode === 'program';
  const isEditingSplits = editMode === 'splits';
  
  const [selectedDay, setSelectedDay] = useState<WeekDay | null>(null);
  const [selectedSplit, setSelectedSplit] = useState<Split | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const [exercises, setExercises] = useState<Exercise[]>([]);
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

  // Define handler functions for toggling edit modes
  const toggleProgramEditMode = () => {
    // Toggle between program edit mode and no edit mode
    if (editMode === 'program') {
      // Exit program edit mode
      setSelectedDay(null);
      setSelectedSplit(null);
      setEditModeWithDebug('none');
    } else if (editMode === 'none') {
      // Enter program edit mode
      setEditModeWithDebug('program');
    } 
    // If we're in splits edit mode, do nothing
  };
  
  const toggleSplitsEditMode = () => {
    // Toggle between splits edit mode and no edit mode
    if (editMode === 'splits') {
      // Exit splits edit mode
      setEditModeWithDebug('none');
    } else if (editMode === 'none') {
      // Enter splits edit mode
      setEditModeWithDebug('splits');
    }
    // If we're in program edit mode, do nothing
  };

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
  const handleDaySelect = useCallback((day: WeekDay) => {
    if (editMode !== 'program') return;
    
    if (selectedDay === day) {
      setSelectedDay(null);
      setSelectedSplit(null);
      return;
    }
    setSelectedDay(day);
  }, [selectedDay, editMode]);

  const handleSplitSelect = useCallback((split: Split) => {
    if (!selectedDay || editMode !== 'program') return;
    
    console.log('Assigning split to day:', {
      splitId: split.id,
      splitName: split.name,
      day: selectedDay,
      currentSplits: splits
    });
    
    const updatedSplits = splits.map(s => {
      // First, remove the selected day from all splits
      const daysWithoutSelected = s.days.filter(d => d !== selectedDay);
      
      // Then, add the selected day to the chosen split
      if (s.id === split.id) {
        return {
          ...s,
          days: [...daysWithoutSelected, selectedDay]
        };
      }
      return {
        ...s,
        days: daysWithoutSelected
      };
    });
    
    console.log('Updated splits after assignment:', updatedSplits);
    updateSplits(updatedSplits);
    setSelectedDay(null);
    setSelectedSplit(null);
  }, [selectedDay, editMode, splits, updateSplits]);

  // Save current state as default
  const saveCurrentStateAsDefault = useCallback(async () => {
    try {
      await dataService.saveDefaultWorkoutState(splits);
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
        await updateSplits(data);
      } catch (error) {
        console.error('Error saving splits:', error);
      }
    }, 500); // Reduced to 500ms for faster updates
  }, [updateSplits]);

  // Load splits from storage
  useEffect(() => {
    const loadSplits = async () => {
      if (!isInitialLoadRef.current) return;
      
      try {
        // First check for saved splits (most recent data)
        const loadedSplits = await dataService.getSplits();
        
        if (loadedSplits.length > 0) {
          await updateSplits(loadedSplits);
          
          // Process data immediately after loading
          const processedData = processSplitsData(loadedSplits);
          processedDataRef.current = processedData;
          setExercises(processedData.exercises);
        } else {
          // Fall back to default state only if no saved data exists
          const defaultSplits = await dataService.getDefaultWorkoutState();
          if (defaultSplits.length > 0) {
            await updateSplits(defaultSplits);
            
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
  }, [processSplitsData, updateSplits]);

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
    // When in program edit mode and a day is selected, allow assigning split to the day
    if (selectedDay && editMode === 'program') {
      handleSplitSelect(split);
      return;
    }
    
    // Only allow navigating to split details when not in any edit mode
    if (editMode === 'none') {
      navigation.navigate('SplitDetail', { split });
    }
  }, [selectedDay, editMode, handleSplitSelect, navigation]);

  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      }
    );

    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  const handleSplitNameEdit = useCallback((id: string, newName: string) => {
    // console.log('Editing split name:', {
    //   splitId: id,
    //   newName,
    //   currentSplits: splits
    // });
    
    const updatedSplits = splits.map((split: Split) => 
      split.id === id ? { ...split, name: newName } : split
    );
    
    // console.log('Updated splits after name change:', updatedSplits);
    updateSplits(updatedSplits);
  }, [splits, updateSplits]);

  const handleColorSelect = useCallback((id: string, color: string) => {
    console.log('Changing split color:', {
      splitId: id,
      newColor: color,
      currentSplits: splits
    });
    
    const updatedSplits = splits.map((split: Split) => 
      split.id === id ? { ...split, color } : split
    );
    
    console.log('Updated splits after color change:', updatedSplits);
    updateSplits(updatedSplits);
  }, [splits, updateSplits]);

  const handleAddSplit = useCallback(() => {
    const newSplit: Split = {
      id: Date.now().toString(),
      name: `Split ${splits.length + 1}`,
      color: '#FF5733',
      days: [],
      exercises: []
    };
    
    console.log('Adding new split:', {
      newSplit,
      currentSplits: splits
    });
    
    const updatedSplits = [...splits, newSplit];
    console.log('Updated splits after adding:', updatedSplits);
    updateSplits(updatedSplits);
  }, [splits, updateSplits]);

  const handleDeleteSplit = useCallback((id: string) => {
    console.log('Deleting split:', {
      splitId: id,
      currentSplits: splits
    });
    
    const updatedSplits = splits.filter((split: Split) => split.id !== id);
    console.log('Updated splits after deletion:', updatedSplits);
    updateSplits(updatedSplits);
  }, [splits, updateSplits]);

  const handleSplitDetailUpdate = useCallback((updatedSplit: Split) => {
    console.log('Updating split details:', {
      updatedSplit,
      currentSplits: splits
    });
    
    const updatedSplits = splits.map((split: Split) => 
      split.id === updatedSplit.id ? updatedSplit : split
    );
    
    // console.log('Updated splits after detail update:', updatedSplits);
    updateSplits(updatedSplits);
  }, [splits, updateSplits]);

  const toggleExerciseExpansion = useCallback((exerciseId: string) => {
    // Only allow exercise expansion when not in edit mode
    if (editMode !== 'none') {
      return;
    }
    
    setExpandedExercises(prev => {
      if (prev.includes(exerciseId)) {
        return prev.filter(id => id !== exerciseId);
      } else {
        return [...prev, exerciseId];
      }
    });
  }, [editMode]);

  // Function to handle input focus for the keyboard
  const handleFocusScroll = (inputY: number, inputHeight: number) => {
    // Only respond to input focus in splits edit mode
    if (editMode !== 'splits') {
      return;
    }
    
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
      
      if (scrollViewRef.current) {
        scrollViewRef.current.scrollTo({ y: targetScrollPosition, animated: true });
      }
    }
  };

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
  // const renderSplitItem = useCallback((split: Split) => {
  //   return (
  //     <SplitItem
  //       key={split.id}
  //       split={split}
  //       isEditingSplits={editMode === 'splits'}
  //       selectedDay={selectedDay}
  //       onPress={() => handleSplitPress(split)}
  //       onNameEdit={(text: string) => handleSplitNameEdit(split.id, text)}
  //       onColorSelect={(color: string) => handleColorSelect(split.id, color)}
  //       onDelete={() => handleDeleteSplit(split.id)}
  //       onFocusScroll={handleFocusScroll}
  //       editMode={editMode}
  //     />
  //   );
  // }, [editMode, selectedDay, handleSplitPress, handleSplitNameEdit, handleColorSelect, handleDeleteSplit, handleFocusScroll]);

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 30 : 0}
    >
      <TouchableWithoutFeedback 
        onPress={() => {
          // Just dismiss keyboard without changing edit mode
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
              paddingBottom: keyboardHeight > 0 ? keyboardHeight + 20 : 20 
            }}
            onScroll={(e) => {
              setScrollY(e.nativeEvent.contentOffset.y);
            }}
            scrollEventThrottle={16}
          >
            <VStack space={3} p={4}>
              <HStack justifyContent="space-between" alignItems="center" width="full">
                <Text color="white" fontSize="2xl" fontWeight="bold">
                  My Program
                </Text>
                {editMode !== 'splits' && (
                  <Pressable onPress={toggleProgramEditMode}>
                    <Box w="20">
                      <Text color="#6B8EF2" fontSize="14" fontWeight="bold" textAlign="right">
                        {editMode === 'program' ? 'Done' : 'Edit'}
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
                    isEditing={editMode === 'program'}
                  />
                ))}
              </HStack>

              <VStack space={4}>
                <HStack justifyContent="space-between" alignItems="center" width="full">
                  <Text color="white" fontSize="xl" fontWeight="bold">
                    My Splits
                  </Text>
                  {editMode !== 'program' && (
                    <Pressable onPress={toggleSplitsEditMode}>
                      <Box w="20">
                        <Text color="#6B8EF2" fontSize="14" fontWeight="bold" textAlign="right">
                          {editMode === 'splits' ? 'Done' : 'Edit'}
                        </Text>
                      </Box>
                    </Pressable>
                  )}
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
                        isEditingSplits={editMode === 'splits'}
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
                  {editMode === 'splits' && (
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