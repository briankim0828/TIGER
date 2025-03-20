import React, { useState, useRef, useEffect, useCallback, useMemo, forwardRef } from 'react';
import { Box, HStack, Text, Button, Icon, VStack, Pressable, IconButton, ScrollView, Collapse, Divider } from 'native-base';
import { AntDesign, MaterialIcons, Feather } from '@expo/vector-icons';
import CustomTextInput from '../components/CustomTextInput';
import { KeyboardAvoidingView, Platform, ScrollView as RNScrollView, Keyboard, Dimensions, 
  TouchableWithoutFeedback, View, TextInput, findNodeHandle, NativeEventEmitter, NativeModules, UIManager, FlatList } from 'react-native';
import SplitDetailScreen from './SplitDetailScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FlashList } from '@shopify/flash-list';

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
                color={dayAssignments[day] ? "white" : "gray.400"}
                fontSize="sm"
                flex={1}
                textAlign="center"
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
  onPress 
}: { 
  day: string; 
  splits: Split[]; 
  isSelected: boolean; 
  onPress: () => void; 
}) => {
  const daySplits = splits.filter(split => split.days.includes(day));
  const color = daySplits.length > 0 ? daySplits[0].color || "#3A3E48" : "#3A3E48";

  return (
    <Pressable 
      onPress={onPress}
      flex={1}
      mx={0.5}
    >
      <VStack space={2} alignItems="center">
        <Text color="gray.400" fontSize="xs" fontWeight="bold">
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
          borderWidth={isSelected ? 2 : 0}
          borderColor="#6B8EF2"
          position="relative"
        >
          <Box
            position="absolute"
            top={0}
            left={0}
            right={0}
            h="2"
            bg={color}
            borderTopRadius="lg"
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
      </VStack>
    </Pressable>
  );
});

const WorkoutScreen = () => {
  const scrollViewRef = useRef<RNScrollView>(null);
  const [splits, setSplits] = useState<Split[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedSplit, setSelectedSplit] = useState<Split | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedSplitDetail, setSelectedSplitDetail] = useState<Split | null>(null);
  const [expandedExercises, setExpandedExercises] = useState<string[]>([]);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const isInitialLoadRef = useRef(true);

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
    if (selectedDay === day) {
      setSelectedDay(null);
      setSelectedSplit(null);
      return;
    }
    setSelectedDay(day);
  }, [selectedDay]);

  const handleSplitSelect = useCallback((split: Split) => {
    if (!selectedDay) return;
    
    setSplits(prevSplits => {
      const updatedSplits = prevSplits.map(s => {
        if (s.id === split.id) {
          let updatedDays = [...s.days];
          if (updatedDays.includes(selectedDay)) {
            updatedDays = updatedDays.filter(d => d !== selectedDay);
          } else {
            updatedDays.push(selectedDay);
          }
          return { ...s, days: updatedDays };
        } else {
          const filteredDays = s.days.filter(d => d !== selectedDay);
          return { ...s, days: filteredDays };
        }
      });
      return updatedSplits;
    });
    
    setSelectedDay(null);
    setSelectedSplit(null);
  }, [selectedDay]);

  // Save current state as default
  const saveCurrentStateAsDefault = useCallback(async () => {
    try {
      await AsyncStorage.setItem('default_workout_state', JSON.stringify(splits));
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
        await AsyncStorage.setItem('splits', JSON.stringify(data));
      } catch (error) {
        console.error('Error saving splits:', error);
      }
    }, 500); // Reduced to 500ms for faster updates
  }, []);

  // Load splits from AsyncStorage
  useEffect(() => {
    const loadSplits = async () => {
      if (!isInitialLoadRef.current) return;
      
      try {
        // First check for saved splits (most recent data)
        const savedSplits = await AsyncStorage.getItem('splits');
        
        let loadedSplits: Split[] = [];
        if (savedSplits) {
          // Use the most recent data if available
          loadedSplits = JSON.parse(savedSplits);
          console.log('Loaded saved splits:', loadedSplits.length);
        } else {
          // Fall back to default state only if no saved data exists
          const defaultState = await AsyncStorage.getItem('default_workout_state');
          if (defaultState) {
            loadedSplits = JSON.parse(defaultState);
            console.log('Loaded default splits:', loadedSplits.length);
          }
        }

        setSplits(loadedSplits);
        
        // Process data immediately after loading
        const processedData = processSplitsData(loadedSplits);
        processedDataRef.current = processedData;
        setExercises(processedData.exercises);
        
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

  // Save splits to AsyncStorage whenever they change
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
      handleSplitSelect(split);
      return;
    }
    
    if (!isEditing) {
      setSelectedSplitDetail(split);
    }
  }, [selectedDay, isEditing, handleSplitSelect]);

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
                <Pressable
                  onPress={saveCurrentStateAsDefault}
                  bg="#2A2E38"
                  px={3}
                  py={1.5}
                  borderRadius="md"
                  _pressed={{ opacity: 0.7 }}
                >
                  <Text color="#6B8EF2" fontSize="sm" fontWeight="bold">
                    Save
        </Text>
                </Pressable>
              </HStack>

        <HStack justifyContent="space-between" mx={-2} px={1}>
          {WEEKDAYS.map((day) => (
            <WeekdayItem
                      key={day}
              day={day}
              splits={splits}
              isSelected={selectedDay === day}
                      onPress={() => handleDaySelect(day)}
            />
          ))}
        </HStack>

              <Box bg="#2A2E38" borderRadius="lg" p={4}>
                <HStack justifyContent="space-between" alignItems="center" mb={4}>
                  <Text color="white" fontSize="xl" fontWeight="bold">
                    My Splits
                </Text>
                <Button
                  variant="ghost"
                    onPress={() => setIsEditing(!isEditing)}
                  _text={{ color: "#6B8EF2" }}
                >
                  {isEditing ? "Done" : "Edit"}
                </Button>
              </HStack>

                <VStack space={3} pb={4}>
                  {splits.length === 0 ? (
                    <Text color="gray.400" fontSize="sm" textAlign="center">
                      Tell us about your workout split!
                    </Text>
                  ) : (
                    splits.map((split) => (
                      <Pressable
                        key={split.id}
                        onPress={() => handleSplitPress(split)}
                        bg="#1E2028"
                        p={4}
                        pl={6}
                        borderRadius="md"
                        borderWidth={selectedDay !== null ? 2 : 0}
                        borderColor="#6B8EF2"
                        opacity={selectedDay !== null ? 1 : 0.7}
                        _pressed={{
                          borderWidth: 1,
                          borderColor: '#6B8EF2'
                        }}
                        position="relative"
                      >
                        <Box
                          position="absolute"
                          top={0}
                          left={0}
                          bottom={0}
                          w="3"
                          bg={split.color || "#3A3E48"}
                          borderLeftRadius="md"
                        />
                        <HStack justifyContent="space-between" alignItems="center">
                          {isEditing ? (
                            <HStack flex={1} space={2} alignItems="center">
                              <Box flex={1}>
                                <FocusAwareInput
                                  value={split.name}
                                  onChangeText={(text: string) => handleSplitNameEdit(split.id, text)}
                                  color="white"
                                  fontSize="lg"
                                  onFocusScroll={handleFocusScroll}
                                  placeholder="Enter split name"
                                  placeholderTextColor="rgba(255, 255, 255, 0.4)"
                                />
                              </Box>
                              <Text color="white" fontSize="sm">
                                {split.exercises.length} exercises
                              </Text>
                              <IconButton
                                icon={<Icon as={AntDesign} name="delete" color="#FF6B6B" />}
                                onPress={() => handleDeleteSplit(split.id)}
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
                        {isEditing && (
                          <HStack space={2} mt={2} justifyContent="space-between">
                            {COLORS.map((color) => (
                              <Pressable
                                key={color}
                                onPress={() => handleColorSelect(split.id, color)}
                                flex={1}
                              >
                                <Box
                                  bg={color}
                                  h="8"
                                  borderRadius="md"
                                  borderWidth={split.color === color ? 2 : 0}
                                  borderColor="white"
                                />
                              </Pressable>
                            ))}
                          </HStack>
                        )}
                      </Pressable>
                    ))
                  )}
                  {isEditing && (
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
              </Box>

              {/* My Exercises Section */}
              <Box bg="#2A2E38" borderRadius="lg" p={4}>
                <HStack justifyContent="space-between" alignItems="center" mb={4}>
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
            </Box>
      </VStack>
          </ScrollView>
    </Box>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

export default WorkoutScreen; 