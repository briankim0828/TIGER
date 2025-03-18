import React, { useState } from 'react';
import { Box, HStack, Text, Button, Icon, VStack, Pressable, IconButton } from 'native-base';
import { AntDesign } from '@expo/vector-icons';
import CustomTextInput from '../components/CustomTextInput';

export interface Exercise {
  id: string;
  name: string;
}

export interface Split {
  id: string;
  name: string;
  day: string;
  exercises: Exercise[];
  color?: string;
}

const COLORS = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#45B7D1', // Blue
  '#96CEB4', // Green
  '#FFEEAD', // Yellow
  '#D4A5A5'  // Pink
];

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const ColorBar = ({ color }: { color?: string }) => (
  <Box w="full" h="2" bg={color || 'transparent'} borderTopRadius="lg" />
);

const WorkoutScreen = () => {
  // Initialize with empty splits for each day
  const [splits, setSplits] = useState<Split[]>(
    WEEKDAYS.map((day, index) => ({
      id: index.toString(),
      name: 'Empty',
      day,
      exercises: [],
      color: undefined
    }))
  );
  
  const [selectedSplit, setSelectedSplit] = useState<Split | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');

  const handleSplitSelect = (split: Split) => {
    setSelectedSplit(split);
    setEditName(split.name);
    setIsEditing(false);
  };

  const handleEditToggle = () => {
    if (isEditing && selectedSplit) {
      // Update the split name
      const updatedSplit = { ...selectedSplit, name: editName };
      const updatedSplits = splits.map(split => 
        split.id === selectedSplit.id ? updatedSplit : split
      );
      setSplits(updatedSplits);
      setSelectedSplit(updatedSplit);
    }
    setIsEditing(!isEditing);
  };

  const handleColorSelect = (color: string) => {
    if (!selectedSplit) return;
    
    // Update the split color
    const updatedSplit = { ...selectedSplit, color };
    const updatedSplits = splits.map(split => 
      split.id === selectedSplit.id ? updatedSplit : split
    );
    setSplits(updatedSplits);
    setSelectedSplit(updatedSplit);
  };

  const handleAddExercise = () => {
    if (!selectedSplit) return;
    
    // Create a new exercise
    const newExercise: Exercise = {
      id: Date.now().toString(),
      name: 'New Exercise'
    };

    // Add the exercise to the selected split
    const updatedSplit = {
      ...selectedSplit,
      exercises: [...selectedSplit.exercises, newExercise]
    };
    
    // Update the splits array
    const updatedSplits = splits.map(split => 
      split.id === selectedSplit.id ? updatedSplit : split
    );
    
    setSplits(updatedSplits);
    setSelectedSplit(updatedSplit);
  };

  return (
    <Box flex={1} bg="#1E2028" pt={2}>
      <VStack space={6} p={4}>
        <Text color="white" fontSize="2xl" fontWeight="bold">
          My Split
        </Text>

        <HStack justifyContent="space-between" mx={-2} px={1}>
          {splits.map((split: Split) => (
            <Pressable 
              key={split.id}
              onPress={() => handleSplitSelect(split)}
              flex={1}
              mx={0.5}
            >
              <VStack space={2} alignItems="center">
                <Text color="gray.400" fontSize="xs" fontWeight="bold">
                  {split.day}
                </Text>
                <Box
                  bg={split.color || "#2A2E38"}
                  p={2}
                  borderRadius="lg"
                  w="full"
                  h="16"
                  justifyContent="center"
                  alignItems="center"
                  borderWidth={selectedSplit?.id === split.id ? 2 : 0}
                  borderColor="#6B8EF2"
                >
                  {split.name === 'Empty' ? (
                    <Icon 
                      as={AntDesign} 
                      name="plus" 
                      color="white" 
                      size="lg"
                    />
                  ) : (
                    <Text 
                      color="white"
                      fontSize="lg"
                      textAlign="center"
                      fontWeight="bold"
                      numberOfLines={1}
                    >
                      {split.name[0].toUpperCase()}
                    </Text>
                  )}
                </Box>
              </VStack>
            </Pressable>
          ))}
        </HStack>

        {selectedSplit && (
          <Box bg="#2A2E38" borderRadius="lg" overflow="hidden">
            <ColorBar color={selectedSplit.color} />
            <Box p={4}>
              <HStack justifyContent="space-between" alignItems="center">
                <Text color="gray.400" fontSize="xl" fontWeight="bold">
                  {selectedSplit.day}
                </Text>
                <Button
                  variant="ghost"
                  onPress={handleEditToggle}
                  _text={{ color: "#6B8EF2" }}
                >
                  {isEditing ? "Done" : "Edit"}
                </Button>
              </HStack>

              {isEditing ? (
                <VStack space={4} mb={8}>
                  <CustomTextInput
                    value={editName}
                    onChangeText={setEditName}
                    color="white"
                    fontSize="xl"
                  />
                  <HStack space={2} justifyContent="space-between">
                    {COLORS.map((color) => (
                      <Pressable
                        key={color}
                        onPress={() => handleColorSelect(color)}
                        flex={1}
                      >
                        <Box
                          bg={color}
                          h="8"
                          borderRadius="md"
                          borderWidth={selectedSplit.color === color ? 2 : 0}
                          borderColor="white"
                        />
                      </Pressable>
                    ))}
                  </HStack>
                </VStack>
              ) : (
                <Text color="white" fontSize="xl" mb={8}>
                  {selectedSplit.name}
                </Text>
              )}

              <VStack space={3}>
                <HStack justifyContent="space-between" alignItems="center">
                  <Text color="white" fontSize="sm" fontWeight="bold">
                    Exercises
                  </Text>
                  {isEditing && (
                    <IconButton
                      icon={<Icon as={AntDesign} name="plus" color="#6B8EF2" />}
                      onPress={handleAddExercise}
                      variant="ghost"
                    />
                  )}
                </HStack>

                {selectedSplit.exercises.length === 0 ? (
                  <Text color="gray.400" fontSize="sm">
                    No exercises added
                  </Text>
                ) : (
                  selectedSplit.exercises.map(exercise => (
                    <Text key={exercise.id} color="white" fontSize="sm">
                      {exercise.name}
                    </Text>
                  ))
                )}
              </VStack>
            </Box>
          </Box>
        )}
      </VStack>
    </Box>
  );
};

export default WorkoutScreen; 