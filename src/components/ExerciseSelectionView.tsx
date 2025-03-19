import React, { useState } from 'react';
import { 
  Box, 
  Center, 
  HStack, 
  VStack, 
  Text, 
  Pressable, 
  Button,
  ScrollView,
  Icon,
  Divider
} from 'native-base';
import { AntDesign, MaterialIcons, Feather } from '@expo/vector-icons';

// Define exercise types
export interface Exercise {
  id: string;
  name: string;
  bodyPart: string;
}

interface ExerciseSelectionViewProps {
  onClose: () => void;
  onAddExercise: (exercises: Exercise[]) => void;
}

const BODY_PARTS = [
  'Chest',
  'Back',
  'Legs',
  'Arms',
  'Shoulders',
  'Core',
  'Cardio'
];

// Simple exercise database
const EXERCISES_BY_BODY_PART: Record<string, Exercise[]> = {
  'Chest': [
    { id: 'chest-1', name: 'Flat Bench Press', bodyPart: 'Chest' },
    { id: 'chest-2', name: 'Incline Dumbbell Press', bodyPart: 'Chest' },
    { id: 'chest-3', name: 'Decline Bench Press', bodyPart: 'Chest' },
    { id: 'chest-4', name: 'Chest Flyes', bodyPart: 'Chest' },
    { id: 'chest-5', name: 'Push-Ups', bodyPart: 'Chest' },
    { id: 'chest-6', name: 'Cable Flyes', bodyPart: 'Chest' }
  ],
  'Back': [
    { id: 'back-1', name: 'Barbell Row', bodyPart: 'Back' },
    { id: 'back-2', name: 'Pull-Ups', bodyPart: 'Back' },
    { id: 'back-3', name: 'Lat Pulldowns', bodyPart: 'Back' },
    { id: 'back-4', name: 'Deadlift', bodyPart: 'Back' },
    { id: 'back-5', name: 'Face Pulls', bodyPart: 'Back' },
    { id: 'back-6', name: 'Cable Row', bodyPart: 'Back' }
  ],
  'Legs': [
    { id: 'legs-1', name: 'Squats', bodyPart: 'Legs' },
    { id: 'legs-2', name: 'Romanian Deadlift', bodyPart: 'Legs' },
    { id: 'legs-3', name: 'Leg Press', bodyPart: 'Legs' },
    { id: 'legs-4', name: 'Lunges', bodyPart: 'Legs' },
    { id: 'legs-5', name: 'Calf Raises', bodyPart: 'Legs' },
    { id: 'legs-6', name: 'Leg Extensions', bodyPart: 'Legs' }
  ],
  'Arms': [
    { id: 'arms-1', name: 'Bicep Curls', bodyPart: 'Arms' },
    { id: 'arms-2', name: 'Tricep Pushdowns', bodyPart: 'Arms' },
    { id: 'arms-3', name: 'Hammer Curls', bodyPart: 'Arms' },
    { id: 'arms-4', name: 'Skull Crushers', bodyPart: 'Arms' },
    { id: 'arms-5', name: 'Preacher Curls', bodyPart: 'Arms' },
    { id: 'arms-6', name: 'Tricep Extensions', bodyPart: 'Arms' }
  ],
  'Shoulders': [
    { id: 'shoulders-1', name: 'Dumbbell Press', bodyPart: 'Shoulders' },
    { id: 'shoulders-2', name: 'Lateral Raises', bodyPart: 'Shoulders' },
    { id: 'shoulders-3', name: 'Front Raises', bodyPart: 'Shoulders' },
    { id: 'shoulders-4', name: 'Barbell Press', bodyPart: 'Shoulders' },
    { id: 'shoulders-5', name: 'Shrugs', bodyPart: 'Shoulders' },
    { id: 'shoulders-6', name: 'Reverse Flyes', bodyPart: 'Shoulders' }
  ],
  'Core': [
    { id: 'core-1', name: 'Crunches', bodyPart: 'Core' },
    { id: 'core-2', name: 'Plank', bodyPart: 'Core' },
    { id: 'core-3', name: 'Russian Twists', bodyPart: 'Core' },
    { id: 'core-4', name: 'Leg Raises', bodyPart: 'Core' },
    { id: 'core-5', name: 'Mountain Climbers', bodyPart: 'Core' },
    { id: 'core-6', name: 'Bicycle Crunches', bodyPart: 'Core' }
  ],
  'Cardio': [
    { id: 'cardio-1', name: 'Treadmill', bodyPart: 'Cardio' },
    { id: 'cardio-2', name: 'Stairmaster', bodyPart: 'Cardio' },
    { id: 'cardio-3', name: 'Elliptical', bodyPart: 'Cardio' },
    { id: 'cardio-4', name: 'Stationary Bike', bodyPart: 'Cardio' },
    { id: 'cardio-5', name: 'Rowing Machine', bodyPart: 'Cardio' },
    { id: 'cardio-6', name: 'Arc Trainer', bodyPart: 'Cardio' }
  ]
};

// Icon mapping for body parts
const BODY_PART_ICONS: Record<string, any> = {
  'Chest': <MaterialIcons name="fitness-center" size={16} />,
  'Back': <MaterialIcons name="fitness-center" size={16} />,
  'Legs': <MaterialIcons name="fitness-center" size={16} />,
  'Arms': <MaterialIcons name="fitness-center" size={16} />,
  'Shoulders': <MaterialIcons name="fitness-center" size={16} />,
  'Core': <MaterialIcons name="fitness-center" size={16} />,
  'Cardio': <Feather name="heart" size={16} />
};

const ExerciseSelectionView = ({ onClose, onAddExercise }: ExerciseSelectionViewProps) => {
  const [selectedBodyPart, setSelectedBodyPart] = useState<string | null>(null);
  const [selectedExercises, setSelectedExercises] = useState<Exercise[]>([]);

  const handleBodyPartSelect = (bodyPart: string) => {
    setSelectedBodyPart(bodyPart);
  };

  const handleExerciseSelect = (exercise: Exercise) => {
    setSelectedExercises(prev => {
      // If exercise is already selected, remove it
      if (prev.some(e => e.id === exercise.id)) {
        return prev.filter(e => e.id !== exercise.id);
      }
      // Otherwise add it to the end of the array
      return [...prev, exercise];
    });
  };

  const handleAddExercises = () => {
    if (selectedExercises.length > 0) {
      onAddExercise(selectedExercises);
      onClose();
      // Reset selections
      setSelectedBodyPart(null);
      setSelectedExercises([]);
    }
  };

  const isExerciseSelected = (exerciseId: string) => {
    return selectedExercises.some(e => e.id === exerciseId);
  };

  return (
    <Box 
      bg="#232530" 
      height="90%"
      borderRadius="2xl"
      shadow={9}
    >
      {/* Header */}
      <Box bg="#1A1C24" p={4} borderTopRadius="2xl">
        <HStack alignItems="center" space={2}>
          <Icon as={MaterialIcons} name="fitness-center" color="#6B8EF2" size="sm" />
          <Text color="white" fontSize="lg" fontWeight="bold">
            Select Exercises
          </Text>
        </HStack>
      </Box>

      {/* Content */}
      <Box flex={1} borderBottomRadius="2xl" overflow="hidden">
        <HStack space={0} h="full">
          {/* Body Parts - 30% */}
          <Box w="30%" bg="#1A1C24">
            <ScrollView showsVerticalScrollIndicator={false}>
              {BODY_PARTS.map((bodyPart) => (
                <Pressable
                  key={bodyPart}
                  onPress={() => handleBodyPartSelect(bodyPart)}
                  py={4}
                  px={3}
                  bg={selectedBodyPart === bodyPart ? 'rgba(107, 142, 242, 0.1)' : 'transparent'}
                  _pressed={{ bg: 'rgba(107, 142, 242, 0.05)' }}
                >
                  <Text 
                    color={selectedBodyPart === bodyPart ? 'white' : 'gray.400'} 
                    fontWeight={selectedBodyPart === bodyPart ? 'semibold' : 'normal'}
                  >
                    {bodyPart}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </Box>

          {/* Right Side VStack - 70% */}
          <VStack w="70%" h="full" bg="#232530">
            {/* Selected Exercises Preview */}
            {selectedExercises.length > 0 && (
              <Box bg="#1A1C24" p={3} borderBottomWidth={1} borderColor="gray.700">
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <HStack space={2}>
                    {selectedExercises.map((exercise, index) => (
                      <Pressable
                        key={exercise.id}
                        onPress={() => handleExerciseSelect(exercise)}
                        bg="rgba(107, 142, 242, 0.15)"
                        px={3}
                        py={1.5}
                        borderRadius="full"
                        flexDirection="row"
                        alignItems="center"
                      >
                        <Text color="white" fontSize="sm" mr={2}>
                          {exercise.name}
                        </Text>
                        <Icon as={AntDesign} name="close" color="white" size="xs" />
                      </Pressable>
                    ))}
                  </HStack>
                </ScrollView>
              </Box>
            )}

            {/* Exercises List */}
            <Box flex={1}>
              <ScrollView p={3} flex={1} showsVerticalScrollIndicator={false}>
                {selectedBodyPart ? (
                  EXERCISES_BY_BODY_PART[selectedBodyPart].map((exercise) => (
                    <Pressable
                      key={exercise.id}
                      onPress={() => handleExerciseSelect(exercise)}
                      py={3}
                      px={4}
                      mb={2}
                      bg={isExerciseSelected(exercise.id) ? 'rgba(107, 142, 242, 0.15)' : 'transparent'}
                      borderRadius="lg"
                      _pressed={{ opacity: 0.7 }}
                    >
                      <HStack justifyContent="space-between" alignItems="center">
                        <Text color="white" fontSize="md">{exercise.name}</Text>
                        {isExerciseSelected(exercise.id) && (
                          <Center w={6} h={6} bg="#6B8EF2" borderRadius="full">
                            <Icon as={AntDesign} name="check" color="white" size="xs" />
                          </Center>
                        )}
                      </HStack>
                    </Pressable>
                  ))
                ) : (
                  <Center flex={1} p={4}>
                    <Icon as={MaterialIcons} name="category" color="gray.500" size="xl" mb={2} />
                    <Text color="gray.400" textAlign="center">
                      Select a body part to see available exercises
                    </Text>
                  </Center>
                )}
              </ScrollView>
            </Box>
            
            {/* Buttons */}
            <Box bg="#232530" p={3}>
              <Divider bg="gray.700" mb={3} />
              <HStack justifyContent="space-between">
                <Button 
                  variant="outline"
                  borderColor="gray.600"
                  _text={{ color: "gray.400" }}
                  onPress={onClose} 
                  flex={1}
                  mr={2}
                >
                  Cancel
                </Button>
                <Button 
                  bg="#6B8EF2"
                  _pressed={{ bg: "#5A7CD0" }}
                  isDisabled={selectedExercises.length === 0} 
                  opacity={selectedExercises.length > 0 ? 1 : 0.5}
                  onPress={handleAddExercises} 
                  flex={1}
                  leftIcon={<Icon as={AntDesign} name="plus" color="white" size="sm" />}
                  _text={{ fontSize: "sm" }}
                >
                  {`Add (${selectedExercises.length})`}
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