import React, { useState, useRef, useEffect } from 'react';
import { Box, HStack, Text, Icon, IconButton, VStack, Pressable, ScrollView, Button, Divider } from 'native-base';
import { AntDesign, MaterialIcons } from '@expo/vector-icons';
import { Split, Exercise, Set } from '../types';
import ExerciseSelectionView from '../components/ExerciseSelectionView';
import { ScrollView as RNScrollView } from 'react-native';
import { storageService } from '../services/storage';
import CustomTextInput from '../components/CustomTextInput';

// Extend the Exercise type to include sets and reps
interface ExerciseWithDetails extends Omit<Exercise, 'sets'> {
  sets: Set[];
}

interface SplitDetailScreenProps {
  split: Split;
  onClose: () => void;
  onUpdate: (updatedSplit: Split) => void;
}

const SplitDetailScreen: React.FC<SplitDetailScreenProps> = ({ split, onClose, onUpdate }) => {
  const splitColor = split.color || '#2A2E38';
  const [exercises, setExercises] = useState<ExerciseWithDetails[]>([]);
  const [showExerciseSelection, setShowExerciseSelection] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const scrollViewRef = useRef<RNScrollView>(null);

  // Convert SelectionExercise to WorkoutExercise
  const convertToWorkoutExercise = (exercise: { id: string; name: string; bodyPart: string }): ExerciseWithDetails => ({
    ...exercise,
    splitIds: [split.id],
    sets: []
  });

  // Load exercises from storage when component mounts
  useEffect(() => {
    const loadExercises = async () => {
      try {
        const loadedExercises = await storageService.getSplitExercises(split.id);
        if (loadedExercises.length > 0) {
          // Add splitIds to loaded exercises
          const exercisesWithSplitIds = loadedExercises.map(exercise => ({
            ...exercise,
            splitIds: [split.id],
            sets: (exercise as any).sets || []
          }));
          setExercises(exercisesWithSplitIds);
          // Update parent component with loaded exercises
          onUpdate({
            ...split,
            exercises: exercisesWithSplitIds
          });
        }
      } catch (error) {
        console.error('Error loading exercises:', error);
      }
    };
    loadExercises();
  }, [split.id, onUpdate, split]);

  // Save exercises to storage whenever they change
  useEffect(() => {
    const saveExercises = async () => {
      try {
        await storageService.saveSplitExercises(split.id, exercises);
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
    const workoutExercises = newExercises.map(convertToWorkoutExercise);
    const updatedExercises = [...exercises, ...workoutExercises];
    setExercises(updatedExercises);
  };

  const handleRemoveExercise = (index: number) => {
    const updatedExercises = exercises.filter((_, i) => i !== index);
    setExercises(updatedExercises);
  };

  const handleUpdateExercise = (index: number, field: 'sets' | 'reps', value: string) => {
    const newExercises = [...exercises];
    newExercises[index] = { 
      ...newExercises[index], 
      [field]: parseInt(value) || 0 
    };
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
      <Box 
        flex={1} 
        bg="#2A2E38" 
        borderTopLeftRadius="2xl" 
        borderTopRightRadius="2xl"
        overflow="hidden"
      >
        <ScrollView 
          ref={scrollViewRef}
          flex={1}
          showsVerticalScrollIndicator={false}
        >
          <VStack space={4} p={4}>
            {exercises.length > 0 ? (
              <VStack space={3}>
                {exercises.map((exercise, index) => (
                  <Box
                    key={exercise.id}
                    bg="#1E2028"
                    p={4}
                    borderRadius="lg"
                  >
                    <HStack justifyContent="space-between" alignItems="center">
                      <HStack space={2} alignItems="center" flex={1}>
                        <Box
                          w="3"
                          h="full"
                          bg={splitColor}
                          position="absolute"
                          left={0}
                          borderRadius="md"
                        />
                        <Text color="gray.400" fontSize="sm" ml={4}>
                          {index + 1}
                        </Text>
                        <Text color="white" fontSize="md">
                          {exercise.name}
                        </Text>
                      </HStack>
                      {isEditing && (
                        <IconButton
                          icon={<Icon as={AntDesign} name="close" color="gray.400" />}
                          onPress={() => handleRemoveExercise(index)}
                          variant="ghost"
                          _pressed={{ opacity: 0.7 }}
                        />
                      )}
                    </HStack>
                  </Box>
                ))}
                
                {isEditing && addExerciseButton}
              </VStack>
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
            )}
          </VStack>
        </ScrollView>
      </Box>

      {/* Exercise Selection Modal */}
      {showExerciseSelection && (
        <Box
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          bg="rgba(0, 0, 0, 0.5)"
          justifyContent="center"
          alignItems="center"
        >
          <ExerciseSelectionView
            onClose={() => setShowExerciseSelection(false)}
            onAddExercise={handleAddExercise}
          />
        </Box>
      )}
    </Box>
  );
};

export default SplitDetailScreen; 