import React, { useState, useRef, useEffect } from 'react';
import { Box, HStack, Text, Button, Icon, VStack, Pressable, IconButton, ScrollView, Collapse, Divider } from 'native-base';
import { AntDesign, MaterialIcons, Feather } from '@expo/vector-icons';
import CustomTextInput from '../components/CustomTextInput';
import { KeyboardAvoidingView, Platform, ScrollView as RNScrollView, Keyboard, Dimensions, TouchableWithoutFeedback, View, TextInput, findNodeHandle, NativeEventEmitter, NativeModules, UIManager } from 'react-native';
import SplitDetailScreen from './SplitDetailScreen';

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

  // Update the useEffect to include split information
  useEffect(() => {
    // Collect all unique exercises from all splits
    const allExercises = splits.reduce((acc, split) => {
      split.exercises.forEach(exercise => {
        const existingExercise = acc.find(e => e.id === exercise.id);
        if (existingExercise) {
          // If exercise exists, add this split's ID if not already present
          if (!existingExercise.splitIds.includes(split.id)) {
            existingExercise.splitIds.push(split.id);
          }
        } else {
          // If exercise doesn't exist, add it with this split's ID
          acc.push({
            ...exercise,
            splitIds: [split.id]
          });
        }
      });
      return acc;
    }, [] as Exercise[]);
    setExercises(allExercises);
  }, [splits]);

  const handleDaySelect = (day: string) => {
    // If selecting the same day, deselect everything
    if (selectedDay === day) {
      setSelectedDay(null);
      setSelectedSplit(null);
      return;
    }
    
    // Else, select this day
    setSelectedDay(day);
  };

  const handleSplitSelect = (split: Split) => {
    if (!selectedDay) return;
    
    // Create updated splits array
    const updatedSplits = splits.map(s => {
      // For the selected split, add the day if not already there
      if (s.id === split.id) {
        let updatedDays = [...s.days];
        
        // If the day is already in the array, remove it (toggle functionality)
        if (updatedDays.includes(selectedDay)) {
          updatedDays = updatedDays.filter(d => d !== selectedDay);
        } else {
          // Otherwise add it
          updatedDays.push(selectedDay);
        }
        
        return { ...s, days: updatedDays };
      } 
      // For all other splits, remove the day if it exists
      else {
        // Remove the selected day from any other split that might have it
        const filteredDays = s.days.filter(d => d !== selectedDay);
        return { ...s, days: filteredDays };
      }
    });
    
    setSplits(updatedSplits);
    
    // Clear selections
    setSelectedDay(null);
    setSelectedSplit(null);
  };

  const handleSplitNameEdit = (splitId: string, newName: string) => {
    const updatedSplits = splits.map(split => 
      split.id === splitId ? { ...split, name: newName } : split
    );
    setSplits(updatedSplits);
  };

  const handleColorSelect = (splitId: string, color: string) => {
    const updatedSplits = splits.map(split => 
      split.id === splitId ? { ...split, color } : split
    );
    setSplits(updatedSplits);
  };

  const handleAddSplit = () => {
    if (splits.length >= 7) return;
    
    const newSplit: Split = {
      id: Date.now().toString(),
      name: '',
      days: [],
      exercises: [],
      color: undefined
    };
    setSplits([...splits, newSplit]);
  };

  const handleDeleteSplit = (splitId: string) => {
    setSplits(splits.filter(split => split.id !== splitId));
  };

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

  // Get first letter of text
  const getFirstLetter = (text: string) => {
    return text.charAt(0).toUpperCase();
  };

  const handleSplitPress = (split: Split) => {
    // If we're in the process of assigning a split to a weekday (selectedDay exists)
    if (selectedDay) {
      handleSplitSelect(split);
      return;
    }
    
    // Otherwise, navigate to split detail
    if (!isEditing) {
      setSelectedSplitDetail(split);
    }
  };

  const toggleExerciseExpansion = (exerciseId: string) => {
    setExpandedExercises(prev => {
      if (prev.includes(exerciseId)) {
        return prev.filter(id => id !== exerciseId);
      } else {
        return [...prev, exerciseId];
      }
    });
  };

  if (selectedSplitDetail) {
    return (
      <SplitDetailScreen 
        split={selectedSplitDetail}
        onBack={() => setSelectedSplitDetail(null)}
        onUpdateSplit={(updatedSplit) => {
          // Update the split in the splits array
          const updatedSplits = splits.map(s => 
            s.id === updatedSplit.id ? updatedSplit : s
          );
          setSplits(updatedSplits);
          setSelectedSplitDetail(updatedSplit);
        }}
      />
    );
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 30 : 0}
    >
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
            <Text color="white" fontSize="2xl" fontWeight="bold">
              My Program
            </Text>

            <HStack justifyContent="space-between" mx={-2} px={1}>
              {WEEKDAYS.map((day) => {
                const daySplits = splits.filter(split => split.days.includes(day));
                return (
                  <Pressable 
                    key={day}
                    onPress={() => handleDaySelect(day)}
                    flex={1}
                    mx={0.5}
                  >
                    <VStack space={2} alignItems="center">
                      <Text color="gray.400" fontSize="xs" fontWeight="bold">
                        {day}
                      </Text>
                      <Box
                        bg={daySplits.length > 0 ? daySplits[0].color || "#2A2E38" : "#2A2E38"}
                        p={2}
                        borderRadius="lg"
                        w="full"
                        h="16"
                        justifyContent="center"
                        alignItems="center"
                        borderWidth={selectedDay === day ? 2 : 0}
                        borderColor="#6B8EF2"
                      >
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
              })}
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
                      bg={split.color || "#1E2028"}
                      p={4}
                      borderRadius="md"
                      borderWidth={selectedDay !== null ? 2 : 0}
                      borderColor="#6B8EF2"
                      opacity={selectedDay !== null ? 1 : 0.7}
                    >
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
              
              <VStack space={3} pb={4}>
                {exercises.length === 0 ? (
                  <Text color="gray.400" fontSize="sm" textAlign="center">
                    No Exercises added yet.
                  </Text>
                ) : (
                  // Group exercises by body part
                  Object.entries(
                    exercises.reduce((acc, exercise) => {
                      if (!acc[exercise.bodyPart]) {
                        acc[exercise.bodyPart] = [];
                      }
                      acc[exercise.bodyPart].push(exercise);
                      return acc;
                    }, {} as Record<string, Exercise[]>)
                  ).map(([bodyPart, bodyPartExercises]) => (
                    <Box key={bodyPart}>
                      <Text color="gray.400" fontSize="sm" mb={2}>
                        {bodyPart}
                      </Text>
                      <VStack space={2}>
                        {bodyPartExercises.map((exercise) => (
                          <Box
                            key={exercise.id}
                            bg="#1E2028"
                            p={3}
                            borderRadius="md"
                            position="relative"
                          >
                            <HStack justifyContent="space-between" alignItems="center">
                              <HStack space={2} alignItems="center" flex={1}>
                                <Pressable
                                  onPress={() => {
                                    // Toggle the weekday popup for this exercise
                                    toggleExerciseExpansion(exercise.id);
                                  }}
                                >
                                  <Icon 
                                    as={AntDesign} 
                                    name={expandedExercises.includes(exercise.id) ? "down" : "right"} 
                                    color="gray.400" 
                                    size="sm"
                                  />
                                </Pressable>
                                <Text color="white" fontSize="md">
                                  {exercise.name}
                                </Text>
                              </HStack>
                              <HStack space={1}>
                                {exercise.splitIds.map(splitId => {
                                  const split = splits.find(s => s.id === splitId);
                                  return (
                                    <Box
                                      key={splitId}
                                      w="2"
                                      h="6"
                                      bg={split?.color || "#2A2E38"}
                                      borderRadius="full"
                                    />
                                  );
                                })}
                              </HStack>
                            </HStack>
                            
                            {/* Weekday Popup */}
                            <Collapse isOpen={expandedExercises.includes(exercise.id)}>
                              <Box mt={2} pt={2} borderTopWidth={1} borderColor="gray.700">
                                <HStack space={2} flexWrap="wrap" justifyContent="space-between">
                                  {WEEKDAYS.map(day => {
                                    const isAssigned = exercise.splitIds.some(splitId => {
                                      const split = splits.find(s => s.id === splitId);
                                      return split?.days.includes(day);
                                    });
                                    return (
                                      <Text
                                        key={day}
                                        color={isAssigned ? "white" : "gray.400"}
                                        fontSize="sm"
                                        flex={1}
                                        textAlign="center"
                                      >
                                        {day}
                                      </Text>
                                    );
                                  })}
                                </HStack>
                              </Box>
                            </Collapse>
                          </Box>
                        ))}
                      </VStack>
                    </Box>
                  ))
                )}
              </VStack>
            </Box>
          </VStack>
        </ScrollView>
      </Box>
    </KeyboardAvoidingView>
  );
};

export default WorkoutScreen; 