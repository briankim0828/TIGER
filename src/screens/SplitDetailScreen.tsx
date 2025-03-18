import React, { useState, useRef } from 'react';
import { Box, HStack, Text, Icon, IconButton, VStack, Pressable, ScrollView } from 'native-base';
import { AntDesign } from '@expo/vector-icons';
import { Split } from './WorkoutScreen';
import ExerciseSelectionView, { Exercise } from '../components/ExerciseSelectionView';
import { ScrollView as RNScrollView } from 'react-native';

interface SplitDetailScreenProps {
  split: Split;
  onBack: () => void;
  onUpdateSplit?: (updatedSplit: Split) => void;
}

const SplitDetailScreen = ({ split, onBack, onUpdateSplit }: SplitDetailScreenProps) => {
  const splitColor = split.color || '#2A2E38';
  const [exercises, setExercises] = useState<Exercise[]>(split.exercises);
  const [showExerciseSelection, setShowExerciseSelection] = useState(false);
  const scrollViewRef = useRef<RNScrollView>(null);

  const handleAddExercise = (exercise: Exercise) => {
    const updatedExercises = [...exercises, exercise];
    setExercises(updatedExercises);
    
    // Update the parent component if callback provided
    if (onUpdateSplit) {
      onUpdateSplit({
        ...split,
        exercises: updatedExercises
      });
    }
  };

  const handleRemoveExercise = (index: number) => {
    const updatedExercises = exercises.filter((_, i) => i !== index);
    setExercises(updatedExercises);
    
    // Update the parent component if callback provided
    if (onUpdateSplit) {
      onUpdateSplit({
        ...split,
        exercises: updatedExercises
      });
    }
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
      {/* Header */}
      <Box bg="transparent" px={2} py={3}>
        <HStack alignItems="center">
          <IconButton
            icon={<Icon as={AntDesign} name="arrowleft" color="white" size="md" />}
            onPress={onBack}
            variant="ghost"
            _pressed={{ bg: 'transparent' }}
          />
          <Text color="white" fontSize="xl" fontWeight="bold" mr={3}>
            {split.name}
          </Text>
          <Box w={6} h={6} bg={splitColor} borderRadius="lg" />
        </HStack>
      </Box>

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
                    p={4} 
                    borderRadius="md"
                  >
                    <HStack justifyContent="space-between" alignItems="center">
                      <HStack space={3} alignItems="center">
                        <Box 
                          w={8} 
                          h={8} 
                          bg={splitColor} 
                          borderRadius="md" 
                          justifyContent="center" 
                          alignItems="center"
                        >
                          <Text color="white" fontWeight="bold">{index + 1}</Text>
                        </Box>
                        <VStack>
                          <Text color="white" fontWeight="bold">
                            {exercise.name}
                          </Text>
                          <Text color="gray.400" fontSize="xs">
                            {exercise.bodyPart}
                          </Text>
                        </VStack>
                      </HStack>
                      <IconButton
                        icon={<Icon as={AntDesign} name="delete" color="#FF6B6B" />}
                        onPress={() => handleRemoveExercise(index)}
                        variant="ghost"
                        size="sm"
                      />
                    </HStack>
                  </Box>
                ))}
                
                {addExerciseButton}
              </VStack>
            </ScrollView>
          ) : (
            <Box bg="#2A2E38" borderRadius="lg" p={5}>
              <VStack space={5} alignItems="center">
                <Text color="gray.400" fontSize="lg">
                  Add exercises to {split.name} day
                </Text>
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
              </VStack>
            </Box>
          )
        )}
      </Box>
    </Box>
  );
};

export default SplitDetailScreen; 