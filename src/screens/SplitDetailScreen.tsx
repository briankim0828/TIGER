import React, { useState, useRef, useEffect } from 'react';
import { Box, HStack, Text, Icon, IconButton, VStack, Pressable, ScrollView, Button, Divider } from 'native-base';
import { AntDesign, MaterialIcons } from '@expo/vector-icons';
import { Split } from './WorkoutScreen';
import ExerciseSelectionView, { Exercise } from '../components/ExerciseSelectionView';
import { ScrollView as RNScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SplitDetailScreenProps {
  split: Split;
  onClose: () => void;
  onUpdate: (updatedSplit: Split) => void;
}

const SplitDetailScreen: React.FC<SplitDetailScreenProps> = ({ split, onClose, onUpdate }) => {
  const splitColor = split.color || '#2A2E38';
  const [exercises, setExercises] = useState<Exercise[]>(split.exercises);
  const [showExerciseSelection, setShowExerciseSelection] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const scrollViewRef = useRef<RNScrollView>(null);

  // Load exercises from AsyncStorage when component mounts
  useEffect(() => {
    const loadExercises = async () => {
      try {
        const savedExercises = await AsyncStorage.getItem(`split_exercises_${split.id}`);
        if (savedExercises) {
          const parsedExercises = JSON.parse(savedExercises);
          setExercises(parsedExercises);
          // Update parent component with loaded exercises
          onUpdate({
            ...split,
            exercises: parsedExercises
          });
        }
      } catch (error) {
        console.error('Error loading exercises:', error);
      }
    };
    loadExercises();
  }, [split.id, onUpdate, split]);

  // Save exercises to AsyncStorage whenever they change
  useEffect(() => {
    const saveExercises = async () => {
      try {
        await AsyncStorage.setItem(`split_exercises_${split.id}`, JSON.stringify(exercises));
        // Update parent component with current exercises
        onUpdate({
          ...split,
          exercises
        });
      } catch (error) {
        console.error('Error saving exercises:', error);
      }
    };
    saveExercises();
  }, [exercises, split.id, onUpdate, split]);

  const handleAddExercise = (newExercises: Exercise[]) => {
    const updatedExercises = [...exercises, ...newExercises];
    setExercises(updatedExercises);
  };

  const handleRemoveExercise = (index: number) => {
    const updatedExercises = exercises.filter((_, i) => i !== index);
    setExercises(updatedExercises);
  };

  const handleUpdateExercise = (index: number, field: 'sets' | 'reps', value: number) => {
    const newExercises = [...exercises];
    newExercises[index] = { ...newExercises[index], [field]: value };
    setExercises(newExercises);
  };

  const addExerciseButton = (
    <Pressable
      borderStyle={showExerciseSelection ? "solid" : "dashed"}
      borderWidth={1}
      borderColor="#6B8EF2"
      bg={showExerciseSelection ? "#6B8EF2" : "transparent"}
      borderRadius="lg"
      py={3}
      mb={5}
      _pressed={{ opacity: 0.7 }}
      onPress={() => setShowExerciseSelection(true)}
    >
      <HStack space={2} justifyContent="center" alignItems="center">
        <Icon 
          as={AntDesign} 
          name="plus" 
          color={showExerciseSelection ? "white" : "#6B8EF2"} 
          size="sm" 
        />
        <Text 
          color={showExerciseSelection ? "white" : "#6B8EF2"} 
          fontSize="md"
        >
          Add Exercise
        </Text>
      </HStack>
    </Pressable>
  );

  return (
    <Box flex={1} bg="#1E2028">
      <HStack alignItems="center" p={4}>
        <IconButton
          icon={<Icon as={AntDesign} name="arrowleft" size="lg" color="white" />}
          onPress={onClose}
          variant="ghost"
          _pressed={{ 
            bg: 'transparent',
            _icon: {
              color: '#6B8EF2'
            }
          }}
        />
        <Text color="white" fontSize="xl" fontWeight="bold" flex={1}>
          {split.name}
        </Text>
        <Button
          variant="ghost"
          onPress={() => setIsEditing(!isEditing)}
          _text={{ color: "#6B8EF2" }}
        >
          {isEditing ? "Done" : "Edit"}
        </Button>
      </HStack>

      {/* Content */}
      <Box px={4} flex={1}>
        {showExerciseSelection ? (
          <ExerciseSelectionView
            onClose={() => setShowExerciseSelection(false)}
            onAddExercise={handleAddExercise}
          />
        ) : (
          exercises.length > 0 ? (
            <ScrollView flex={1} ref={scrollViewRef}>
              <VStack space={3}>
                {exercises.map((exercise, index) => (
                  <Box 
                    key={`${exercise.id}-${index}`} 
                    bg="#2A2E38" 
                    py={2}
                    px={4}
                    borderRadius="md"
                    position="relative"
                  >
                    <Box
                      position="absolute"
                      top={0}
                      left={0}
                      bottom={0}
                      w="6"
                      bg={splitColor}
                      borderLeftRadius="md"
                      justifyContent="center"
                      alignItems="center"
                    >
                      <Text color="white" fontWeight="bold">{index + 1}</Text>
                    </Box>
                    <HStack justifyContent="space-between" alignItems="center" pl={5}>
                      <VStack>
                        <Text color="white" fontWeight="bold">
                          {exercise.name}
                        </Text>
                        <Text color="gray.400" fontSize="xs">
                          {exercise.bodyPart}
                        </Text>
                      </VStack>
                      {isEditing && (
                        <IconButton
                          icon={<Icon as={AntDesign} name="delete" color="#FF6B6B" />}
                          onPress={() => handleRemoveExercise(index)}
                          variant="ghost"
                          size="sm"
                        />
                      )}
                    </HStack>
                  </Box>
                ))}
                
                {isEditing && addExerciseButton}
              </VStack>
            </ScrollView>
          ) : (
            <Box bg="#2A2E38" borderRadius="lg" p={5}>
              <VStack space={5} alignItems="center">
                <Text color="gray.400" fontSize="lg">
                  Add exercises to {split.name} day
                </Text>
                {isEditing && (
                  <Box w="100%">
                    <Pressable
                      w="100%"
                      borderStyle="dashed"
                      borderWidth={1}
                      borderColor="#6B8EF2"
                      bg="transparent"
                      borderRadius="lg"
                      py={4}
                      _pressed={{ opacity: 0.7 }}
                      onPress={() => setShowExerciseSelection(true)}
                    >
                      <HStack space={2} justifyContent="center" alignItems="center">
                        <Icon 
                          as={AntDesign} 
                          name="plus" 
                          color="#6B8EF2" 
                          size="sm" 
                        />
                        <Text 
                          color="#6B8EF2" 
                          fontSize="md"
                        >
                          Add Exercise
                        </Text>
                      </HStack>
                    </Pressable>
                  </Box>
                )}
              </VStack>
            </Box>
          )
        )}
      </Box>
    </Box>
  );
};

export default SplitDetailScreen; 